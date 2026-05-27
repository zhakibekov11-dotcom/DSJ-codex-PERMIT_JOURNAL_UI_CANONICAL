import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import type {
  AnnulProtocolInput,
  CreateProtocolInput,
  ProtocolFilters,
  PrepareProtocolForSigningInput,
  ReplaceProtocolInput,
  SignProtocolInput,
  UpdateProtocolInput,
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

const protocolInclude = Prisma.validator<Prisma.ProtocolInclude>()({
  branch: true,
  department: true,
  workSite: true,
  retentionPolicy: true,
  archiveRecord: {
    include: {
      retentionPolicy: true,
    },
  },
  replacesProtocol: {
    select: {
      id: true,
      number: true,
      status: true,
      signedAt: true,
    },
  },
  employees: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      employee: {
        include: {
          department: true,
        },
      },
    },
  },
  commissionMembers: {
    orderBy: [{ role: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
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

type RawProtocol = Prisma.ProtocolGetPayload<{
  include: typeof protocolInclude;
}>;

type RequestContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

type ScopeInput = {
  branchId?: string | null;
  departmentId?: string | null;
  workSiteId?: string | null;
};

type ProtocolHistorySummary = {
  totalEvents: number;
  lastAction: string | null;
  lastAt: string | null;
};

const PROTOCOL_HISTORY_EMPTY: ProtocolHistorySummary = {
  totalEvents: 0,
  lastAction: null,
  lastAt: null,
};

@Injectable()
export class ProtocolsService {
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

  private protocolTitle(number: string) {
    return `Protocol ${number}`;
  }

  private normalizeDocumentVersionStatus(
    status: "DRAFT" | "FINAL" | "SIGNED" | "VOIDED",
  ) {
    switch (status) {
      case "DRAFT":
        return "DRAFT" as const;
      case "FINAL":
        return "SIGNING_READY" as const;
      case "SIGNED":
        return "SIGNED" as const;
      case "VOIDED":
        return "ANNULLED" as const;
    }
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

  private isMockPayload(input: SignProtocolInput | undefined): input is Exclude<
    SignProtocolInput,
    { cms: string }
  > {
    return Boolean(input && typeof input === "object" && !("cms" in input));
  }

  private isNcalayerPayload(input: SignProtocolInput | undefined): input is Extract<
    NonNullable<SignProtocolInput>,
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

  private toCanonicalStatus(protocol: RawProtocol) {
    const envelope = protocol.documentEnvelope;

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

  private isImmutableSigned(protocol: RawProtocol) {
    return (
      protocol.documentEnvelope?.status === "SIGNED" ||
      protocol.documentEnvelope?.currentVersion?.status === "SIGNED"
    );
  }

  private isTerminalState(protocol: RawProtocol) {
    return (
      protocol.status === "ANNULLED" ||
      protocol.status === "SUPERSEDED" ||
      protocol.status === "EXPIRED" ||
      protocol.documentEnvelope?.status === "ANNULLED" ||
      protocol.documentEnvelope?.status === "SUPERSEDED" ||
      protocol.documentEnvelope?.status === "ARCHIVED"
    );
  }

  private hasEvidenceTrail(protocol: RawProtocol) {
    return Boolean(
      protocol.documentEnvelope &&
        ((protocol.documentEnvelope.signatures?.length ?? 0) > 0 ||
          (protocol.documentEnvelope.archiveRecords?.length ?? 0) > 0),
    );
  }

  private retentionSource(retentionPolicy: {
    retentionCode: string;
    legalBasis: string;
  } | null) {
    if (!retentionPolicy) {
      return "configured" as const;
    }

    return retentionPolicy.retentionCode === "PROTOCOL_10Y" ||
      retentionPolicy.legalBasis.startsWith("P0 baseline:")
      ? "baseline" as const
      : "configured" as const;
  }

  private buildAllowedActions(protocol: RawProtocol) {
    const envelope = protocol.documentEnvelope;
    const currentVersion = envelope?.currentVersion;
    const isSigned = this.isImmutableSigned(protocol);
    const isTerminal = this.isTerminalState(protocol);
    const isReadyForSigning =
      protocol.status === "SIGNING_READY" &&
      envelope?.status === "SIGNING_READY" &&
      currentVersion?.status === "FINAL";

    return {
      canEditDraft: protocol.status === "DRAFT" && !isSigned && !isTerminal,
      canPrepareSign: protocol.status === "DRAFT" && !isSigned && !isTerminal,
      canSign: Boolean(isReadyForSigning),
      canAnnul: Boolean(envelope && (isSigned || isReadyForSigning) && !isTerminal),
      canReplace: Boolean(protocol.status === "SIGNED" && !isTerminal),
      canDownloadEvidence: this.hasEvidenceTrail(protocol),
      canViewArchive: Boolean(protocol.archiveRecord ?? protocol.documentEnvelope?.archiveRecords[0]),
    };
  }

  private mapLegacyStatus(
    status: "DOPUSHEN" | "OGRANICHENNO_DOPUSHEN" | "NE_DOPUSHEN",
  ) {
    switch (status) {
      case "DOPUSHEN":
        return "admitted" as const;
      case "OGRANICHENNO_DOPUSHEN":
        return "limited" as const;
      case "NE_DOPUSHEN":
        return "blocked" as const;
    }
  }

  private buildProtocolPayload(args: {
    protocolId: string;
    number: string;
    date: Date;
    protocolType: string;
    basis: string;
    scopeType: "ORGANIZATION" | "BRANCH" | "DEPARTMENT" | "WORK_SITE";
    branchId?: string | null;
    departmentId?: string | null;
    workSiteId?: string | null;
    decision: string;
    notes?: string | null;
    employees: Array<{
      employeeId: string;
      fullName: string;
      employeeNumber?: string | null;
      jobTitle?: string | null;
    }>;
    commission: Array<{
      role: "CHAIRMAN" | "MEMBER";
      fullName: string;
      jobTitle?: string | null;
    }>;
    extra?: Prisma.JsonObject;
  }) {
    return {
      protocolId: args.protocolId,
      number: args.number,
      date: args.date.toISOString(),
      protocolType: args.protocolType,
      basis: args.basis,
      scopeType: args.scopeType,
      branchId: args.branchId ?? null,
      departmentId: args.departmentId ?? null,
      workSiteId: args.workSiteId ?? null,
      decision: args.decision,
      notes: args.notes ?? null,
      employees: args.employees,
      commission: args.commission,
      ...(args.extra ?? {}),
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
      },
      include: {
        department: true,
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

  private async validateScopeAndEmployees(args: {
    organizationId: string;
    scope: ScopeInput;
    employeeIds: string[];
  }) {
    await Promise.all([
      this.ensureBranchInOrganization(args.organizationId, args.scope.branchId ?? null),
      this.ensureDepartmentInOrganization(args.organizationId, args.scope.departmentId ?? null),
      this.ensureWorkSiteInOrganization(args.organizationId, args.scope.workSiteId ?? null),
    ]);

    return this.ensureEmployees(args.organizationId, args.employeeIds);
  }

  private buildCommissionRows(args: {
    chairman: {
      fullName: string;
      jobTitle?: string | null;
    };
    members: Array<{
      fullName: string;
      jobTitle?: string | null;
    }>;
  }) {
    const rows = [
      {
        role: "CHAIRMAN" as const,
        sortOrder: 0,
        fullName: args.chairman.fullName.trim(),
        jobTitle: args.chairman.jobTitle?.trim() || null,
      },
      ...args.members
        .map((member, index) => ({
          role: "MEMBER" as const,
          sortOrder: index + 1,
          fullName: member.fullName.trim(),
          jobTitle: member.jobTitle?.trim() || null,
        }))
        .filter((member) => member.fullName.length > 0),
    ];

    if (!rows[0]?.fullName) {
      throw new BadRequestException("Chairman is required.");
    }

    return rows;
  }

  private ensureEditableDraft(protocol: RawProtocol) {
    if (this.isImmutableSigned(protocol)) {
      throw new BadRequestException(
        "Signed protocols are immutable. Use replace or annul instead of editing the signed revision.",
      );
    }

    if (this.isTerminalState(protocol)) {
      throw new BadRequestException("Terminal protocols cannot be edited.");
    }

    if (protocol.status !== "DRAFT") {
      throw new BadRequestException("Only draft protocols can be edited.");
    }
  }

  private async ensureCertificateMetadata(
    organizationId: string,
    input: Extract<NonNullable<SignProtocolInput>, { cms: string }>,
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
    input: SignProtocolInput | undefined,
    payload: Prisma.InputJsonValue,
  ) {
    if (this.isNcalayerPayload(input)) {
      return hashDocumentPayload(input.cms);
    }

    return hashDocumentPayload(JSON.stringify(payload));
  }

  private resolveSigningResult(protocol: RawProtocol, input: SignProtocolInput | undefined) {
    const config = this.requireSigningRuntimeConfig();
    const documentHash = protocol.documentEnvelope?.currentVersion?.renderedHash ?? null;

    if (!documentHash) {
      throw new BadRequestException("Document digest is missing. Prepare the protocol for signing first.");
    }

    if (config.provider === "NCALAYER") {
      if (!this.isNcalayerPayload(input)) {
        throw new BadRequestException("NCALayer signing requires a bridge payload.");
      }

      return this.ncalayerSigningProvider.sign({
        entityId: protocol.id,
        entityType: "PROTOCOL",
        documentHash,
        ...input,
      });
    }

    if (!this.isMockPayload(input)) {
      throw new BadRequestException("Mock signing requires signer payload.");
    }

    const mockInput = input!;

    return this.mockSigningProvider.sign({
      entityId: protocol.id,
      entityType: "PROTOCOL",
      documentHash,
      signerName: mockInput.signerName,
      signerIin: mockInput.signerIin,
      certificateSerial: mockInput.certificateSerial,
    });
  }

  private async appendCanonicalVersion(
    transaction: Prisma.TransactionClient,
    args: {
      userId: string;
      envelopeId: string;
      documentNumber: string;
      title: string;
      scopeType: "ORGANIZATION" | "BRANCH" | "DEPARTMENT" | "WORK_SITE";
      branchId?: string | null;
      departmentId?: string | null;
      workSiteId?: string | null;
      payloadJson: Prisma.JsonObject;
      renderedHash: string;
      changeReason: string;
      status: "DRAFT" | "FINAL";
    },
  ) {
    const envelope = await transaction.documentEnvelope.findUnique({
      where: { id: args.envelopeId },
      include: {
        currentVersion: true,
      },
    });

    if (!envelope) {
      throw new NotFoundException("Canonical document envelope is not available.");
    }

    if (envelope.currentVersion?.status === "SIGNED" || envelope.status === "SIGNED") {
      throw new BadRequestException(
        "Signed protocols are immutable. Use replace or annul instead of editing the signed revision.",
      );
    }

    const latest = await transaction.documentVersion.findFirst({
      where: { envelopeId: envelope.id },
      orderBy: { versionNo: "desc" },
      select: { versionNo: true },
    });

    const version = await transaction.documentVersion.create({
      data: {
        envelopeId: envelope.id,
        versionNo: (latest?.versionNo ?? 0) + 1,
        status: args.status,
        payloadJson: args.payloadJson as Prisma.InputJsonValue,
        renderedHash: args.renderedHash,
        changeReason: args.changeReason,
        createdByUserId: args.userId,
      },
    });

    await transaction.documentEnvelope.update({
      where: { id: envelope.id },
      data: {
        documentNumber: args.documentNumber,
        title: args.title,
        scopeType: args.scopeType,
        branchId: args.branchId ?? null,
        departmentId: args.departmentId ?? null,
        workSiteId: args.workSiteId ?? null,
        currentVersionId: version.id,
        status: this.normalizeDocumentVersionStatus(version.status),
      },
    });

    return version;
  }

  private async findRawById(id: string) {
    const protocol = await this.prisma.protocol.findUnique({
      where: { id },
      include: protocolInclude,
    });

    if (!protocol) {
      throw new NotFoundException("Protocol not found.");
    }

    return protocol;
  }

  private async loadHistorySummaryMap(protocolIds: string[]) {
    if (!protocolIds.length) {
      return new Map<string, ProtocolHistorySummary>();
    }

    const logs = await this.prisma.auditLog.findMany({
      where: {
        entityType: "Protocol",
        entityId: { in: protocolIds },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    const grouped = new Map<string, ProtocolHistorySummary>();

    for (const protocolId of protocolIds) {
      grouped.set(protocolId, { ...PROTOCOL_HISTORY_EMPTY });
    }

    for (const log of logs) {
      const existing = grouped.get(log.entityId) ?? { ...PROTOCOL_HISTORY_EMPTY };

      grouped.set(log.entityId, {
        totalEvents: existing.totalEvents + 1,
        lastAction: existing.lastAction ?? log.action,
        lastAt: existing.lastAt ?? this.toIsoString(log.createdAt),
      });
    }

    return grouped;
  }

  private async loadLatestAdmissionMap(organizationId: string, employeeIds: string[]) {
    if (!employeeIds.length) {
      return new Map<
        string,
        {
          status: "admitted" | "limited" | "blocked";
          decisionCode: string;
          evaluatedAt: string | null;
        }
      >();
    }

    const evaluations = await this.prisma.admissionEvaluation.findMany({
      where: {
        organizationId,
        subjectType: "EMPLOYEE",
        employeeId: { in: [...new Set(employeeIds)] },
      },
      orderBy: [{ employeeId: "asc" }, { evaluatedAt: "desc" }],
      select: {
        employeeId: true,
        status: true,
        decisionCode: true,
        evaluatedAt: true,
      },
    });

    const result = new Map<
      string,
      {
        status: "admitted" | "limited" | "blocked";
        decisionCode: string;
        evaluatedAt: string | null;
      }
    >();

    for (const evaluation of evaluations) {
      if (!evaluation.employeeId || result.has(evaluation.employeeId)) {
        continue;
      }

      result.set(evaluation.employeeId, {
        status: this.mapLegacyStatus(evaluation.status),
        decisionCode: evaluation.decisionCode,
        evaluatedAt: this.toIsoString(evaluation.evaluatedAt),
      });
    }

    return result;
  }

  private mapProtocol(
    protocol: RawProtocol,
    historySummary: ProtocolHistorySummary,
    latestAdmissionMap: Map<
      string,
      {
        status: "admitted" | "limited" | "blocked";
        decisionCode: string;
        evaluatedAt: string | null;
      }
    >,
  ) {
    const latestSignature = protocol.documentEnvelope?.signatures[0] ?? null;
    const latestArchiveRecord =
      protocol.archiveRecord ??
      protocol.documentEnvelope?.archiveRecords[0] ??
      null;

    return {
      id: protocol.id,
      organizationId: protocol.organizationId,
      number: protocol.number,
      date: protocol.date,
      protocolType: protocol.protocolType,
      basis: protocol.basis,
      scopeType: protocol.scopeType,
      branchId: protocol.branchId,
      departmentId: protocol.departmentId,
      workSiteId: protocol.workSiteId,
      status: protocol.status,
      decision: protocol.decision,
      notes: protocol.notes,
      documentEnvelopeId: protocol.documentEnvelopeId,
      currentVersionId: protocol.currentVersionId,
      currentVersionNo:
        protocol.currentVersionNo ?? protocol.documentEnvelope?.currentVersion?.versionNo ?? null,
      signedAt: this.toIsoString(protocol.signedAt),
      replacesProtocolId: protocol.replacesProtocolId,
      canonicalStatus: this.toCanonicalStatus(protocol),
      documentEnvelopeStatus: protocol.documentEnvelope?.status ?? null,
      documentVersionStatus: protocol.documentEnvelope?.currentVersion?.status ?? null,
      signingDigest: protocol.documentEnvelope?.currentVersion?.renderedHash ?? null,
      isSigned: this.isImmutableSigned(protocol),
      evidenceAvailable: this.hasEvidenceTrail(protocol),
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
      allowedActions: this.buildAllowedActions(protocol),
      employees: protocol.employees.map((participant) => ({
        employeeId: participant.employeeId,
        fullName: participant.fullName,
        employeeNumber: participant.employeeNumber,
        jobTitle: participant.jobTitle,
        departmentId: participant.employee.departmentId,
        departmentName: participant.employee.department?.name ?? null,
      })),
      commission: protocol.commissionMembers.map((member) => ({
        role: member.role,
        fullName: member.fullName,
        jobTitle: member.jobTitle,
      })),
      complianceImpact: protocol.employees.map((participant) => {
        const evaluation = latestAdmissionMap.get(participant.employeeId);

        return {
          employeeId: participant.employeeId,
          fullName: participant.fullName,
          admissionStatus: evaluation?.status ?? null,
          decisionCode: evaluation?.decisionCode ?? null,
          evaluatedAt: evaluation?.evaluatedAt ?? null,
          basisLabel:
            protocol.status === "SIGNED"
              ? `Protocol ${protocol.number}`
              : `Protocol ${protocol.number} (${protocol.status})`,
        };
      }),
      branch: protocol.branch
        ? {
            id: protocol.branch.id,
            code: protocol.branch.code,
            name: protocol.branch.name,
            location: null,
          }
        : null,
      department: protocol.department
        ? {
            id: protocol.department.id,
            code: protocol.department.code,
            name: protocol.department.name,
            location: null,
          }
        : null,
      workSite: protocol.workSite
        ? {
            id: protocol.workSite.id,
            code: protocol.workSite.code,
            name: protocol.workSite.name,
            location: protocol.workSite.location,
          }
        : null,
    };
  }

  private async mapProtocolCollection(protocols: RawProtocol[]) {
    const protocolIds = protocols.map((protocol) => protocol.id);
    const employeeIds = protocols.flatMap((protocol) =>
      protocol.employees.map((participant) => participant.employeeId),
    );
    const [historySummaryMap, latestAdmissionMap] = await Promise.all([
      this.loadHistorySummaryMap(protocolIds),
      protocols[0]
        ? this.loadLatestAdmissionMap(protocols[0].organizationId, employeeIds)
        : Promise.resolve(new Map()),
    ]);

    return protocols.map((protocol) =>
      this.mapProtocol(
        protocol,
        historySummaryMap.get(protocol.id) ?? PROTOCOL_HISTORY_EMPTY,
        latestAdmissionMap,
      ),
    );
  }

  private async recalculateEmployees(user: AuthenticatedUser, employeeIds: string[]) {
    const uniqueEmployeeIds = [...new Set(employeeIds)];

    for (const employeeId of uniqueEmployeeIds) {
      await this.employeeComplianceService.recalculate(user, employeeId);
    }
  }

  async list(user: AuthenticatedUser, filters: ProtocolFilters = {}) {
    const organizationId = requireOrganizationScope(user, filters.organizationId ?? null);
    const protocols = await this.prisma.protocol.findMany({
      where: {
        organizationId,
        status: filters.status ?? undefined,
        departmentId: filters.departmentId ?? undefined,
        date: {
          gte: this.parseDateBoundary(filters.dateFrom),
          lte: this.parseDateBoundary(filters.dateTo, true),
        },
        employees: filters.employeeId
          ? {
              some: {
                employeeId: filters.employeeId,
              },
            }
          : undefined,
        OR: filters.search
          ? [
              {
                number: {
                  contains: filters.search,
                  mode: "insensitive",
                },
              },
            ]
          : undefined,
      },
      include: protocolInclude,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    return this.mapProtocolCollection(protocols);
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const protocol = await this.findRawById(id);
    assertOrganizationAccess(user, protocol.organizationId);
    const [historySummaryMap, latestAdmissionMap] = await Promise.all([
      this.loadHistorySummaryMap([protocol.id]),
      this.loadLatestAdmissionMap(
        protocol.organizationId,
        protocol.employees.map((participant) => participant.employeeId),
      ),
    ]);

    return this.mapProtocol(
      protocol,
      historySummaryMap.get(protocol.id) ?? PROTOCOL_HISTORY_EMPTY,
      latestAdmissionMap,
    );
  }

  async create(user: AuthenticatedUser, input: CreateProtocolInput) {
    if (input.status !== "DRAFT") {
      throw new BadRequestException("Protocols can only be created as drafts.");
    }

    const organizationId = requireOrganizationScope(user, input.organizationId ?? null);
    await this.ensureOrganizationRecord(organizationId);

    const scope = {
      branchId: input.branchId ?? null,
      departmentId: input.departmentId ?? null,
      workSiteId: input.workSiteId ?? null,
    };
    const scopeType = this.resolveScopeType(scope);
    const employees = await this.validateScopeAndEmployees({
      organizationId,
      scope,
      employeeIds: input.employeeIds,
    });
    const commissionRows = this.buildCommissionRows({
      chairman: input.chairman,
      members: input.members,
    });
    const protocolId = randomUUID();
    const payloadJson = this.buildProtocolPayload({
      protocolId,
      number: input.number,
      date: new Date(input.date),
      protocolType: input.protocolType,
      basis: input.basis,
      scopeType,
      branchId: scope.branchId,
      departmentId: scope.departmentId,
      workSiteId: scope.workSiteId,
      decision: input.decision,
      notes: input.notes ?? null,
      employees: employees.map((employee) => ({
        employeeId: employee.id,
        fullName: employee.fullName,
        employeeNumber: employee.employeeNumber,
        jobTitle: employee.jobTitle,
      })),
      commission: commissionRows,
    });
    const renderedHash = hashDocumentPayload(JSON.stringify(payloadJson));

    const createdProtocol = await this.prisma.$transaction(async (transaction) => {
      const protocol = await transaction.protocol.create({
        data: {
          id: protocolId,
          organizationId,
          number: input.number,
          date: new Date(input.date),
          protocolType: input.protocolType,
          basis: input.basis,
          scopeType,
          branchId: scope.branchId,
          departmentId: scope.departmentId,
          workSiteId: scope.workSiteId,
          status: "DRAFT",
          decision: input.decision,
          notes: input.notes ?? null,
          createdByUserId: user.userId,
          updatedByUserId: user.userId,
        },
      });

      const envelope = await transaction.documentEnvelope.create({
        data: {
          organizationId,
          documentKind: "PROTOCOL",
          scopeType,
          branchId: scope.branchId,
          departmentId: scope.departmentId,
          workSiteId: scope.workSiteId,
          businessObjectType: "Protocol",
          businessObjectId: protocol.id,
          documentNumber: input.number,
          title: this.protocolTitle(input.number),
          status: "DRAFT",
          createdByUserId: user.userId,
        },
      });

      const version = await this.appendCanonicalVersion(transaction, {
        userId: user.userId,
        envelopeId: envelope.id,
        documentNumber: input.number,
        title: this.protocolTitle(input.number),
        scopeType,
        branchId: scope.branchId,
        departmentId: scope.departmentId,
        workSiteId: scope.workSiteId,
        payloadJson,
        renderedHash,
        changeReason: "Initial draft protocol revision.",
        status: "DRAFT",
      });

      await transaction.protocol.update({
        where: { id: protocol.id },
        data: {
          documentEnvelopeId: envelope.id,
          currentVersionId: version.id,
          currentVersionNo: version.versionNo,
        },
      });

      await transaction.protocolEmployee.createMany({
        data: employees.map((employee, index) => ({
          protocolId: protocol.id,
          employeeId: employee.id,
          sortOrder: index,
          fullName: employee.fullName,
          employeeNumber: employee.employeeNumber,
          jobTitle: employee.jobTitle,
        })),
      });

      await transaction.protocolCommissionMember.createMany({
        data: commissionRows.map((member) => ({
          protocolId: protocol.id,
          role: member.role,
          sortOrder: member.sortOrder,
          fullName: member.fullName,
          jobTitle: member.jobTitle,
        })),
      });

      return protocol.id;
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: organizationId,
      action: "protocol.created",
      entityType: "Protocol",
      entityId: createdProtocol,
      metadata: {
        number: input.number,
        protocolType: input.protocolType,
        employeeCount: input.employeeIds.length,
      },
    });

    return this.findOne(user, createdProtocol);
  }

  async update(user: AuthenticatedUser, id: string, input: UpdateProtocolInput) {
    const existing = await this.findRawById(id);
    assertOrganizationAccess(user, existing.organizationId);
    this.ensureEditableDraft(existing);

    const number = input.number ?? existing.number;
    const date = input.date ? new Date(input.date) : existing.date;
    const protocolType = input.protocolType ?? existing.protocolType;
    const basis = input.basis ?? existing.basis;
    const decision = input.decision ?? existing.decision;
    const notes = input.notes === undefined ? existing.notes : input.notes ?? null;
    const scope = {
      branchId: input.branchId === undefined ? existing.branchId : input.branchId ?? null,
      departmentId:
        input.departmentId === undefined ? existing.departmentId : input.departmentId ?? null,
      workSiteId: input.workSiteId === undefined ? existing.workSiteId : input.workSiteId ?? null,
    };
    const scopeType = this.resolveScopeType(scope);
    const employeeIds =
      input.employeeIds ?? existing.employees.map((participant) => participant.employeeId);
    const employees = await this.validateScopeAndEmployees({
      organizationId: existing.organizationId,
      scope,
      employeeIds,
    });
    const commissionRows = this.buildCommissionRows({
      chairman:
        input.chairman ??
        {
          fullName:
            existing.commissionMembers.find((member) => member.role === "CHAIRMAN")?.fullName ??
            "",
          jobTitle:
            existing.commissionMembers.find((member) => member.role === "CHAIRMAN")?.jobTitle ??
            null,
        },
      members:
        input.members ??
        existing.commissionMembers
          .filter((member) => member.role === "MEMBER")
          .map((member) => ({
            fullName: member.fullName,
            jobTitle: member.jobTitle,
          })),
    });
    const payloadJson = this.buildProtocolPayload({
      protocolId: existing.id,
      number,
      date,
      protocolType,
      basis,
      scopeType,
      branchId: scope.branchId,
      departmentId: scope.departmentId,
      workSiteId: scope.workSiteId,
      decision,
      notes,
      employees: employees.map((employee) => ({
        employeeId: employee.id,
        fullName: employee.fullName,
        employeeNumber: employee.employeeNumber,
        jobTitle: employee.jobTitle,
      })),
      commission: commissionRows,
    });
    const renderedHash = hashDocumentPayload(JSON.stringify(payloadJson));

    await this.prisma.$transaction(async (transaction) => {
      const version = await this.appendCanonicalVersion(transaction, {
        userId: user.userId,
        envelopeId: existing.documentEnvelopeId ?? "",
        documentNumber: number,
        title: this.protocolTitle(number),
        scopeType,
        branchId: scope.branchId,
        departmentId: scope.departmentId,
        workSiteId: scope.workSiteId,
        payloadJson,
        renderedHash,
        changeReason: "Updated protocol draft revision.",
        status: "DRAFT",
      });

      await transaction.protocol.update({
        where: { id: existing.id },
        data: {
          number,
          date,
          protocolType,
          basis,
          scopeType,
          branchId: scope.branchId,
          departmentId: scope.departmentId,
          workSiteId: scope.workSiteId,
          status: "DRAFT",
          decision,
          notes,
          currentVersionId: version.id,
          currentVersionNo: version.versionNo,
          updatedByUserId: user.userId,
        },
      });

      await transaction.protocolEmployee.deleteMany({
        where: { protocolId: existing.id },
      });
      await transaction.protocolCommissionMember.deleteMany({
        where: { protocolId: existing.id },
      });

      await transaction.protocolEmployee.createMany({
        data: employees.map((employee, index) => ({
          protocolId: existing.id,
          employeeId: employee.id,
          sortOrder: index,
          fullName: employee.fullName,
          employeeNumber: employee.employeeNumber,
          jobTitle: employee.jobTitle,
        })),
      });

      await transaction.protocolCommissionMember.createMany({
        data: commissionRows.map((member) => ({
          protocolId: existing.id,
          role: member.role,
          sortOrder: member.sortOrder,
          fullName: member.fullName,
          jobTitle: member.jobTitle,
        })),
      });
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: existing.organizationId,
      action: "protocol.updated",
      entityType: "Protocol",
      entityId: existing.id,
      metadata: {
        number,
        employeeCount: employeeIds.length,
      },
    });

    return this.findOne(user, existing.id);
  }

  async prepareForSigning(
    user: AuthenticatedUser,
    id: string,
    _input: PrepareProtocolForSigningInput = {},
  ) {
    const existing = await this.findRawById(id);
    assertOrganizationAccess(user, existing.organizationId);
    this.ensureEditableDraft(existing);

    const payloadJson = this.buildProtocolPayload({
      protocolId: existing.id,
      number: existing.number,
      date: existing.date,
      protocolType: existing.protocolType,
      basis: existing.basis,
      scopeType: existing.scopeType,
      branchId: existing.branchId,
      departmentId: existing.departmentId,
      workSiteId: existing.workSiteId,
      decision: existing.decision,
      notes: existing.notes ?? null,
      employees: existing.employees.map((participant) => ({
        employeeId: participant.employeeId,
        fullName: participant.fullName,
        employeeNumber: participant.employeeNumber,
        jobTitle: participant.jobTitle,
      })),
      commission: existing.commissionMembers.map((member) => ({
        role: member.role,
        fullName: member.fullName,
        jobTitle: member.jobTitle,
      })),
      extra: existing.replacesProtocolId
        ? {
            replacesProtocolId: existing.replacesProtocolId,
          }
        : undefined,
    });
    const renderedHash = hashDocumentPayload(JSON.stringify(payloadJson));
    const alreadyPrepared =
      existing.status === "SIGNING_READY" &&
      existing.documentEnvelope?.status === "SIGNING_READY" &&
      existing.documentEnvelope.currentVersion?.status === "FINAL" &&
      existing.documentEnvelope.currentVersion.renderedHash === renderedHash;

    if (!alreadyPrepared) {
      await this.prisma.$transaction(async (transaction) => {
        const version = await this.appendCanonicalVersion(transaction, {
          userId: user.userId,
          envelopeId: existing.documentEnvelopeId ?? "",
          documentNumber: existing.number,
          title: this.protocolTitle(existing.number),
          scopeType: existing.scopeType,
          branchId: existing.branchId,
          departmentId: existing.departmentId,
          workSiteId: existing.workSiteId,
          payloadJson,
          renderedHash,
          changeReason: "Prepared protocol for signing.",
          status: "FINAL",
        });

        await transaction.protocol.update({
          where: { id: existing.id },
          data: {
            status: "SIGNING_READY",
            currentVersionId: version.id,
            currentVersionNo: version.versionNo,
            updatedByUserId: user.userId,
          },
        });
      });

      await this.auditService.log({
        actorUserId: user.userId,
        companyId: existing.organizationId,
        action: "protocol.ready_for_signing",
        entityType: "Protocol",
        entityId: existing.id,
        metadata: {
          envelopeId: existing.documentEnvelopeId,
        },
      });
    }

    const prepared = await this.findOne(user, id);
    const signingConfig = this.getSigningRuntimeConfig();

    if (!prepared.signingDigest || !prepared.documentEnvelopeId || !prepared.currentVersionId) {
      throw new BadRequestException("Signing contract is not available after preparation.");
    }

    if (!prepared.currentVersionNo) {
      throw new BadRequestException("Protocol version number is not available after preparation.");
    }

    return {
      protocol: prepared,
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
        signRole: "COMMISSION_SIGNER" as const,
        bridgeContext: {
          protocolId: prepared.id,
          documentNumber: prepared.number,
        },
      },
    };
  }

  async sign(
    user: AuthenticatedUser,
    id: string,
    input?: SignProtocolInput,
    context?: RequestContext,
  ) {
    const protocol = await this.findRawById(id);
    assertOrganizationAccess(user, protocol.organizationId);

    const envelope = protocol.documentEnvelope;
    const currentVersion = envelope?.currentVersion;

    if (!envelope || !currentVersion) {
      throw new BadRequestException("Protocol is not prepared in the canonical document flow.");
    }

    if (!this.buildAllowedActions(protocol).canSign) {
      throw new BadRequestException("Protocol must be prepared for signing first.");
    }

    const signingResult = this.resolveSigningResult(protocol, input);
    const certificateMetadata = this.isNcalayerPayload(input)
      ? await this.ensureCertificateMetadata(protocol.organizationId, input)
      : null;
    const signaturePayload = {
      subjectType: "PROTOCOL",
      subjectId: protocol.id,
      source: "PROTOCOL_REGISTRY",
      signingContext: {
        protocolId: protocol.id,
        documentNumber: envelope.documentNumber,
        versionId: currentVersion.id,
      },
      requestContext: {
        ipAddress: context?.ipAddress ?? null,
        userAgent: context?.userAgent ?? null,
      },
      providerPayload: signingResult.payload as Prisma.JsonValue,
    } as Prisma.JsonObject;
    const signatureHash = this.buildSignatureHash(input, signingResult.payload as Prisma.InputJsonValue);

    const signature = await this.corePlatformService.createSignature(user, {
      envelopeId: envelope.id,
      versionId: currentVersion.id,
      companyId: protocol.organizationId,
      organizationId: protocol.organizationId,
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
      organizationId: protocol.organizationId,
      documentKind: "PROTOCOL",
      scopeType: envelope.scopeType,
      effectiveAt: signingResult.signedAt.toISOString(),
    });

    if (!resolvedRetention) {
      throw new BadRequestException("Retention policy could not be resolved for the protocol.");
    }

    const archiveRecord = await this.corePlatformService.createArchiveRecord(user, {
      organizationId: protocol.organizationId,
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
          subjectType: "PROTOCOL",
          subjectId: protocol.id,
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

    const sourceProtocol = protocol.replacesProtocolId
      ? await this.prisma.protocol.findUnique({
          where: { id: protocol.replacesProtocolId },
          include: {
            employees: true,
          },
        })
      : null;

    await this.prisma.$transaction(async (transaction) => {
      await transaction.protocol.update({
        where: { id: protocol.id },
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

      if (sourceProtocol?.documentEnvelopeId) {
        await transaction.protocol.update({
          where: { id: sourceProtocol.id },
          data: {
            status: "SUPERSEDED",
            updatedByUserId: user.userId,
          },
        });

        await transaction.documentEnvelope.update({
          where: { id: sourceProtocol.documentEnvelopeId },
          data: {
            status: "SUPERSEDED",
          },
        });

        if (sourceProtocol.currentVersionId) {
          await transaction.documentVersion.update({
            where: { id: sourceProtocol.currentVersionId },
            data: {
              effectiveTo: signingResult.signedAt,
            },
          });
        }
      }
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: protocol.organizationId,
      action: "protocol.signed",
      entityType: "Protocol",
      entityId: protocol.id,
      metadata: {
        envelopeId: envelope.id,
        signatureId: signature.id,
        archiveRecordId: archiveRecord.id,
        archiveRetentionCode: resolvedRetention.policy.retentionCode,
        archiveRetentionSource: resolvedRetention.source,
        evidenceSignatureCount: evidencePackage.signatures.length,
        evidenceArchiveRecordCount: evidencePackage.archiveRecords.length,
        replacesProtocolId: protocol.replacesProtocolId ?? null,
      },
    });

    if (sourceProtocol) {
      await this.auditService.log({
        actorUserId: user.userId,
        companyId: sourceProtocol.organizationId,
        action: "protocol.superseded",
        entityType: "Protocol",
        entityId: sourceProtocol.id,
        metadata: {
          supersededByProtocolId: protocol.id,
        },
      });
    }

    await this.recalculateEmployees(user, [
      ...protocol.employees.map((participant) => participant.employeeId),
      ...(sourceProtocol?.employees.map((participant) => participant.employeeId) ?? []),
    ]);

    return this.findOne(user, id);
  }

  async annul(user: AuthenticatedUser, id: string, input: AnnulProtocolInput) {
    const protocol = await this.findRawById(id);
    assertOrganizationAccess(user, protocol.organizationId);

    const envelope = protocol.documentEnvelope;
    const currentVersion = envelope?.currentVersion;

    if (!envelope || !currentVersion) {
      throw new BadRequestException("Canonical protocol revision is not available.");
    }

    if (!this.buildAllowedActions(protocol).canAnnul) {
      throw new BadRequestException("Only prepared or signed protocols can be annulled.");
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

      await transaction.protocol.update({
        where: { id: protocol.id },
        data: {
          status: "ANNULLED",
          updatedByUserId: user.userId,
        },
      });
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: protocol.organizationId,
      action: "protocol.annulled",
      entityType: "Protocol",
      entityId: protocol.id,
      metadata: {
        envelopeId: envelope.id,
        reason: input.reason ?? null,
      },
    });

    await this.recalculateEmployees(
      user,
      protocol.employees.map((participant) => participant.employeeId),
    );

    return this.findOne(user, id);
  }

  async replace(user: AuthenticatedUser, id: string, input: ReplaceProtocolInput) {
    const sourceProtocol = await this.findRawById(id);
    assertOrganizationAccess(user, sourceProtocol.organizationId);

    if (!sourceProtocol.documentEnvelopeId) {
      throw new BadRequestException("Signed protocol must be linked to a canonical envelope.");
    }

    if (!this.buildAllowedActions(sourceProtocol).canReplace) {
      throw new BadRequestException("Only signed protocols can be replaced.");
    }

    const created = await this.create(user, {
      organizationId: sourceProtocol.organizationId,
      number: input.number,
      date: input.date,
      protocolType: input.protocolType,
      basis: input.basis,
      branchId: input.branchId ?? sourceProtocol.branchId ?? null,
      departmentId: input.departmentId ?? sourceProtocol.departmentId ?? null,
      workSiteId: input.workSiteId ?? sourceProtocol.workSiteId ?? null,
      decision: input.decision,
      notes: input.notes ?? null,
      employeeIds: input.employeeIds,
      chairman: input.chairman,
      members: input.members,
      status: "DRAFT",
    });

    await this.prisma.protocol.update({
      where: { id: created.id },
      data: {
        replacesProtocolId: sourceProtocol.id,
        updatedByUserId: user.userId,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: sourceProtocol.organizationId,
      action: "protocol.replacement_created",
      entityType: "Protocol",
      entityId: created.id,
      metadata: {
        replacesProtocolId: sourceProtocol.id,
        replacementReason: input.reason ?? null,
      },
    });

    return this.findOne(user, created.id);
  }

  async download(user: AuthenticatedUser, id: string) {
    const protocol = await this.findRawById(id);
    assertOrganizationAccess(user, protocol.organizationId);

    return this.pdfService.renderProtocol({
      number: protocol.number,
      date: protocol.date,
      protocolType: protocol.protocolType,
      basis: protocol.basis,
      status: protocol.status,
      decision: protocol.decision,
      notes: protocol.notes,
      departmentName: protocol.department?.name ?? null,
      workSiteName: protocol.workSite?.name ?? null,
      employees: protocol.employees.map((participant) => ({
        fullName: participant.fullName,
        employeeNumber: participant.employeeNumber ?? null,
        jobTitle: participant.jobTitle ?? null,
      })),
      commission: protocol.commissionMembers.map((member) => ({
        role: member.role,
        fullName: member.fullName,
        jobTitle: member.jobTitle ?? null,
      })),
      signedAt: protocol.signedAt,
    });
  }
}
