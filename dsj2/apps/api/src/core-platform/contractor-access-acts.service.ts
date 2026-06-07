import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  ContractorAccessActListFilter,
  ContractorAccessActReasonInput,
  ContractorAccessActWorkflowInput,
  CreateContractorAccessActInput,
  UpdateContractorAccessActInput,
} from "@dsj/types";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import {
  assertOrganizationAccess,
  requireOrganizationScope,
} from "../common/utils/tenant-scope";
import { PrismaService } from "../database/prisma.service";
import { canonicalPermitPayloadHash } from "./permit-hash";
import { CorePlatformService } from "./core-platform.service";

const APPENDIX_3_LEGAL_BASIS =
  "Приказ МТСЗН РК от 28.08.2020 №344, Приложение 3";
const APPENDIX_3_LEGAL_BASIS_VERSION = "KZ_ORDER_344_APPENDIX_3";
const APPENDIX_3_EFFECTIVE_DATE = new Date("2020-08-28T00:00:00.000Z");

const actInclude = {
  branch: true,
  workSite: true,
  contractorOrganization: true,
  contractorRepresentative: true,
  hostRepresentativeEmployee: true,
  hostUnitChiefEmployee: true,
  documentEnvelope: {
    include: {
      currentVersion: true,
      archiveRecords: {
        orderBy: { createdAt: "desc" as const },
        include: { retentionPolicy: true },
      },
    },
  },
  currentVersion: true,
  archiveRecord: {
    include: { retentionPolicy: true },
  },
  workPermits: {
    select: {
      id: true,
      permitCode: true,
      journalRegistrationNumber: true,
      status: true,
      effectiveFrom: true,
      effectiveTo: true,
      contractorOrganizationId: true,
    },
    orderBy: { createdAt: "desc" as const },
  },
} satisfies Prisma.ContractorAccessActInclude;

type ActWithDetails = Prisma.ContractorAccessActGetPayload<{
  include: typeof actInclude;
}>;

type ActTransaction = Prisma.TransactionClient;

function canonicalHash(value: unknown) {
  return canonicalPermitPayloadHash(value);
}

@Injectable()
export class ContractorAccessActsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly corePlatformService: CorePlatformService,
  ) {}

  private isAdmin(user: AuthenticatedUser) {
    return ["SUPER_ADMIN", "COMPANY_ADMIN", "SAFETY_ENGINEER"].includes(
      user.role,
    );
  }

  private async actorEmployeeId(user: AuthenticatedUser, organizationId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        companyId: organizationId,
        userId: user.userId,
        status: "active",
        isArchived: false,
      },
      select: { id: true },
    });
    return employee?.id ?? null;
  }

  private async findAct(id: string) {
    const act = await this.prisma.contractorAccessAct.findUnique({
      where: { id },
      include: actInclude,
    });
    if (!act) {
      throw new NotFoundException("Contractor access act not found.");
    }
    return act;
  }

  private participantWhere(employeeId: string): Prisma.WorkPermitWhereInput {
    return {
      OR: [
        { issuerEmployeeId: employeeId },
        { responsibleManagerEmployeeId: employeeId },
        { workProducerEmployeeId: employeeId },
        { admitterEmployeeId: employeeId },
        {
          brigades: {
            some: {
              members: {
                some: { employeeId },
              },
            },
          },
        },
      ],
    };
  }

  private async assertActAccess(user: AuthenticatedUser, act: ActWithDetails) {
    assertOrganizationAccess(user, act.organizationId);
    if (this.isAdmin(user)) return;
    if (user.role !== "EMPLOYEE_SIGNER") {
      throw new ForbiddenException("Contractor access act access is denied.");
    }

    const actorEmployeeId = await this.actorEmployeeId(user, act.organizationId);
    if (!actorEmployeeId) {
      throw new ForbiddenException("Contractor access act access is denied.");
    }
    if (
      act.hostRepresentativeEmployeeId === actorEmployeeId ||
      act.hostUnitChiefEmployeeId === actorEmployeeId
    ) {
      return;
    }

    const linkedPermit = await this.prisma.workPermit.findFirst({
      where: {
        organizationId: act.organizationId,
        contractorAccessActId: act.id,
        ...this.participantWhere(actorEmployeeId),
      },
      select: { id: true },
    });
    if (!linkedPermit) {
      throw new ForbiddenException("Contractor access act access is denied.");
    }
  }

  private dateRange(input: { validFrom: string; validTo: string }) {
    const validFrom = new Date(input.validFrom);
    const validTo = new Date(input.validTo);
    if (
      Number.isNaN(validFrom.getTime()) ||
      Number.isNaN(validTo.getTime()) ||
      validTo.getTime() <= validFrom.getTime()
    ) {
      throw new BadRequestException("Act validTo must be after validFrom.");
    }
    return { validFrom, validTo };
  }

  private async validateReferences(
    organizationId: string,
    input: Pick<
      CreateContractorAccessActInput,
      | "branchId"
      | "departmentId"
      | "workSiteId"
      | "contractorOrganizationId"
      | "contractorRepresentativeId"
      | "hostRepresentativeEmployeeId"
      | "hostUnitChiefEmployeeId"
      | "validFrom"
      | "validTo"
    >,
  ) {
    const { validFrom, validTo } = this.dateRange(input);
    const employeeIds = [
      input.hostRepresentativeEmployeeId,
      input.hostUnitChiefEmployeeId,
    ].filter((id): id is string => Boolean(id));

    const [contractor, representative, employees, branch, department, workSite] =
      await Promise.all([
        this.prisma.contractorOrganization.findFirst({
          where: {
            id: input.contractorOrganizationId,
            organizationId,
            isActive: true,
          },
          select: { id: true },
        }),
        input.contractorRepresentativeId
          ? this.prisma.contractorWorker.findFirst({
              where: {
                id: input.contractorRepresentativeId,
                organizationId,
                isArchived: false,
              },
              select: {
                id: true,
                status: true,
                contractorOrganizationId: true,
              },
            })
          : null,
        employeeIds.length
          ? this.prisma.employee.findMany({
              where: {
                id: { in: employeeIds },
                companyId: organizationId,
                isArchived: false,
              },
              select: { id: true, status: true },
            })
          : [],
        input.branchId
          ? this.prisma.branch.findFirst({
              where: { id: input.branchId, organizationId, isActive: true },
              select: { id: true },
            })
          : null,
        input.departmentId
          ? this.prisma.department.findFirst({
              where: { id: input.departmentId, companyId: organizationId },
              select: { id: true },
            })
          : null,
        input.workSiteId
          ? this.prisma.workSite.findFirst({
              where: { id: input.workSiteId, organizationId, isActive: true },
              select: { id: true },
            })
          : null,
      ]);

    if (!contractor) {
      throw new BadRequestException(
        "Contractor does not belong to the organization.",
      );
    }
    if (
      representative &&
      (representative.status !== "active" ||
        representative.contractorOrganizationId !== input.contractorOrganizationId)
    ) {
      throw new BadRequestException(
        "Contractor representative must belong to the selected contractor.",
      );
    }
    if (input.contractorRepresentativeId && !representative) {
      throw new BadRequestException(
        "Contractor representative does not belong to the organization.",
      );
    }
    if (
      employees.length !== employeeIds.length ||
      employees.some((employee) => employee.status !== "active")
    ) {
      throw new BadRequestException(
        "Host representatives must be active organization employees.",
      );
    }
    if (input.branchId && !branch) {
      throw new BadRequestException(
        "Branch does not belong to the organization.",
      );
    }
    if (input.departmentId && !department) {
      throw new BadRequestException(
        "Department does not belong to the organization.",
      );
    }
    if (input.workSiteId && !workSite) {
      throw new BadRequestException(
        "Work site does not belong to the organization.",
      );
    }

    return { validFrom, validTo };
  }

  private payloadFromAct(act: {
    id: string;
    organizationId: string;
    actNumber: string;
    status: string;
    scopeType: string;
    branchId: string | null;
    departmentId: string | null;
    workSiteId: string | null;
    contractorOrganizationId: string;
    contractorRepresentativeId: string | null;
    hostRepresentativeEmployeeId: string | null;
    hostUnitChiefEmployeeId: string | null;
    workName: string;
    workDescription: string | null;
    workArea: string;
    workAreaBoundaries: string | null;
    workAreaCoordinates: unknown;
    validFrom: Date;
    validTo: Date;
    safetyMeasures: unknown;
    specialConditions: string | null;
  }) {
    return {
      source: "PERMIT_JOURNAL_UI_CANONICAL",
      documentType: "CONTRACTOR_ACCESS_ACT",
      legalBasis: APPENDIX_3_LEGAL_BASIS,
      legalBasisVersion: APPENDIX_3_LEGAL_BASIS_VERSION,
      legalBasisEffectiveDate: "2020-08-28",
      contractorAccessAct: {
        id: act.id,
        organizationId: act.organizationId,
        actNumber: act.actNumber,
        status: act.status,
        scopeType: act.scopeType,
        branchId: act.branchId,
        departmentId: act.departmentId,
        workSiteId: act.workSiteId,
        contractorOrganizationId: act.contractorOrganizationId,
        contractorRepresentativeId: act.contractorRepresentativeId,
        hostRepresentativeEmployeeId: act.hostRepresentativeEmployeeId,
        hostUnitChiefEmployeeId: act.hostUnitChiefEmployeeId,
        workName: act.workName,
        workDescription: act.workDescription,
        workArea: act.workArea,
        workAreaBoundaries: act.workAreaBoundaries,
        workAreaCoordinates: act.workAreaCoordinates,
        validFrom: act.validFrom.toISOString(),
        validTo: act.validTo.toISOString(),
        safetyMeasures: act.safetyMeasures,
        specialConditions: act.specialConditions,
      },
    };
  }

  private async appendDocumentVersion(
    transaction: ActTransaction,
    act: {
      id: string;
      documentEnvelopeId: string | null;
      validFrom: Date;
      validTo: Date;
    },
    payload: unknown,
    userId: string,
    status: "DRAFT" | "FINAL" = "DRAFT",
  ) {
    if (!act.documentEnvelopeId) {
      throw new BadRequestException(
        "Contractor access act document envelope is missing.",
      );
    }
    const latest = await transaction.documentVersion.findFirst({
      where: { envelopeId: act.documentEnvelopeId },
      orderBy: { versionNo: "desc" },
      select: { versionNo: true },
    });
    const versionNo = (latest?.versionNo ?? 0) + 1;
    const payloadHash = canonicalHash(payload);
    const version = await transaction.documentVersion.create({
      data: {
        envelopeId: act.documentEnvelopeId,
        versionNo,
        status,
        payloadJson: payload as Prisma.InputJsonValue,
        renderedHash: payloadHash,
        createdByUserId: userId,
        effectiveFrom: act.validFrom,
        effectiveTo: act.validTo,
      },
    });
    await transaction.documentEnvelope.update({
      where: { id: act.documentEnvelopeId },
      data: { currentVersionId: version.id },
    });
    await transaction.contractorAccessAct.update({
      where: { id: act.id },
      data: { currentVersionId: version.id, updatedByUserId: userId },
    });
    return version;
  }

  private duplicateActConflict(error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002"
    ) {
      throw new ConflictException(
        "Contractor access act number already exists in this organization.",
      );
    }
    throw error;
  }

  async list(user: AuthenticatedUser, filters: ContractorAccessActListFilter) {
    const organizationId = requireOrganizationScope(
      user,
      filters.organizationId ?? filters.companyId ?? null,
    );
    const where: Prisma.ContractorAccessActWhereInput = {
      organizationId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.contractorOrganizationId
        ? { contractorOrganizationId: filters.contractorOrganizationId }
        : {}),
      ...(filters.workSiteId ? { workSiteId: filters.workSiteId } : {}),
      ...(filters.activeOnly ? { status: "ACTIVE" } : {}),
      ...(filters.archivedOnly ? { status: "ARCHIVED" } : {}),
      ...(filters.dateFrom
        ? { validTo: { gte: new Date(filters.dateFrom) } }
        : {}),
      ...(filters.dateTo ? { validFrom: { lte: new Date(filters.dateTo) } } : {}),
    };

    if (user.role === "EMPLOYEE_SIGNER") {
      const employeeId = await this.actorEmployeeId(user, organizationId);
      if (!employeeId) {
        return { items: [], total: 0, page: filters.page, pageSize: filters.pageSize };
      }
      where.OR = [
        { hostRepresentativeEmployeeId: employeeId },
        { hostUnitChiefEmployeeId: employeeId },
        {
          workPermits: {
            some: this.participantWhere(employeeId),
          },
        },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.contractorAccessAct.findMany({
        where,
        include: actInclude,
        orderBy: [{ createdAt: "desc" }],
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.prisma.contractorAccessAct.count({ where }),
    ]);
    return { items, total, page: filters.page, pageSize: filters.pageSize };
  }

  async get(user: AuthenticatedUser, id: string) {
    const act = await this.findAct(id);
    await this.assertActAccess(user, act);
    return act;
  }

  async create(user: AuthenticatedUser, input: CreateContractorAccessActInput) {
    const organizationId = requireOrganizationScope(
      user,
      input.organizationId ?? null,
    );
    const dates = await this.validateReferences(organizationId, input);
    const id = randomUUID();
    const envelopeId = randomUUID();
    const versionId = randomUUID();
    const draft = {
      id,
      organizationId,
      actNumber: input.actNumber,
      status: "DRAFT" as const,
      scopeType: input.scopeType,
      branchId: input.branchId ?? null,
      departmentId: input.departmentId ?? null,
      workSiteId: input.workSiteId ?? null,
      contractorOrganizationId: input.contractorOrganizationId,
      contractorRepresentativeId: input.contractorRepresentativeId ?? null,
      hostRepresentativeEmployeeId: input.hostRepresentativeEmployeeId ?? null,
      hostUnitChiefEmployeeId: input.hostUnitChiefEmployeeId ?? null,
      workName: input.workName,
      workDescription: input.workDescription ?? null,
      workArea: input.workArea,
      workAreaBoundaries: input.workAreaBoundaries ?? null,
      workAreaCoordinates: input.workAreaCoordinates ?? null,
      validFrom: dates.validFrom,
      validTo: dates.validTo,
      safetyMeasures: input.safetyMeasures,
      specialConditions: input.specialConditions ?? null,
    };
    const payload = this.payloadFromAct(draft);
    const payloadHash = canonicalHash(payload);

    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.documentEnvelope.create({
          data: {
            id: envelopeId,
            organizationId,
            documentKind: "CONTRACTOR_ACCESS_ACT",
            scopeType: input.scopeType,
            branchId: input.branchId ?? null,
            departmentId: input.departmentId ?? null,
            workSiteId: input.workSiteId ?? null,
            businessObjectType: "ContractorAccessAct",
            businessObjectId: id,
            documentNumber: input.actNumber,
            title: input.workName,
            status: "DRAFT",
            createdByUserId: user.userId,
          },
        });
        await transaction.documentVersion.create({
          data: {
            id: versionId,
            envelopeId,
            versionNo: 1,
            status: "DRAFT",
            payloadJson: payload as Prisma.InputJsonValue,
            renderedHash: payloadHash,
            createdByUserId: user.userId,
            effectiveFrom: dates.validFrom,
            effectiveTo: dates.validTo,
          },
        });
        await transaction.contractorAccessAct.create({
          data: {
            ...draft,
            safetyMeasures: input.safetyMeasures as Prisma.InputJsonValue,
            workAreaCoordinates:
              input.workAreaCoordinates === undefined
                ? Prisma.JsonNull
                : (input.workAreaCoordinates as Prisma.InputJsonValue),
            legalBasis: APPENDIX_3_LEGAL_BASIS,
            legalBasisVersion: APPENDIX_3_LEGAL_BASIS_VERSION,
            legalBasisEffectiveDate: APPENDIX_3_EFFECTIVE_DATE,
            documentEnvelopeId: envelopeId,
            currentVersionId: versionId,
            createdByUserId: user.userId,
            updatedByUserId: user.userId,
          },
        });
        await transaction.documentEnvelope.update({
          where: { id: envelopeId },
          data: { currentVersionId: versionId },
        });
      });
    } catch (error) {
      this.duplicateActConflict(error);
    }

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: organizationId,
      action: "contractor_access_act.created",
      entityType: "ContractorAccessAct",
      entityId: id,
      metadata: { payloadHash },
    });
    return this.get(user, id);
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    input: UpdateContractorAccessActInput,
  ) {
    const act = await this.findAct(id);
    await this.assertActAccess(user, act);
    if (act.status !== "DRAFT") {
      throw new ConflictException(
        "Only draft contractor access acts can be edited.",
      );
    }
    const merged = {
      actNumber: input.actNumber ?? act.actNumber,
      scopeType: input.scopeType ?? act.scopeType,
      branchId: input.branchId === undefined ? act.branchId : input.branchId,
      departmentId:
        input.departmentId === undefined ? act.departmentId : input.departmentId,
      workSiteId:
        input.workSiteId === undefined ? act.workSiteId : input.workSiteId,
      contractorOrganizationId:
        input.contractorOrganizationId ?? act.contractorOrganizationId,
      contractorRepresentativeId:
        input.contractorRepresentativeId === undefined
          ? act.contractorRepresentativeId
          : input.contractorRepresentativeId,
      hostRepresentativeEmployeeId:
        input.hostRepresentativeEmployeeId === undefined
          ? act.hostRepresentativeEmployeeId
          : input.hostRepresentativeEmployeeId,
      hostUnitChiefEmployeeId:
        input.hostUnitChiefEmployeeId === undefined
          ? act.hostUnitChiefEmployeeId
          : input.hostUnitChiefEmployeeId,
      workName: input.workName ?? act.workName,
      workDescription:
        input.workDescription === undefined
          ? act.workDescription
          : input.workDescription,
      workArea: input.workArea ?? act.workArea,
      workAreaBoundaries:
        input.workAreaBoundaries === undefined
          ? act.workAreaBoundaries
          : input.workAreaBoundaries,
      workAreaCoordinates:
        input.workAreaCoordinates === undefined
          ? act.workAreaCoordinates
          : input.workAreaCoordinates,
      validFrom: input.validFrom ?? act.validFrom.toISOString(),
      validTo: input.validTo ?? act.validTo.toISOString(),
      safetyMeasures: input.safetyMeasures ?? (act.safetyMeasures as string[]),
      specialConditions:
        input.specialConditions === undefined
          ? act.specialConditions
          : input.specialConditions,
    } satisfies CreateContractorAccessActInput;
    const dates = await this.validateReferences(act.organizationId, merged);
    const draft = {
      id: act.id,
      organizationId: act.organizationId,
      status: "DRAFT",
      ...merged,
      branchId: merged.branchId ?? null,
      departmentId: merged.departmentId ?? null,
      workSiteId: merged.workSiteId ?? null,
      contractorRepresentativeId: merged.contractorRepresentativeId ?? null,
      hostRepresentativeEmployeeId: merged.hostRepresentativeEmployeeId ?? null,
      hostUnitChiefEmployeeId: merged.hostUnitChiefEmployeeId ?? null,
      workDescription: merged.workDescription ?? null,
      workAreaBoundaries: merged.workAreaBoundaries ?? null,
      workAreaCoordinates: merged.workAreaCoordinates ?? null,
      validFrom: dates.validFrom,
      validTo: dates.validTo,
      specialConditions: merged.specialConditions ?? null,
    };
    const payload = this.payloadFromAct(draft);

    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.contractorAccessAct.update({
          where: { id },
          data: {
            actNumber: merged.actNumber,
            scopeType: merged.scopeType,
            branchId: merged.branchId ?? null,
            departmentId: merged.departmentId ?? null,
            workSiteId: merged.workSiteId ?? null,
            contractorOrganizationId: merged.contractorOrganizationId,
            contractorRepresentativeId: merged.contractorRepresentativeId ?? null,
            hostRepresentativeEmployeeId:
              merged.hostRepresentativeEmployeeId ?? null,
            hostUnitChiefEmployeeId: merged.hostUnitChiefEmployeeId ?? null,
            workName: merged.workName,
            workDescription: merged.workDescription ?? null,
            workArea: merged.workArea,
            workAreaBoundaries: merged.workAreaBoundaries ?? null,
            workAreaCoordinates:
              merged.workAreaCoordinates === null ||
              merged.workAreaCoordinates === undefined
                ? Prisma.JsonNull
                : (merged.workAreaCoordinates as Prisma.InputJsonValue),
            validFrom: dates.validFrom,
            validTo: dates.validTo,
            safetyMeasures: merged.safetyMeasures as Prisma.InputJsonValue,
            specialConditions: merged.specialConditions ?? null,
            updatedByUserId: user.userId,
          },
        });
        if (act.documentEnvelopeId) {
          await transaction.documentEnvelope.update({
            where: { id: act.documentEnvelopeId },
            data: {
              scopeType: merged.scopeType,
              branchId: merged.branchId ?? null,
              departmentId: merged.departmentId ?? null,
              workSiteId: merged.workSiteId ?? null,
              documentNumber: merged.actNumber,
              title: merged.workName,
            },
          });
        }
        await this.appendDocumentVersion(
          transaction,
          { ...act, validFrom: dates.validFrom, validTo: dates.validTo },
          payload,
          user.userId,
        );
      });
    } catch (error) {
      this.duplicateActConflict(error);
    }

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: act.organizationId,
      action: "contractor_access_act.updated",
      entityType: "ContractorAccessAct",
      entityId: id,
      metadata: { payloadHash: canonicalHash(payload) },
    });
    return this.get(user, id);
  }

  async activate(
    user: AuthenticatedUser,
    id: string,
    _input: ContractorAccessActWorkflowInput,
  ) {
    const act = await this.findAct(id);
    await this.assertActAccess(user, act);
    if (act.status !== "DRAFT") {
      throw new ConflictException("Only draft contractor access acts can activate.");
    }
    this.dateRange({
      validFrom: act.validFrom.toISOString(),
      validTo: act.validTo.toISOString(),
    });
    await this.validateReferences(act.organizationId, {
      branchId: act.branchId,
      departmentId: act.departmentId,
      workSiteId: act.workSiteId,
      contractorOrganizationId: act.contractorOrganizationId,
      contractorRepresentativeId: act.contractorRepresentativeId,
      hostRepresentativeEmployeeId: act.hostRepresentativeEmployeeId,
      hostUnitChiefEmployeeId: act.hostUnitChiefEmployeeId,
      validFrom: act.validFrom.toISOString(),
      validTo: act.validTo.toISOString(),
    });
    await this.prisma.$transaction(async (transaction) => {
      if (act.currentVersionId) {
        await transaction.documentVersion.update({
          where: { id: act.currentVersionId },
          data: { status: "FINAL" },
        });
      }
      if (act.documentEnvelopeId) {
        await transaction.documentEnvelope.update({
          where: { id: act.documentEnvelopeId },
          data: { status: "ACTIVE" },
        });
      }
      await transaction.contractorAccessAct.update({
        where: { id },
        data: { status: "ACTIVE", updatedByUserId: user.userId },
      });
    });
    await this.auditService.log({
      actorUserId: user.userId,
      companyId: act.organizationId,
      action: "contractor_access_act.activated",
      entityType: "ContractorAccessAct",
      entityId: id,
    });
    return this.get(user, id);
  }

  async close(
    user: AuthenticatedUser,
    id: string,
    _input: ContractorAccessActWorkflowInput,
  ) {
    const act = await this.findAct(id);
    await this.assertActAccess(user, act);
    if (act.status !== "ACTIVE") {
      throw new ConflictException("Only active contractor access acts can close.");
    }
    await this.prisma.contractorAccessAct.update({
      where: { id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        updatedByUserId: user.userId,
      },
    });
    await this.auditService.log({
      actorUserId: user.userId,
      companyId: act.organizationId,
      action: "contractor_access_act.closed",
      entityType: "ContractorAccessAct",
      entityId: id,
    });
    return this.get(user, id);
  }

  async cancel(
    user: AuthenticatedUser,
    id: string,
    input: ContractorAccessActReasonInput,
  ) {
    const act = await this.findAct(id);
    await this.assertActAccess(user, act);
    if (!["DRAFT", "ACTIVE"].includes(act.status)) {
      throw new ConflictException(
        "Only draft or active contractor access acts can be cancelled.",
      );
    }
    await this.prisma.$transaction(async (transaction) => {
      if (act.documentEnvelopeId) {
        await transaction.documentEnvelope.update({
          where: { id: act.documentEnvelopeId },
          data: { status: "ANNULLED" },
        });
      }
      await transaction.contractorAccessAct.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: input.reason,
          updatedByUserId: user.userId,
        },
      });
    });
    await this.auditService.log({
      actorUserId: user.userId,
      companyId: act.organizationId,
      action: "contractor_access_act.cancelled",
      entityType: "ContractorAccessAct",
      entityId: id,
      metadata: { reason: input.reason },
    });
    return this.get(user, id);
  }

  async archive(user: AuthenticatedUser, id: string) {
    const act = await this.findAct(id);
    await this.assertActAccess(user, act);
    if (!["CLOSED", "CANCELLED"].includes(act.status)) {
      throw new ConflictException(
        "Only closed or cancelled contractor access acts can be archived.",
      );
    }
    if (!act.documentEnvelopeId || !act.currentVersionId) {
      throw new BadRequestException("Contractor access act document is incomplete.");
    }
    const effectiveAt = act.closedAt ?? act.cancelledAt ?? act.validTo;
    const resolved = await this.corePlatformService.ensureRetentionPolicyResolved(
      user,
      {
        organizationId: act.organizationId,
        documentKind: "CONTRACTOR_ACCESS_ACT",
        scopeType: act.scopeType,
        effectiveAt: effectiveAt.toISOString(),
      },
    );
    if (!resolved) {
      throw new BadRequestException("Retention policy could not be resolved.");
    }
    const now = new Date();
    const archiveRecord = await this.corePlatformService.createArchiveRecord(
      user,
      {
        organizationId: act.organizationId,
        envelopeId: act.documentEnvelopeId,
        versionId: act.currentVersionId,
        retentionPolicyId: resolved.policy.id,
        status: "ARCHIVED",
        sealedAt: effectiveAt.toISOString(),
        archivedAt: now.toISOString(),
        archiveManifestHash:
          act.currentVersion?.renderedHash ??
          canonicalHash(this.payloadFromAct(act)),
        storageUri: null,
      },
    );
    await this.prisma.$transaction(async (transaction) => {
      await transaction.documentEnvelope.update({
        where: { id: act.documentEnvelopeId! },
        data: { status: "ARCHIVED" },
      });
      await transaction.contractorAccessAct.update({
        where: { id },
        data: {
          status: "ARCHIVED",
          archivedAt: now,
          archiveRecordId: archiveRecord.id,
          retentionPolicyId: resolved.policy.id,
          updatedByUserId: user.userId,
        },
      });
    });
    await this.auditService.log({
      actorUserId: user.userId,
      companyId: act.organizationId,
      action: "contractor_access_act.archived",
      entityType: "ContractorAccessAct",
      entityId: id,
      metadata: { archiveRecordId: archiveRecord.id },
    });
    return this.get(user, id);
  }
}
