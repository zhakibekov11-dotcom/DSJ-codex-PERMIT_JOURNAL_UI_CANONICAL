import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import type {
  AnnulResponsibilityOrderInput,
  CreateResponsibilityOrderInput,
  MyResponsibilityOrderItem,
  PrepareResponsibilityOrderForSigningInput,
  ReplaceResponsibilityOrderInput,
  ResponsibilityAppointmentFilters,
  ResponsibilityAppointmentReadModel,
  ResponsibilityOrderConflictSummary,
  ResponsibilityOrderFilters,
  ResponsibilityType,
  SignResponsibilityOrderInput,
  UpdateResponsibilityOrderInput,
} from "@dsj/types";
import { resolveSigningRuntimeConfig } from "@dsj/types";
import { hashDocumentPayload } from "@dsj/utils";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import {
  assertOrganizationAccess,
  requireOrganizationScope,
} from "../common/utils/tenant-scope";
import { CorePlatformService } from "../core-platform/core-platform.service";
import { PrismaService } from "../database/prisma.service";
import { EmployeeComplianceService } from "../employees/employee-compliance.service";
import { PdfService } from "../pdf/pdf.service";
import { MockSigningProvider } from "../signatures/providers/mock-signing.provider";
import { NcalayerSigningProvider } from "../signatures/providers/ncalayer-signing.provider";

const MAX_EFFECTIVE_TO = new Date("9999-12-31T23:59:59.999Z");

const responsibilityOrderInclude = Prisma.validator<Prisma.ResponsibilityOrderInclude>()({
  branch: true,
  department: true,
  workSite: true,
  retentionPolicy: true,
  archiveRecord: {
    include: {
      retentionPolicy: true,
    },
  },
  replacesOrder: {
    select: {
      id: true,
      number: true,
      status: true,
      signedAt: true,
    },
  },
  appointments: {
    orderBy: [{ effectiveFrom: "asc" }, { createdAt: "asc" }],
    include: {
      employee: {
        include: {
          department: true,
        },
      },
      branch: true,
      department: true,
      workSite: true,
    },
  },
  documentEnvelope: {
    include: {
      currentVersion: true,
      signatures: {
        orderBy: [{ signedAt: "desc" }, { createdAt: "desc" }],
        take: 1,
        include: {
          certificateMetadata: true,
          verification: true,
        },
      },
      archiveRecords: {
        orderBy: [{ sealedAt: "desc" }, { createdAt: "desc" }],
        take: 1,
        include: {
          retentionPolicy: true,
        },
      },
    },
  },
});

type RawResponsibilityOrder = Prisma.ResponsibilityOrderGetPayload<{
  include: typeof responsibilityOrderInclude;
}>;

type RawResponsibilityAppointment = RawResponsibilityOrder["appointments"][number];

type RequestContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

type ScopeInput = {
  branchId?: string | null;
  departmentId?: string | null;
  workSiteId?: string | null;
};

type ParsedAppointmentInput = {
  employeeId: string;
  employee: {
    id: string;
    fullName: string;
    employeeNumber: string;
    jobTitle: string;
    departmentId: string | null;
  };
  effectiveFrom: Date;
  effectiveTo: Date | null;
  zoneOfResponsibility: string | null;
  roleNotes: string | null;
};

type ResponsibilityOrderHistorySummary = {
  totalEvents: number;
  lastAction: string | null;
  lastAt: string | null;
};

const RESPONSIBILITY_ORDER_HISTORY_EMPTY: ResponsibilityOrderHistorySummary = {
  totalEvents: 0,
  lastAction: null,
  lastAt: null,
};

@Injectable()
export class ResponsibilityOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly pdfService: PdfService,
    private readonly configService: ConfigService,
    private readonly corePlatformService: CorePlatformService,
    private readonly employeeComplianceService: EmployeeComplianceService,
    private readonly mockSigningProvider: MockSigningProvider,
    private readonly ncalayerSigningProvider: NcalayerSigningProvider,
  ) {}

  private toIsoString(value: Date | null | undefined) {
    return value ? value.toISOString() : null;
  }

  private responsibilityOrderDocumentTitle(number: string, title: string) {
    return `Responsibility order ${number}: ${title}`;
  }

  private getSigningRuntimeConfig() {
    return resolveSigningRuntimeConfig({
      SIGNING_PROVIDER: this.configService.get<string>("SIGNING_PROVIDER"),
      NCALAYER_BRIDGE_URL: this.configService.get<string>("NCALAYER_BRIDGE_URL"),
      NCALAYER_BRIDGE_TIMEOUT_MS: this.configService.get<string>("NCALAYER_BRIDGE_TIMEOUT_MS"),
      SIGNING_TEST_MODE: this.configService.get<string>("SIGNING_TEST_MODE"),
    });
  }

  private requireSigningRuntimeConfig() {
    const config = this.getSigningRuntimeConfig();

    if (!config.isConfigured) {
      throw new BadRequestException(config.configError);
    }

    return config;
  }

  private isMockPayload(input: SignResponsibilityOrderInput | undefined): input is Exclude<
    SignResponsibilityOrderInput,
    { cms: string }
  > {
    return Boolean(input && typeof input === "object" && !("cms" in input));
  }

  private isNcalayerPayload(input: SignResponsibilityOrderInput | undefined): input is Extract<
    NonNullable<SignResponsibilityOrderInput>,
    { cms: string }
  > {
    return Boolean(input && typeof input === "object" && "cms" in input);
  }

  private parseDateBoundary(value?: string, endOfDay = false) {
    if (!value) {
      return undefined;
    }

    if (/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
      return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
    }

    return new Date(value);
  }

  private parseRequiredDate(value: string, label: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid ${label}.`);
    }

    return date;
  }

  private parseOptionalDate(value: string | null | undefined, label: string) {
    if (!value) {
      return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid ${label}.`);
    }

    return date;
  }

  private legacyOrganizationCode(company: {
    id: string;
    bin: string | null;
  }) {
    if (company.bin) {
      return `BIN-${company.bin}`;
    }

    return `LEGACY-${company.id.slice(0, 8).toUpperCase()}`;
  }

  private async ensureOrganizationRecord(organizationId: string) {
    const existing = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (existing) {
      return existing;
    }

    const company = await this.prisma.company.findUnique({
      where: { id: organizationId },
    });

    if (!company) {
      throw new NotFoundException("Organization not found.");
    }

    return this.prisma.organization.upsert({
      where: { id: company.id },
      create: {
        id: company.id,
        legacyCompanyId: company.id,
        code: this.legacyOrganizationCode(company),
        name: company.name,
        bin: company.bin,
        timezone: company.timezone,
        isActive: company.isActive,
      },
      update: {
        legacyCompanyId: company.id,
        code: this.legacyOrganizationCode(company),
        name: company.name,
        bin: company.bin,
        timezone: company.timezone,
        isActive: company.isActive,
      },
    });
  }

  private resolveScopeType(scope: ScopeInput) {
    if (scope.workSiteId) {
      return "WORK_SITE" as const;
    }

    if (scope.departmentId) {
      return "DEPARTMENT" as const;
    }

    if (scope.branchId) {
      return "BRANCH" as const;
    }

    return "ORGANIZATION" as const;
  }

  private toCanonicalStatus(order: RawResponsibilityOrder) {
    const envelope = order.documentEnvelope;

    if (!envelope) {
      return null;
    }

    const effectiveTo = envelope.currentVersion?.effectiveTo;

    if (effectiveTo && effectiveTo.getTime() < Date.now()) {
      return "expired" as const;
    }

    switch (envelope.status) {
      case "DRAFT":
        return "draft" as const;
      case "IN_APPROVAL":
        return "on_approval" as const;
      case "SIGNING_READY":
      case "ACTIVE":
        return "approved" as const;
      case "SIGNED":
        return "signed" as const;
      case "ANNULLED":
        return "annulled" as const;
      case "SUPERSEDED":
      case "ARCHIVED":
        return "replaced" as const;
      default:
        return "draft" as const;
    }
  }

  private isImmutableSigned(order: RawResponsibilityOrder) {
    return (
      order.documentEnvelope?.status === "SIGNED" ||
      order.documentEnvelope?.currentVersion?.status === "SIGNED"
    );
  }

  private isTerminalState(order: RawResponsibilityOrder) {
    return (
      order.status === "ANNULLED" ||
      order.status === "SUPERSEDED" ||
      order.documentEnvelope?.status === "ANNULLED" ||
      order.documentEnvelope?.status === "SUPERSEDED" ||
      order.documentEnvelope?.status === "ARCHIVED"
    );
  }

  private hasEvidenceTrail(order: RawResponsibilityOrder) {
    return Boolean(
      order.documentEnvelope &&
        ((order.documentEnvelope.signatures?.length ?? 0) > 0 ||
          (order.documentEnvelope.archiveRecords?.length ?? 0) > 0),
    );
  }

  private retentionSource(retentionPolicy: {
    retentionCode: string;
    legalBasis: string;
  } | null) {
    if (!retentionPolicy) {
      return "configured" as const;
    }

    return retentionPolicy.retentionCode === "RESPONSIBILITY_ORDER_10Y" ||
      retentionPolicy.legalBasis.startsWith("P1 baseline:") ||
      retentionPolicy.legalBasis.startsWith("P0 baseline:")
      ? "baseline" as const
      : "configured" as const;
  }

  private resolveReadStatus(order: RawResponsibilityOrder) {
    if (order.status === "DRAFT" || order.status === "SIGNING_READY") {
      return order.status;
    }

    if (order.status === "ANNULLED" || order.status === "SUPERSEDED") {
      return order.status;
    }

    const now = Date.now();
    const hasActiveAppointment = order.appointments.some((appointment) => {
      const starts = appointment.effectiveFrom.getTime();
      const ends = appointment.effectiveTo?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return starts <= now && ends >= now;
    });
    const hasFutureAppointment = order.appointments.some(
      (appointment) => appointment.effectiveFrom.getTime() > now,
    );

    if (hasActiveAppointment) {
      return "ACTIVE" as const;
    }

    if (order.appointments.length > 0 && !hasFutureAppointment) {
      return "EXPIRED" as const;
    }

    return "SIGNED" as const;
  }

  private resolveReadStatusFromOrderSnapshot(args: {
    status: RawResponsibilityOrder["status"];
    appointments: Array<{
      effectiveFrom: Date;
      effectiveTo: Date | null;
    }>;
  }) {
    if (args.status === "DRAFT" || args.status === "SIGNING_READY") {
      return args.status;
    }

    if (args.status === "ANNULLED" || args.status === "SUPERSEDED") {
      return args.status;
    }

    const now = Date.now();
    const hasActiveAppointment = args.appointments.some((appointment) => {
      const starts = appointment.effectiveFrom.getTime();
      const ends = appointment.effectiveTo?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return starts <= now && ends >= now;
    });
    const hasFutureAppointment = args.appointments.some(
      (appointment) => appointment.effectiveFrom.getTime() > now,
    );

    if (hasActiveAppointment) {
      return "ACTIVE" as const;
    }

    if (args.appointments.length > 0 && !hasFutureAppointment) {
      return "EXPIRED" as const;
    }

    return "SIGNED" as const;
  }

  private resolveAppointmentState(
    order: RawResponsibilityOrder,
    appointment: RawResponsibilityAppointment,
  ) {
    if (order.status === "ANNULLED" || order.status === "SUPERSEDED") {
      return {
        active: false,
        derivedStatus: "INACTIVE" as const,
      };
    }

    const now = Date.now();
    const effectiveFrom = appointment.effectiveFrom.getTime();
    const effectiveTo = appointment.effectiveTo?.getTime() ?? Number.MAX_SAFE_INTEGER;

    if (effectiveTo < now) {
      return {
        active: false,
        derivedStatus: "EXPIRED" as const,
      };
    }

    if (effectiveFrom > now) {
      return {
        active: false,
        derivedStatus: "INACTIVE" as const,
      };
    }

    return {
      active: true,
      derivedStatus: "ACTIVE" as const,
    };
  }

  private buildAllowedActions(
    order: RawResponsibilityOrder,
    conflictSummary: ResponsibilityOrderConflictSummary,
  ) {
    const envelope = order.documentEnvelope;
    const currentVersion = envelope?.currentVersion;
    const isSigned = this.isImmutableSigned(order);
    const isTerminal = this.isTerminalState(order);
    const readStatus = this.resolveReadStatusFromOrderSnapshot({
      status: order.status,
      appointments: order.appointments,
    });
    const isReadyForSigning =
      order.status === "SIGNING_READY" &&
      envelope?.status === "SIGNING_READY" &&
      currentVersion?.status === "FINAL";

    return {
      canEditDraft: order.status === "DRAFT" && !isSigned && !isTerminal,
      canPrepareSign:
        order.status === "DRAFT" && !isSigned && !isTerminal && !conflictSummary.blocking,
      canSign: Boolean(isReadyForSigning && !conflictSummary.blocking),
      canAnnul: Boolean(
        envelope &&
          !isTerminal &&
          (isSigned || isReadyForSigning || readStatus === "ACTIVE" || readStatus === "EXPIRED"),
      ),
      canReplace: Boolean(
        !isTerminal &&
          (readStatus === "SIGNED" || readStatus === "ACTIVE" || readStatus === "EXPIRED"),
      ),
      canDownloadEvidence: this.hasEvidenceTrail(order),
      canViewArchive: Boolean(order.archiveRecord ?? order.documentEnvelope?.archiveRecords[0]),
    };
  }

  private mapScopeRef(
    value:
      | {
          id: string;
          code?: string | null;
          name: string;
          location?: string | null;
        }
      | null
      | undefined,
  ) {
    if (!value) {
      return null;
    }

    return {
      id: value.id,
      code: value.code ?? null,
      name: value.name,
      location: value.location ?? null,
    };
  }

  private buildPayload(args: {
    orderId: string;
    number: string;
    date: Date;
    responsibilityType: ResponsibilityType;
    title: string;
    basis: string;
    notes?: string | null;
    scopeType: "ORGANIZATION" | "BRANCH" | "DEPARTMENT" | "WORK_SITE";
    branchId?: string | null;
    departmentId?: string | null;
    workSiteId?: string | null;
    appointments: ParsedAppointmentInput[];
    replacesOrderId?: string | null;
  }) {
    return {
      responsibilityOrderId: args.orderId,
      number: args.number,
      date: args.date.toISOString(),
      responsibilityType: args.responsibilityType,
      title: args.title,
      basis: args.basis,
      notes: args.notes ?? null,
      scopeType: args.scopeType,
      branchId: args.branchId ?? null,
      departmentId: args.departmentId ?? null,
      workSiteId: args.workSiteId ?? null,
      appointments: args.appointments.map((appointment) => ({
        employeeId: appointment.employee.id,
        fullName: appointment.employee.fullName,
        employeeNumber: appointment.employee.employeeNumber,
        jobTitle: appointment.employee.jobTitle,
        departmentId: appointment.employee.departmentId,
        responsibilityType: args.responsibilityType,
        effectiveFrom: appointment.effectiveFrom.toISOString(),
        effectiveTo: appointment.effectiveTo?.toISOString() ?? null,
        zoneOfResponsibility: appointment.zoneOfResponsibility ?? null,
        roleNotes: appointment.roleNotes ?? null,
      })),
      replacesOrderId: args.replacesOrderId ?? null,
    } as Prisma.JsonObject;
  }

  private async ensureBranchInOrganization(
    organizationId: string,
    branchId?: string | null,
  ) {
    if (!branchId) {
      return null;
    }

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch || branch.organizationId !== organizationId) {
      throw new BadRequestException("Branch does not belong to the organization.");
    }

    return branch;
  }

  private async ensureDepartmentInOrganization(
    organizationId: string,
    departmentId?: string | null,
  ) {
    if (!departmentId) {
      return null;
    }

    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!department || department.companyId !== organizationId) {
      throw new BadRequestException("Department does not belong to the organization.");
    }

    return department;
  }

  private async ensureWorkSiteInOrganization(
    organizationId: string,
    workSiteId?: string | null,
  ) {
    if (!workSiteId) {
      return null;
    }

    const workSite = await this.prisma.workSite.findUnique({
      where: { id: workSiteId },
    });

    if (!workSite || workSite.organizationId !== organizationId) {
      throw new BadRequestException("Work site does not belong to the organization.");
    }

    return workSite;
  }

  private async ensureEmployees(organizationId: string, employeeIds: string[]) {
    const uniqueIds = [...new Set(employeeIds)];

    const employees = await this.prisma.employee.findMany({
      where: {
        id: { in: uniqueIds },
        companyId: organizationId,
        isArchived: false,
      },
      select: {
        id: true,
        fullName: true,
        employeeNumber: true,
        jobTitle: true,
        departmentId: true,
      },
    });

    if (employees.length !== uniqueIds.length) {
      throw new BadRequestException("One or more employees do not belong to the organization.");
    }

    const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));

    return employeeIds.map((employeeId) => {
      const employee = employeeMap.get(employeeId);

      if (!employee) {
        throw new BadRequestException("One or more employees do not belong to the organization.");
      }

      return employee;
    });
  }

  private parseAppointmentInputs(
    appointments: CreateResponsibilityOrderInput["appointments"],
    employeeMap: Map<
      string,
      {
        id: string;
        fullName: string;
        employeeNumber: string;
        jobTitle: string;
        departmentId: string | null;
      }
    >,
  ): ParsedAppointmentInput[] {
    const uniqueEmployeeIds = new Set<string>();

    return appointments.map((appointment) => {
      const employee = employeeMap.get(appointment.employeeId);

      if (!employee) {
        throw new BadRequestException("One or more employees do not belong to the organization.");
      }

      if (uniqueEmployeeIds.has(employee.id)) {
        throw new BadRequestException(
          "The same employee cannot be added twice to one responsibility order.",
        );
      }

      uniqueEmployeeIds.add(employee.id);

      const effectiveFrom = this.parseRequiredDate(appointment.effectiveFrom, "effectiveFrom");
      const effectiveTo = this.parseOptionalDate(appointment.effectiveTo ?? null, "effectiveTo");

      if (effectiveTo && effectiveTo.getTime() < effectiveFrom.getTime()) {
        throw new BadRequestException("effectiveTo cannot be earlier than effectiveFrom.");
      }

      return {
        employeeId: employee.id,
        employee,
        effectiveFrom,
        effectiveTo,
        zoneOfResponsibility: appointment.zoneOfResponsibility?.trim() || null,
        roleNotes: appointment.roleNotes?.trim() || null,
      };
    });
  }

  private async validateScopeAndAppointments(args: {
    organizationId: string;
    scope: ScopeInput;
    appointments: CreateResponsibilityOrderInput["appointments"];
  }) {
    const selectedScopeCount = [
      args.scope.branchId ?? null,
      args.scope.departmentId ?? null,
      args.scope.workSiteId ?? null,
    ].filter(Boolean).length;

    if (selectedScopeCount > 1) {
      throw new BadRequestException(
        "Responsibility order scope must be exactly one of organization, branch, department, or work site.",
      );
    }

    await Promise.all([
      this.ensureBranchInOrganization(args.organizationId, args.scope.branchId ?? null),
      this.ensureDepartmentInOrganization(args.organizationId, args.scope.departmentId ?? null),
      this.ensureWorkSiteInOrganization(args.organizationId, args.scope.workSiteId ?? null),
    ]);

    const employees = await this.ensureEmployees(
      args.organizationId,
      args.appointments.map((appointment) => appointment.employeeId),
    );
    const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));

    return this.parseAppointmentInputs(args.appointments, employeeMap);
  }

  private ensureEditableDraft(order: RawResponsibilityOrder) {
    if (this.isImmutableSigned(order)) {
      throw new BadRequestException(
        "Signed responsibility orders are immutable. Use replace or annul instead of editing the signed revision.",
      );
    }

    if (this.isTerminalState(order)) {
      throw new BadRequestException("Terminal responsibility orders cannot be edited.");
    }

    if (order.status !== "DRAFT") {
      throw new BadRequestException("Only draft responsibility orders can be edited.");
    }
  }

  private async ensureCertificateMetadata(
    organizationId: string,
    input: Extract<NonNullable<SignResponsibilityOrderInput>, { cms: string }>,
  ) {
    const existing = await this.prisma.certificateMetadata.findFirst({
      where: {
        organizationId,
        serial: input.certificateSerial,
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.certificateMetadata.create({
      data: {
        organizationId,
        provider: "NCALAYER",
        serial: input.certificateSerial,
        thumbprint: input.certificateThumbprint,
        subjectDn: input.certificateSubject,
        issuerDn: input.certificateIssuer,
        validFrom: new Date(input.certificateValidFrom),
        validTo: new Date(input.certificateValidTo),
        source: "NCALAYER_BRIDGE",
        isRevoked: false,
        revocationReason: null,
      },
    });
  }

  private buildSignatureHash(
    input: SignResponsibilityOrderInput | undefined,
    payload: Prisma.InputJsonValue,
  ) {
    if (this.isNcalayerPayload(input)) {
      return hashDocumentPayload(input.cms);
    }

    return hashDocumentPayload(JSON.stringify(payload));
  }

  private resolveSigningResult(
    order: RawResponsibilityOrder,
    input: SignResponsibilityOrderInput | undefined,
  ) {
    const config = this.requireSigningRuntimeConfig();
    const documentHash = order.documentEnvelope?.currentVersion?.renderedHash ?? null;

    if (!documentHash) {
      throw new BadRequestException(
        "Document digest is missing. Prepare the responsibility order for signing first.",
      );
    }

    if (config.provider === "NCALAYER") {
      if (!this.isNcalayerPayload(input)) {
        throw new BadRequestException("NCALayer signing requires a bridge payload.");
      }

      return this.ncalayerSigningProvider.sign({
        entityId: order.id,
        entityType: "RESPONSIBILITY_ORDER",
        documentHash,
        ...input,
      });
    }

    if (!this.isMockPayload(input)) {
      throw new BadRequestException("Mock signing requires signer payload.");
    }

    const mockInput = input!;

    return this.mockSigningProvider.sign({
      entityId: order.id,
      entityType: "RESPONSIBILITY_ORDER",
      documentHash,
      signerName: mockInput.signerName,
      signerIin: mockInput.signerIin,
      certificateSerial: mockInput.certificateSerial,
    });
  }

  private async getHistorySummary(orderId: string) {
    const [totalEvents, lastEvent] = await Promise.all([
      this.prisma.auditLog.count({
        where: {
          entityType: "ResponsibilityOrder",
          entityId: orderId,
        },
      }),
      this.prisma.auditLog.findFirst({
        where: {
          entityType: "ResponsibilityOrder",
          entityId: orderId,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          action: true,
          createdAt: true,
        },
      }),
    ]);

    if (!totalEvents) {
      return RESPONSIBILITY_ORDER_HISTORY_EMPTY;
    }

    return {
      totalEvents,
      lastAction: lastEvent?.action ?? null,
      lastAt: this.toIsoString(lastEvent?.createdAt),
    };
  }

  private async buildConflictSummary(
    order: RawResponsibilityOrder,
  ): Promise<ResponsibilityOrderConflictSummary> {
    const items = (
      await Promise.all(
        order.appointments.map(async (appointment) => {
          const conflictingAppointments = await this.prisma.responsibilityAppointment.findMany({
            where: {
              organizationId: order.organizationId,
              orderId: {
                not: order.id,
              },
              responsibilityType: appointment.responsibilityType,
              scopeType: appointment.scopeType,
              branchId: appointment.branchId ?? null,
              departmentId: appointment.departmentId ?? null,
              workSiteId: appointment.workSiteId ?? null,
              effectiveFrom: {
                lte: appointment.effectiveTo ?? MAX_EFFECTIVE_TO,
              },
              OR: [
                {
                  effectiveTo: null,
                },
                {
                  effectiveTo: {
                    gte: appointment.effectiveFrom,
                  },
                },
              ],
              order: {
                status: {
                  notIn: ["DRAFT", "SIGNING_READY", "ANNULLED", "SUPERSEDED"],
                },
              },
            },
            include: {
              order: {
                select: {
                  id: true,
                  number: true,
                  status: true,
                },
              },
              employee: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
            },
          });

          return conflictingAppointments.map((conflict) => {
            const replacementAllowed = conflict.order.id === order.replacesOrderId;

            return {
              blocking: !replacementAllowed,
              responsibilityType: conflict.responsibilityType,
              conflictingOrderId: conflict.order.id,
              conflictingOrderNumber: conflict.order.number,
              conflictingOrderStatus: conflict.order.status,
              effectiveFrom: conflict.effectiveFrom.toISOString(),
              effectiveTo: conflict.effectiveTo?.toISOString() ?? null,
              sourceAppointmentId: appointment.id,
              sourceEmployeeId: appointment.employeeId,
              sourceEmployeeName: appointment.employee.fullName,
              message: replacementAllowed
                ? `Order ${conflict.order.number} will be superseded by this replacement path.`
                : `Order ${conflict.order.number} already assigns the same responsibility on the same scope and overlapping period.`,
            };
          });
        }),
      )
    ).flat();

    const uniqueItems = Array.from(
      new Map(
        items.map((item) => [
          `${item.sourceAppointmentId}:${item.conflictingOrderId}:${item.effectiveFrom}:${item.effectiveTo ?? "open"}`,
          item,
        ]),
      ).values(),
    );

    return {
      blocking: uniqueItems.some((item) => item.blocking),
      count: uniqueItems.length,
      items: uniqueItems,
    };
  }

  private async mapOrder(order: RawResponsibilityOrder) {
    const [historySummary, conflictSummary] = await Promise.all([
      this.getHistorySummary(order.id),
      this.buildConflictSummary(order),
    ]);
    const latestSignature = order.documentEnvelope?.signatures[0] ?? null;
    const latestArchiveRecord = order.documentEnvelope?.archiveRecords[0] ?? null;
    const readStatus = this.resolveReadStatus(order);

    return {
      id: order.id,
      organizationId: order.organizationId,
      number: order.number,
      date: order.date.toISOString(),
      responsibilityType: order.responsibilityType,
      title: order.title,
      basis: order.basis,
      notes: order.notes ?? null,
      scopeType: order.scopeType,
      branchId: order.branchId ?? null,
      departmentId: order.departmentId ?? null,
      workSiteId: order.workSiteId ?? null,
      status: readStatus,
      signedAt: this.toIsoString(order.signedAt),
      documentEnvelopeId: order.documentEnvelopeId ?? null,
      currentVersionId: order.currentVersionId ?? null,
      currentVersionNo:
        order.currentVersionNo ?? order.documentEnvelope?.currentVersion?.versionNo ?? null,
      replacesOrderId: order.replacesOrderId ?? null,
      canonicalStatus: this.toCanonicalStatus(order),
      documentEnvelopeStatus: order.documentEnvelope?.status ?? null,
      documentVersionStatus: order.documentEnvelope?.currentVersion?.status ?? null,
      signingDigest: order.documentEnvelope?.currentVersion?.renderedHash ?? null,
      isSigned: this.isImmutableSigned(order),
      evidenceAvailable: this.hasEvidenceTrail(order),
      latestSignature: latestSignature
        ? {
            id: latestSignature.id,
            provider: latestSignature.provider,
            status: latestSignature.status,
            signerName: latestSignature.signerName,
            signerIinMasked: latestSignature.signerIinMasked,
            certificateSerial: latestSignature.certificateSerial,
            signedAt: this.toIsoString(latestSignature.signedAt),
            verifiedAt: this.toIsoString(latestSignature.verification?.checkedAt),
            verificationResult: latestSignature.verification?.result ?? null,
            chainStatus: latestSignature.verification?.chainStatus ?? null,
            revocationStatus: latestSignature.verification?.revocationStatus ?? null,
            signatureHash: latestSignature.signatureHash ?? null,
          }
        : null,
      archiveRecordSummary: latestArchiveRecord
        ? {
            id: latestArchiveRecord.id,
            status: latestArchiveRecord.status,
            sealedAt: this.toIsoString(latestArchiveRecord.sealedAt),
            archivedAt: this.toIsoString(latestArchiveRecord.archivedAt),
            disposalEligibleAt: this.toIsoString(latestArchiveRecord.disposalEligibleAt),
            storageUri: latestArchiveRecord.storageUri ?? null,
            retentionCode: latestArchiveRecord.retentionPolicy.retentionCode,
            retentionSource: this.retentionSource(latestArchiveRecord.retentionPolicy),
          }
        : null,
      historySummary,
      allowedActions: this.buildAllowedActions(order, conflictSummary),
      appointments: order.appointments.map((appointment) => {
        const appointmentState = this.resolveAppointmentState(order, appointment);

        return {
          id: appointment.id,
          orderId: appointment.orderId,
          employeeId: appointment.employeeId,
          employee: {
            employeeId: appointment.employee.id,
            fullName: appointment.employee.fullName,
            employeeNumber: appointment.employee.employeeNumber ?? null,
            jobTitle: appointment.employee.jobTitle ?? null,
            departmentId: appointment.employee.departmentId ?? null,
            departmentName: appointment.employee.department?.name ?? null,
          },
          responsibilityType: appointment.responsibilityType,
          scopeType: appointment.scopeType,
          branchId: appointment.branchId ?? null,
          departmentId: appointment.departmentId ?? null,
          workSiteId: appointment.workSiteId ?? null,
          effectiveFrom: appointment.effectiveFrom.toISOString(),
          effectiveTo: appointment.effectiveTo?.toISOString() ?? null,
          zoneOfResponsibility: appointment.zoneOfResponsibility ?? null,
          roleNotes: appointment.roleNotes ?? null,
          active: appointmentState.active,
          derivedStatus: appointmentState.derivedStatus,
        };
      }),
      branch: this.mapScopeRef(order.branch),
      department: this.mapScopeRef(order.department),
      workSite: this.mapScopeRef(order.workSite),
      conflictSummary,
    };
  }

  private async requireEmployeeAccount(user: AuthenticatedUser) {
    if (user.role !== "EMPLOYEE_SIGNER") {
      throw new ForbiddenException("This action is only available to employee signers.");
    }

    const employee = await this.prisma.employee.findFirst({
      where: {
        userId: user.userId,
        isArchived: false,
      },
      select: {
        id: true,
        companyId: true,
      },
    });

    if (!employee) {
      throw new ForbiddenException("The account is not linked to an employee record.");
    }

    return employee;
  }

  private async ensureReadAccess(user: AuthenticatedUser, order: RawResponsibilityOrder) {
    if (user.role !== "EMPLOYEE_SIGNER") {
      assertOrganizationAccess(user, order.organizationId);
      return;
    }

    const employee = await this.requireEmployeeAccount(user);

    if (
      employee.companyId !== order.organizationId ||
      !order.appointments.some((appointment) => appointment.employeeId === employee.id)
    ) {
      throw new ForbiddenException("You do not have access to this responsibility order.");
    }
  }

  private async findRawById(id: string) {
    const order = await this.prisma.responsibilityOrder.findUnique({
      where: { id },
      include: responsibilityOrderInclude,
    });

    if (!order) {
      throw new NotFoundException("Responsibility order not found.");
    }

    return order;
  }

  private buildConflictMessage(conflictSummary: ResponsibilityOrderConflictSummary) {
    const examples = conflictSummary.items
      .filter((item) => item.blocking)
      .slice(0, 3)
      .map((item) => item.conflictingOrderNumber)
      .join(", ");

    if (examples.length) {
      return `Blocking conflicts detected with signed responsibility order(s): ${examples}. Use replace path or change the effective period/scope before signing.`;
    }

    return "Blocking conflicts detected with active responsibility orders.";
  }

  private async recalculateEmployees(user: AuthenticatedUser, employeeIds: string[]) {
    const uniqueEmployeeIds = [...new Set(employeeIds.filter(Boolean))];

    await Promise.all(
      uniqueEmployeeIds.map((employeeId) =>
        this.employeeComplianceService.recalculate(user, employeeId),
      ),
    );
  }

  async list(user: AuthenticatedUser, filters: ResponsibilityOrderFilters = {}) {
    const organizationId = requireOrganizationScope(user, filters.organizationId ?? null);
    const dateFrom = this.parseDateBoundary(filters.dateFrom, false);
    const dateTo = this.parseDateBoundary(filters.dateTo, true);
    const where: Prisma.ResponsibilityOrderWhereInput = {
      organizationId,
    };

    if (filters.search) {
      where.number = {
        contains: filters.search.trim(),
        mode: "insensitive",
      };
    }

    if (filters.responsibilityType) {
      where.responsibilityType = filters.responsibilityType;
    }

    if (filters.employeeId) {
      where.appointments = {
        some: {
          employeeId: filters.employeeId,
        },
      };
    }

    if (filters.departmentId) {
      where.departmentId = filters.departmentId;
    }

    if (filters.branchId) {
      where.branchId = filters.branchId;
    }

    if (filters.workSiteId) {
      where.workSiteId = filters.workSiteId;
    }

    if (dateFrom || dateTo) {
      where.date = {};

      if (dateFrom) {
        where.date.gte = dateFrom;
      }

      if (dateTo) {
        where.date.lte = dateTo;
      }
    }

    if (
      filters.status &&
      ["DRAFT", "SIGNING_READY", "ANNULLED", "SUPERSEDED"].includes(filters.status)
    ) {
      where.status = filters.status as
        | "DRAFT"
        | "SIGNING_READY"
        | "ANNULLED"
        | "SUPERSEDED";
    }

    const orders = await this.prisma.responsibilityOrder.findMany({
      where,
      include: responsibilityOrderInclude,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
    const mapped = await Promise.all(orders.map((order) => this.mapOrder(order)));

    if (
      !filters.status ||
      ["DRAFT", "SIGNING_READY", "ANNULLED", "SUPERSEDED"].includes(filters.status)
    ) {
      return mapped;
    }

    return mapped.filter((order) => order.status === filters.status);
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const order = await this.findRawById(id);
    assertOrganizationAccess(user, order.organizationId);
    return this.mapOrder(order);
  }

  async create(user: AuthenticatedUser, input: CreateResponsibilityOrderInput) {
    const organizationId = requireOrganizationScope(user, input.organizationId ?? null);
    await this.ensureOrganizationRecord(organizationId);

    const date = this.parseRequiredDate(input.date, "order date");
    const scope = {
      branchId: input.branchId ?? null,
      departmentId: input.departmentId ?? null,
      workSiteId: input.workSiteId ?? null,
    };
    const scopeType = this.resolveScopeType(scope);
    const parsedAppointments = await this.validateScopeAndAppointments({
      organizationId,
      scope,
      appointments: input.appointments,
    });
    const orderId = randomUUID();
    const order = await this.prisma.responsibilityOrder.create({
      data: {
        id: orderId,
        organizationId,
        number: input.number.trim(),
        date,
        responsibilityType: input.responsibilityType,
        title: input.title.trim(),
        basis: input.basis.trim(),
        notes: input.notes?.trim() || null,
        scopeType,
        branchId: scope.branchId,
        departmentId: scope.departmentId,
        workSiteId: scope.workSiteId,
        status: "DRAFT",
        createdByUserId: user.userId,
        updatedByUserId: user.userId,
      },
    });

    await this.prisma.responsibilityAppointment.createMany({
      data: parsedAppointments.map((appointment) => ({
        organizationId,
        orderId,
        employeeId: appointment.employeeId,
        responsibilityType: input.responsibilityType,
        scopeType,
        branchId: scope.branchId,
        departmentId: scope.departmentId,
        workSiteId: scope.workSiteId,
        effectiveFrom: appointment.effectiveFrom,
        effectiveTo: appointment.effectiveTo,
        zoneOfResponsibility: appointment.zoneOfResponsibility,
        roleNotes: appointment.roleNotes,
      })),
    });

    const payloadJson = this.buildPayload({
      orderId,
      number: order.number,
      date,
      responsibilityType: order.responsibilityType,
      title: order.title,
      basis: order.basis,
      notes: order.notes,
      scopeType,
      branchId: scope.branchId,
      departmentId: scope.departmentId,
      workSiteId: scope.workSiteId,
      appointments: parsedAppointments,
    });
    const renderedHash = hashDocumentPayload(JSON.stringify(payloadJson));
    const envelope = await this.corePlatformService.createDocumentEnvelope(user, {
      documentKind: "ORDER",
      scope: {
        organizationId,
        branchId: scope.branchId,
        departmentId: scope.departmentId,
        workSiteId: scope.workSiteId,
      },
      businessObjectType: "RESPONSIBILITY_ORDER",
      businessObjectId: order.id,
      documentNumber: order.number,
      title: this.responsibilityOrderDocumentTitle(order.number, order.title),
      status: "DRAFT",
    });
    const version = await this.corePlatformService.createDocumentVersion(user, {
      envelopeId: envelope.id,
      payloadJson,
      renderedHash,
      changeReason: "Created responsibility order draft.",
      status: "DRAFT",
    });

    await this.prisma.responsibilityOrder.update({
      where: { id: order.id },
      data: {
        documentEnvelopeId: envelope.id,
        currentVersionId: version.id,
        currentVersionNo: version.versionNo,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: organizationId,
      action: "responsibility_order.created",
      entityType: "ResponsibilityOrder",
      entityId: order.id,
      metadata: {
        number: order.number,
        responsibilityType: order.responsibilityType,
        appointmentCount: parsedAppointments.length,
      },
    });

    return this.findOne(user, order.id);
  }

  async update(user: AuthenticatedUser, id: string, input: UpdateResponsibilityOrderInput) {
    const existing = await this.findRawById(id);
    assertOrganizationAccess(user, existing.organizationId);
    this.ensureEditableDraft(existing);

    const number = input.number?.trim() ?? existing.number;
    const date = input.date ? this.parseRequiredDate(input.date, "order date") : existing.date;
    const responsibilityType = input.responsibilityType ?? existing.responsibilityType;
    const title = input.title?.trim() ?? existing.title;
    const basis = input.basis?.trim() ?? existing.basis;
    const notes = input.notes === undefined ? existing.notes : input.notes?.trim() || null;
    const scope = {
      branchId: input.branchId === undefined ? existing.branchId : input.branchId ?? null,
      departmentId:
        input.departmentId === undefined ? existing.departmentId : input.departmentId ?? null,
      workSiteId: input.workSiteId === undefined ? existing.workSiteId : input.workSiteId ?? null,
    };
    const scopeType = this.resolveScopeType(scope);
    const parsedAppointments = await this.validateScopeAndAppointments({
      organizationId: existing.organizationId,
      scope,
      appointments:
        input.appointments ??
        existing.appointments.map((appointment) => ({
          employeeId: appointment.employeeId,
          effectiveFrom: appointment.effectiveFrom.toISOString(),
          effectiveTo: appointment.effectiveTo?.toISOString() ?? null,
          zoneOfResponsibility: appointment.zoneOfResponsibility ?? null,
          roleNotes: appointment.roleNotes ?? null,
        })),
    });
    const payloadJson = this.buildPayload({
      orderId: existing.id,
      number,
      date,
      responsibilityType,
      title,
      basis,
      notes,
      scopeType,
      branchId: scope.branchId,
      departmentId: scope.departmentId,
      workSiteId: scope.workSiteId,
      appointments: parsedAppointments,
      replacesOrderId: existing.replacesOrderId,
    });
    const renderedHash = hashDocumentPayload(JSON.stringify(payloadJson));

    let envelopeId = existing.documentEnvelopeId;

    if (!envelopeId) {
      const envelope = await this.corePlatformService.createDocumentEnvelope(user, {
        documentKind: "ORDER",
        scope: {
          organizationId: existing.organizationId,
          branchId: scope.branchId,
          departmentId: scope.departmentId,
          workSiteId: scope.workSiteId,
        },
        businessObjectType: "RESPONSIBILITY_ORDER",
        businessObjectId: existing.id,
        documentNumber: number,
        title: this.responsibilityOrderDocumentTitle(number, title),
        status: "DRAFT",
      });

      envelopeId = envelope.id;
    }

    const version = await this.corePlatformService.createDocumentVersion(user, {
      envelopeId,
      payloadJson,
      renderedHash,
      changeReason: "Updated responsibility order draft revision.",
      status: "DRAFT",
    });

    await this.prisma.$transaction(async (transaction) => {
      await transaction.responsibilityOrder.update({
        where: { id: existing.id },
        data: {
          number,
          date,
          responsibilityType,
          title,
          basis,
          notes,
          scopeType,
          branchId: scope.branchId,
          departmentId: scope.departmentId,
          workSiteId: scope.workSiteId,
          status: "DRAFT",
          documentEnvelopeId: envelopeId,
          currentVersionId: version.id,
          currentVersionNo: version.versionNo,
          updatedByUserId: user.userId,
        },
      });

      await transaction.responsibilityAppointment.deleteMany({
        where: { orderId: existing.id },
      });

      await transaction.responsibilityAppointment.createMany({
        data: parsedAppointments.map((appointment) => ({
          organizationId: existing.organizationId,
          orderId: existing.id,
          employeeId: appointment.employeeId,
          responsibilityType,
          scopeType,
          branchId: scope.branchId,
          departmentId: scope.departmentId,
          workSiteId: scope.workSiteId,
          effectiveFrom: appointment.effectiveFrom,
          effectiveTo: appointment.effectiveTo,
          zoneOfResponsibility: appointment.zoneOfResponsibility,
          roleNotes: appointment.roleNotes,
        })),
      });
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: existing.organizationId,
      action: "responsibility_order.updated",
      entityType: "ResponsibilityOrder",
      entityId: existing.id,
      metadata: {
        number,
        responsibilityType,
        appointmentCount: parsedAppointments.length,
      },
    });

    return this.findOne(user, existing.id);
  }

  async prepareForSigning(
    user: AuthenticatedUser,
    id: string,
    _input: PrepareResponsibilityOrderForSigningInput = {},
  ) {
    const existing = await this.findRawById(id);
    assertOrganizationAccess(user, existing.organizationId);

    const alreadyPrepared =
      existing.status === "SIGNING_READY" &&
      existing.documentEnvelope?.status === "SIGNING_READY" &&
      existing.documentEnvelope.currentVersion?.status === "FINAL";

    if (!alreadyPrepared) {
      this.ensureEditableDraft(existing);
    }

    const conflictSummary = await this.buildConflictSummary(existing);

    if (conflictSummary.blocking) {
      throw new BadRequestException(this.buildConflictMessage(conflictSummary));
    }

    const parsedAppointments = existing.appointments.map((appointment) => ({
      employeeId: appointment.employeeId,
      employee: {
        id: appointment.employee.id,
        fullName: appointment.employee.fullName,
        employeeNumber: appointment.employee.employeeNumber,
        jobTitle: appointment.employee.jobTitle,
        departmentId: appointment.employee.departmentId,
      },
      effectiveFrom: appointment.effectiveFrom,
      effectiveTo: appointment.effectiveTo,
      zoneOfResponsibility: appointment.zoneOfResponsibility ?? null,
      roleNotes: appointment.roleNotes ?? null,
    }));
    const payloadJson = this.buildPayload({
      orderId: existing.id,
      number: existing.number,
      date: existing.date,
      responsibilityType: existing.responsibilityType,
      title: existing.title,
      basis: existing.basis,
      notes: existing.notes ?? null,
      scopeType: existing.scopeType,
      branchId: existing.branchId,
      departmentId: existing.departmentId,
      workSiteId: existing.workSiteId,
      appointments: parsedAppointments,
      replacesOrderId: existing.replacesOrderId,
    });
    const renderedHash = hashDocumentPayload(JSON.stringify(payloadJson));
    let envelopeId = existing.documentEnvelopeId;

    if (!envelopeId) {
      const envelope = await this.corePlatformService.createDocumentEnvelope(user, {
        documentKind: "ORDER",
        scope: {
          organizationId: existing.organizationId,
          branchId: existing.branchId,
          departmentId: existing.departmentId,
          workSiteId: existing.workSiteId,
        },
        businessObjectType: "RESPONSIBILITY_ORDER",
        businessObjectId: existing.id,
        documentNumber: existing.number,
        title: this.responsibilityOrderDocumentTitle(existing.number, existing.title),
        status: "DRAFT",
      });

      envelopeId = envelope.id;
    }

    const version = await this.corePlatformService.createDocumentVersion(user, {
      envelopeId,
      payloadJson,
      renderedHash,
      changeReason: "Prepared responsibility order for signing.",
      status: "FINAL",
    });

    await this.prisma.responsibilityOrder.update({
      where: { id: existing.id },
      data: {
        status: "SIGNING_READY",
        documentEnvelopeId: envelopeId,
        currentVersionId: version.id,
        currentVersionNo: version.versionNo,
        updatedByUserId: user.userId,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: existing.organizationId,
      action: "responsibility_order.ready_for_signing",
      entityType: "ResponsibilityOrder",
      entityId: existing.id,
      metadata: {
        envelopeId,
        versionId: version.id,
      },
    });

    const prepared = await this.findOne(user, id);
    const signingConfig = this.getSigningRuntimeConfig();

    if (!prepared.signingDigest || !prepared.documentEnvelopeId || !prepared.currentVersionId) {
      throw new BadRequestException("Signing contract is not available after preparation.");
    }

    if (!prepared.currentVersionNo) {
      throw new BadRequestException("Order version number is not available after preparation.");
    }

    return {
      order: prepared,
      envelopeId: prepared.documentEnvelopeId,
      versionId: prepared.currentVersionId,
      versionNo: prepared.currentVersionNo,
      digest: prepared.signingDigest,
      allowedActions: prepared.allowedActions,
      contract: {
        mode: "ORGANIZATION" as const,
        requiresExternalSignature: true,
        documentHash: prepared.signingDigest,
        provider: signingConfig.isConfigured ? signingConfig.provider : null,
        signRole: "RESPONSIBILITY_ORDER_SIGNER" as const,
        bridgeContext: {
          responsibilityOrderId: prepared.id,
          documentNumber: prepared.number,
        },
      },
    };
  }

  async sign(
    user: AuthenticatedUser,
    id: string,
    input?: SignResponsibilityOrderInput,
    context?: RequestContext,
  ) {
    const order = await this.findRawById(id);
    assertOrganizationAccess(user, order.organizationId);

    const envelope = order.documentEnvelope;
    const currentVersion = envelope?.currentVersion;

    if (!envelope || !currentVersion) {
      throw new BadRequestException(
        "Responsibility order is not prepared in the canonical document flow.",
      );
    }

    const conflictSummary = await this.buildConflictSummary(order);

    if (conflictSummary.blocking) {
      throw new BadRequestException(this.buildConflictMessage(conflictSummary));
    }

    if (!this.buildAllowedActions(order, conflictSummary).canSign) {
      throw new BadRequestException("Responsibility order must be prepared for signing first.");
    }

    const signingResult = this.resolveSigningResult(order, input);
    const certificateMetadata = this.isNcalayerPayload(input)
      ? await this.ensureCertificateMetadata(order.organizationId, input)
      : null;
    const signaturePayload = {
      subjectType: "RESPONSIBILITY_ORDER",
      subjectId: order.id,
      source: "RESPONSIBILITY_ORDER_REGISTRY",
      signingContext: {
        responsibilityOrderId: order.id,
        documentNumber: envelope.documentNumber,
        versionId: currentVersion.id,
      },
      requestContext: {
        ipAddress: context?.ipAddress ?? null,
        userAgent: context?.userAgent ?? null,
      },
      providerPayload: signingResult.payload as Prisma.JsonValue,
    } as Prisma.JsonObject;
    const signatureHash = this.buildSignatureHash(
      input,
      signingResult.payload as Prisma.InputJsonValue,
    );

    const signature = await this.corePlatformService.createSignature(user, {
      envelopeId: envelope.id,
      versionId: currentVersion.id,
      companyId: order.organizationId,
      organizationId: order.organizationId,
      briefingRecordId: null,
      signerUserId: user.userId,
      signerEmployeeId: null,
      signerRole: user.role,
      provider: signingResult.provider,
      signerName: signingResult.signerName,
      signerIinMasked: signingResult.signerIinMasked,
      certificateSerial: signingResult.certificateSerial,
      certificateMetadataId: certificateMetadata?.id ?? null,
      documentHash: signingResult.documentHash,
      signatureHash,
      signedAt: signingResult.signedAt.toISOString(),
      status: "SIGNED",
      payload: signaturePayload as never,
    });

    const resolvedRetention = await this.corePlatformService.ensureRetentionPolicyResolved(user, {
      organizationId: order.organizationId,
      documentKind: "ORDER",
      scopeType: envelope.scopeType,
      effectiveAt: signingResult.signedAt.toISOString(),
    });

    if (!resolvedRetention) {
      throw new BadRequestException(
        "Retention policy could not be resolved for the responsibility order.",
      );
    }

    const archiveRecord = await this.corePlatformService.createArchiveRecord(user, {
      organizationId: order.organizationId,
      envelopeId: envelope.id,
      versionId: currentVersion.id,
      retentionPolicyId: resolvedRetention.policy.id,
      status: "SEALED",
      sealedAt: signingResult.signedAt.toISOString(),
      archiveManifestHash: signature.signatureHash ?? signature.documentHash,
      storageUri: null,
    });

    const evidencePackage = await this.corePlatformService.buildEvidencePackage(user, envelope.id);

    await this.prisma.signatureVerification.update({
      where: { signatureId: signature.id },
      data: {
        checkedAt: new Date(),
        evidenceJson: {
          subjectType: "RESPONSIBILITY_ORDER",
          subjectId: order.id,
          envelopeId: envelope.id,
          versionId: currentVersion.id,
          provider: signature.provider,
          certificateSerial: signature.certificateSerial,
          documentHash: signature.documentHash,
          signatureHash: signature.signatureHash ?? null,
          archiveRecordId: archiveRecord.id,
          archiveManifestHash: archiveRecord.archiveManifestHash,
          retentionPolicyId: resolvedRetention.policy.id,
          retentionCode: resolvedRetention.policy.retentionCode,
          retentionSource: resolvedRetention.source,
          evidencePackage: {
            generatedAt: evidencePackage.generatedAt.toISOString(),
            canonicalStatus: evidencePackage.document.canonicalStatus,
            currentVersionId: evidencePackage.document.currentVersionId ?? null,
            signatureCount: evidencePackage.signatures.length,
            archiveRecordCount: evidencePackage.archiveRecords.length,
            exportSnapshotCount: evidencePackage.exportSnapshots.length,
          },
        } as Prisma.JsonObject,
      },
    });

    const sourceOrder = order.replacesOrderId
      ? await this.prisma.responsibilityOrder.findUnique({
          where: { id: order.replacesOrderId },
          include: {
            appointments: true,
          },
        })
      : null;

    await this.prisma.$transaction(async (transaction) => {
      await transaction.responsibilityOrder.update({
        where: { id: order.id },
        data: {
          status: "SIGNED",
          signedAt: signingResult.signedAt,
          archiveRecordId: archiveRecord.id,
          retentionPolicyId: resolvedRetention.policy.id,
          currentVersionId: currentVersion.id,
          currentVersionNo: currentVersion.versionNo,
          updatedByUserId: user.userId,
        },
      });

      if (sourceOrder?.documentEnvelopeId) {
        await transaction.responsibilityOrder.update({
          where: { id: sourceOrder.id },
          data: {
            status: "SUPERSEDED",
            updatedByUserId: user.userId,
          },
        });

        await transaction.documentEnvelope.update({
          where: { id: sourceOrder.documentEnvelopeId },
          data: {
            status: "SUPERSEDED",
          },
        });

        if (sourceOrder.currentVersionId) {
          await transaction.documentVersion.update({
            where: { id: sourceOrder.currentVersionId },
            data: {
              effectiveTo: signingResult.signedAt,
            },
          });
        }
      }
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: order.organizationId,
      action: "responsibility_order.signed",
      entityType: "ResponsibilityOrder",
      entityId: order.id,
      metadata: {
        envelopeId: envelope.id,
        signatureId: signature.id,
        archiveRecordId: archiveRecord.id,
        archiveRetentionCode: resolvedRetention.policy.retentionCode,
        archiveRetentionSource: resolvedRetention.source,
        evidenceSignatureCount: evidencePackage.signatures.length,
        evidenceArchiveRecordCount: evidencePackage.archiveRecords.length,
        replacesOrderId: order.replacesOrderId ?? null,
      },
    });

    if (sourceOrder) {
      await this.auditService.log({
        actorUserId: user.userId,
        companyId: sourceOrder.organizationId,
        action: "responsibility_order.superseded",
        entityType: "ResponsibilityOrder",
        entityId: sourceOrder.id,
        metadata: {
          supersededByOrderId: order.id,
        },
      });
    }

    await this.recalculateEmployees(user, [
      ...order.appointments.map((appointment) => appointment.employeeId),
      ...(sourceOrder?.appointments.map((appointment) => appointment.employeeId) ?? []),
    ]);

    return this.findOne(user, id);
  }

  async annul(user: AuthenticatedUser, id: string, input: AnnulResponsibilityOrderInput) {
    const order = await this.findRawById(id);
    assertOrganizationAccess(user, order.organizationId);

    const envelope = order.documentEnvelope;
    const currentVersion = envelope?.currentVersion;

    if (!envelope || !currentVersion) {
      throw new BadRequestException("Canonical responsibility order revision is not available.");
    }

    const conflictSummary = await this.buildConflictSummary(order);

    if (!this.buildAllowedActions(order, conflictSummary).canAnnul) {
      throw new BadRequestException(
        "Only prepared or signed responsibility orders can be annulled.",
      );
    }

    const annulledAt = new Date();

    await this.prisma.$transaction(async (transaction) => {
      await transaction.documentVersion.update({
        where: { id: currentVersion.id },
        data: {
          status: "VOIDED",
          annulledAt,
        },
      });

      await transaction.documentEnvelope.update({
        where: { id: envelope.id },
        data: {
          status: "ANNULLED",
        },
      });

      await transaction.responsibilityOrder.update({
        where: { id: order.id },
        data: {
          status: "ANNULLED",
          annulReason: input.reason ?? null,
          updatedByUserId: user.userId,
        },
      });
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: order.organizationId,
      action: "responsibility_order.annulled",
      entityType: "ResponsibilityOrder",
      entityId: order.id,
      metadata: {
        envelopeId: envelope.id,
        reason: input.reason ?? null,
      },
    });

    await this.recalculateEmployees(
      user,
      order.appointments.map((appointment) => appointment.employeeId),
    );

    return this.findOne(user, id);
  }

  async replace(user: AuthenticatedUser, id: string, input: ReplaceResponsibilityOrderInput) {
    const sourceOrder = await this.findRawById(id);
    assertOrganizationAccess(user, sourceOrder.organizationId);

    const conflictSummary = await this.buildConflictSummary(sourceOrder);

    if (!this.buildAllowedActions(sourceOrder, conflictSummary).canReplace) {
      throw new BadRequestException("Only signed responsibility orders can be replaced.");
    }

    const created = await this.create(user, {
      organizationId: sourceOrder.organizationId,
      number: input.number,
      date: input.date,
      responsibilityType: input.responsibilityType,
      title: input.title,
      basis: input.basis,
      branchId: input.branchId ?? sourceOrder.branchId ?? null,
      departmentId: input.departmentId ?? sourceOrder.departmentId ?? null,
      workSiteId: input.workSiteId ?? sourceOrder.workSiteId ?? null,
      notes: input.notes ?? null,
      appointments: input.appointments,
      status: "DRAFT",
    });

    await this.prisma.responsibilityOrder.update({
      where: { id: created.id },
      data: {
        replacesOrderId: sourceOrder.id,
        updatedByUserId: user.userId,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: sourceOrder.organizationId,
      action: "responsibility_order.replacement_created",
      entityType: "ResponsibilityOrder",
      entityId: created.id,
      metadata: {
        replacesOrderId: sourceOrder.id,
        replacementReason: input.reason ?? null,
      },
    });

    return this.findOne(user, created.id);
  }

  async download(user: AuthenticatedUser, id: string) {
    const order = await this.findRawById(id);
    await this.ensureReadAccess(user, order);

    return this.pdfService.renderResponsibilityOrder({
      number: order.number,
      date: order.date,
      responsibilityType: order.responsibilityType,
      title: order.title,
      basis: order.basis,
      status: this.resolveReadStatus(order),
      notes: order.notes ?? null,
      branchName: order.branch?.name ?? null,
      departmentName: order.department?.name ?? null,
      workSiteName: order.workSite?.name ?? null,
      workSiteLocation: order.workSite?.location ?? null,
      appointments: order.appointments.map((appointment) => ({
        employeeName: appointment.employee.fullName,
        employeeNumber: appointment.employee.employeeNumber ?? null,
        employeeJobTitle: appointment.employee.jobTitle ?? null,
        effectiveFrom: appointment.effectiveFrom,
        effectiveTo: appointment.effectiveTo ?? null,
        zoneOfResponsibility: appointment.zoneOfResponsibility ?? null,
        roleNotes: appointment.roleNotes ?? null,
      })),
      signedAt: order.signedAt,
    });
  }

  async listAppointments(
    user: AuthenticatedUser,
    filters: ResponsibilityAppointmentFilters = {},
  ): Promise<ResponsibilityAppointmentReadModel[]> {
    const organizationId = requireOrganizationScope(user, filters.organizationId ?? null);
    const effectiveAt = filters.effectiveAt
      ? this.parseRequiredDate(filters.effectiveAt, "effectiveAt")
      : new Date();
    const appointments = await this.prisma.responsibilityAppointment.findMany({
      where: {
        organizationId,
        employeeId: filters.employeeId ?? undefined,
        responsibilityType: filters.responsibilityType ?? undefined,
        branchId: filters.branchId ?? undefined,
        departmentId: filters.departmentId ?? undefined,
        workSiteId: filters.workSiteId ?? undefined,
        order: {
          status: {
            notIn: ["DRAFT", "SIGNING_READY"],
          },
        },
      },
      include: {
        order: {
          include: {
            branch: true,
            department: true,
            workSite: true,
          },
        },
        employee: true,
        branch: true,
        department: true,
        workSite: true,
      },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    });

    const mapped = appointments.map((appointment) => {
      const effectiveFrom = appointment.effectiveFrom.getTime();
      const effectiveTo = appointment.effectiveTo?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const terminal =
        appointment.order.status === "ANNULLED" || appointment.order.status === "SUPERSEDED";
      const derivedStatus =
        terminal
          ? ("INACTIVE" as const)
          : effectiveTo < effectiveAt.getTime()
            ? ("EXPIRED" as const)
            : effectiveFrom > effectiveAt.getTime()
              ? ("INACTIVE" as const)
              : ("ACTIVE" as const);

      return {
        id: appointment.id,
        organizationId: appointment.organizationId,
        orderId: appointment.orderId,
        orderNumber: appointment.order.number,
        orderDate: appointment.order.date.toISOString(),
        orderStatus: this.resolveReadStatusFromOrderSnapshot({
          status: appointment.order.status,
          appointments: [
            {
              effectiveFrom: appointment.effectiveFrom,
              effectiveTo: appointment.effectiveTo ?? null,
            },
          ],
        }),
        responsibilityType: appointment.responsibilityType,
        scopeType: appointment.scopeType,
        branchId: appointment.branchId ?? null,
        departmentId: appointment.departmentId ?? null,
        workSiteId: appointment.workSiteId ?? null,
        branch: this.mapScopeRef(appointment.branch),
        department: this.mapScopeRef(appointment.department),
        workSite: this.mapScopeRef(appointment.workSite),
        employeeId: appointment.employeeId,
        employeeName: appointment.employee.fullName,
        employeeNumber: appointment.employee.employeeNumber ?? null,
        employeeJobTitle: appointment.employee.jobTitle ?? null,
        effectiveFrom: appointment.effectiveFrom.toISOString(),
        effectiveTo: appointment.effectiveTo?.toISOString() ?? null,
        zoneOfResponsibility: appointment.zoneOfResponsibility ?? null,
        roleNotes: appointment.roleNotes ?? null,
        active: derivedStatus === "ACTIVE",
        derivedStatus,
        documentEnvelopeId: appointment.order.documentEnvelopeId ?? null,
        signedAt: this.toIsoString(appointment.order.signedAt),
      };
    });

    if (!filters.status) {
      return mapped;
    }

    return mapped.filter((appointment) => appointment.derivedStatus === filters.status);
  }

  async listMy(user: AuthenticatedUser): Promise<MyResponsibilityOrderItem[]> {
    const employee = await this.requireEmployeeAccount(user);
    const orders = await this.prisma.responsibilityOrder.findMany({
      where: {
        organizationId: employee.companyId,
        status: {
          notIn: ["DRAFT", "SIGNING_READY"],
        },
        appointments: {
          some: {
            employeeId: employee.id,
          },
        },
      },
      include: responsibilityOrderInclude,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
    const mapped = await Promise.all(orders.map((order) => this.mapOrder(order)));

    return mapped.map((order) => ({
      id: order.id,
      number: order.number,
      date: order.date,
      responsibilityType: order.responsibilityType,
      title: order.title,
      basis: order.basis,
      status: order.status,
      documentEnvelopeId: order.documentEnvelopeId,
      signedAt: order.signedAt,
      evidenceAvailable: order.evidenceAvailable,
      archiveRecordSummary: order.archiveRecordSummary,
      branch: order.branch,
      department: order.department,
      workSite: order.workSite,
      appointments: order.appointments.filter(
        (appointment) => appointment.employeeId === employee.id,
      ),
    }));
  }
}
