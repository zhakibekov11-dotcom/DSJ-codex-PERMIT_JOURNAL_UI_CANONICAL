import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  encryptSensitiveValue,
  hashSensitiveValue,
  hashSensitiveValueLegacy,
  maskIin,
} from "@dsj/database";
import type {
  CreateAdmissionCheckInput,
  CreateOrganizationInput,
  CreateBranchInput,
  CreateComplianceDocumentTypeInput,
  CreatePositionInput,
  CreateScopeGrantInput,
  CreateWorkSiteInput,
  ScopeType,
} from "@dsj/types";
import type {
  ApprovalStepAction,
  CreateApprovalRouteInput,
  CreateApprovalStepInput,
  CreateArchiveRecordInput,
  CreateAttachmentInput,
  CreateCertificateMetadataInput,
  CreateDocumentEnvelopeInput,
  CreateDocumentTemplateInput,
  CreateDocumentVersionInput,
  CreateExportSnapshotInput,
  CreateRetentionPolicyInput,
  CreateSignatureInput,
  CreateSignatureVerificationInput,
  DocumentEnvelopeStatus,
  DocumentKind,
  DocumentTemplateStatus,
  DocumentVersionStatus,
  SignatureLifecycleStatus,
} from "@dsj/types";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import {
  requireOrganizationScope,
  resolveCanonicalScope,
} from "../common/utils/tenant-scope";
import { PrismaService } from "../database/prisma.service";
import { evaluateAdmissionDecision, derivePermitRequirement } from "./admission.engine";
import type {
  CreateBriefingJournalEntryInput,
  CreateBriefingJournalInput,
  CreateBrigadeInput,
  CreateBrigadeMemberInput,
  CreateContractorOrganizationInput,
  CreateContractorWorkerInput,
  CreateJobRequirementMatrixInput,
  CreateJobRequirementMatrixVersionInput,
  CreateOrderInput,
  CreateOrderVersionInput,
  CreateQualificationDocumentInput,
  CreateResponsibleAssignmentInput,
  CreateTrainingPlanInput,
  CreateTrainingPlanVersionInput,
  CreateWorkPermitInput,
  CreateWorkPermitVersionInput,
  UpdateWorkPermitInput,
  WorkPermitPrecheckInput,
  WorkPermitWorkflowInput,
} from "./core-platform.contracts";

const BASELINE_RETENTION_EFFECTIVE_FROM = new Date("2000-01-01T00:00:00.000Z");

@Injectable()
export class CorePlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private json(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  private toDate(value?: string | null) {
    return value ? new Date(value) : null;
  }

  private toNullableDate(value?: string | null) {
    if (value === undefined) {
      return undefined;
    }

    return value ? new Date(value) : null;
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

  private async resolveOrganizationRecord(
    user: AuthenticatedUser,
    requestedOrganizationId?: string | null,
  ) {
    const organizationId = requireOrganizationScope(user, requestedOrganizationId);
    return this.ensureOrganizationRecord(organizationId);
  }

  async ensureOrganizationForScope(
    user: AuthenticatedUser,
    requestedOrganizationId?: string | null,
  ) {
    return this.resolveOrganizationRecord(user, requestedOrganizationId);
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

  private async ensurePositionInOrganization(
    organizationId: string,
    positionId?: string | null,
  ) {
    if (!positionId) {
      return null;
    }

    const position = await this.prisma.position.findUnique({
      where: { id: positionId },
    });

    if (!position || position.organizationId !== organizationId) {
      throw new BadRequestException("Position does not belong to the organization.");
    }

    return position;
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

  private async ensureContractorOrganizationInOrganization(
    organizationId: string,
    contractorOrganizationId: string,
  ) {
    const contractorOrganization = await this.prisma.contractorOrganization.findUnique({
      where: { id: contractorOrganizationId },
    });

    if (!contractorOrganization || contractorOrganization.organizationId !== organizationId) {
      throw new BadRequestException("Contractor organization does not belong to the organization.");
    }

    return contractorOrganization;
  }

  private async ensureDocumentTemplateInOrganization(
    organizationId: string,
    templateId?: string | null,
  ) {
    if (!templateId) {
      return null;
    }

    const template = await this.prisma.documentTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template || template.organizationId !== organizationId) {
      throw new BadRequestException("Document template does not belong to the organization.");
    }

    return template;
  }

  private async ensureApprovalRouteInOrganization(
    organizationId: string,
    routeId?: string | null,
  ) {
    if (!routeId) {
      return null;
    }

    const route = await this.prisma.approvalRoute.findUnique({
      where: { id: routeId },
    });

    if (!route || route.organizationId !== organizationId) {
      throw new BadRequestException("Approval route does not belong to the organization.");
    }

    return route;
  }

  private async ensureDocumentEnvelopeInOrganization(
    organizationId: string,
    envelopeId: string,
  ) {
    const envelope = await this.prisma.documentEnvelope.findUnique({
      where: { id: envelopeId },
    });

    if (!envelope || envelope.organizationId !== organizationId) {
      throw new BadRequestException("Document envelope does not belong to the organization.");
    }

    return envelope;
  }

  private async ensureDocumentVersionInEnvelope(
    envelopeId: string,
    versionId: string,
  ) {
    const version = await this.prisma.documentVersion.findUnique({
      where: { id: versionId },
    });

    if (!version || version.envelopeId !== envelopeId) {
      throw new BadRequestException("Document version does not belong to the envelope.");
    }

    return version;
  }

  private async ensureJobRequirementMatrixInOrganization(
    organizationId: string,
    matrixId: string,
  ) {
    const matrix = await this.prisma.jobRequirementMatrix.findUnique({
      where: { id: matrixId },
    });

    if (!matrix || matrix.organizationId !== organizationId) {
      throw new BadRequestException("Job requirement matrix does not belong to the organization.");
    }

    return matrix;
  }

  private async ensureTrainingPlanInOrganization(
    organizationId: string,
    trainingPlanId: string,
  ) {
    const trainingPlan = await this.prisma.trainingPlan.findUnique({
      where: { id: trainingPlanId },
    });

    if (!trainingPlan || trainingPlan.organizationId !== organizationId) {
      throw new BadRequestException("Training plan does not belong to the organization.");
    }

    return trainingPlan;
  }

  private async ensureOrderInOrganization(
    organizationId: string,
    orderId: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order || order.organizationId !== organizationId) {
      throw new BadRequestException("Order does not belong to the organization.");
    }

    return order;
  }

  private async ensureBriefingJournalInOrganization(
    organizationId: string,
    journalId: string,
  ) {
    const journal = await this.prisma.briefingJournal.findUnique({
      where: { id: journalId },
    });

    if (!journal || journal.organizationId !== organizationId) {
      throw new BadRequestException("Briefing journal does not belong to the organization.");
    }

    return journal;
  }

  private async ensureWorkPermitInOrganization(
    organizationId: string,
    permitId: string,
  ) {
    const permit = await this.prisma.workPermit.findUnique({
      where: { id: permitId },
    });

    if (!permit || permit.organizationId !== organizationId) {
      throw new BadRequestException("Work permit does not belong to the organization.");
    }

    return permit;
  }

  private deriveScopeType(scope: {
    branchId?: string | null;
    departmentId?: string | null;
    workSiteId?: string | null;
  }): ScopeType {
    if (scope.workSiteId) {
      return "WORK_SITE";
    }

    if (scope.departmentId) {
      return "DEPARTMENT";
    }

    if (scope.branchId) {
      return "BRANCH";
    }

    return "ORGANIZATION";
  }

  private normalizeDocumentVersionStatus(
    status: DocumentVersionStatus,
  ): "DRAFT" | "IN_APPROVAL" | "SIGNING_READY" | "SIGNED" | "ANNULLED" {
    switch (status) {
      case "DRAFT":
        return "DRAFT";
      case "FINAL":
        return "SIGNING_READY";
      case "SIGNED":
        return "SIGNED";
      case "VOIDED":
        return "ANNULLED";
    }
  }

  private toCanonicalDocumentStatus(args: {
    status: string;
    currentVersion?: {
      effectiveTo?: Date | null;
    } | null;
  }) {
    const effectiveTo = args.currentVersion?.effectiveTo;
    if (effectiveTo && effectiveTo.getTime() < Date.now()) {
      return "expired" as const;
    }

    switch (args.status) {
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

  private mapCanonicalDocument(envelope: {
    id: string;
    documentKind: string;
    documentNumber: string;
    title: string;
    status: string;
    currentVersionId: string | null;
    currentVersion?: {
      id: string;
      versionNo: number;
      signedAt: Date | null;
      annulledAt: Date | null;
      effectiveFrom: Date | null;
      effectiveTo: Date | null;
    } | null;
  }) {
    return {
      envelopeId: envelope.id,
      documentKind: envelope.documentKind,
      documentNumber: envelope.documentNumber,
      title: envelope.title,
      canonicalStatus: this.toCanonicalDocumentStatus({
        status: envelope.status,
        currentVersion: envelope.currentVersion,
      }),
      currentVersionId: envelope.currentVersionId,
      currentVersionNo: envelope.currentVersion?.versionNo ?? null,
      signedAt: envelope.currentVersion?.signedAt ?? null,
      annulledAt: envelope.currentVersion?.annulledAt ?? null,
      effectiveFrom: envelope.currentVersion?.effectiveFrom ?? null,
      effectiveTo: envelope.currentVersion?.effectiveTo ?? null,
    };
  }

  private baselineRetentionPolicy(args: {
    organizationId: string;
    documentKind: DocumentKind;
    scopeType: ScopeType;
  }) {
    if (
      args.documentKind === "BRIEFING_JOURNAL" ||
      args.documentKind === "BRIEFING_JOURNAL_ENTRY"
    ) {
      return {
        id: null,
        organizationId: args.organizationId,
        retentionCode: "JOURNAL_10Y",
        documentKind: args.documentKind,
        scopeType: args.scopeType,
        retentionValue: 10,
        retentionUnit: "YEARS" as const,
        archiveFormat: "PDF_A_1" as const,
        legalBasis: "P0 baseline: journal retention is fixed to 10 years.",
        holdAllowed: true,
        destructionApprovalRequired: false,
        effectiveFrom: BASELINE_RETENTION_EFFECTIVE_FROM,
        effectiveTo: null,
        description: "Baseline retention fallback for briefing journals.",
      };
    }

    if (args.documentKind === "EMPLOYEE_DOCUMENT") {
      return {
        id: null,
        organizationId: args.organizationId,
        retentionCode: "EMPLOYEE_DOCUMENT_5Y",
        documentKind: args.documentKind,
        scopeType: args.scopeType,
        retentionValue: 5,
        retentionUnit: "YEARS" as const,
        archiveFormat: "PDF_A_1" as const,
        legalBasis:
          "P0 baseline: signed employee compliance documents are retained for 5 years.",
        holdAllowed: true,
        destructionApprovalRequired: false,
        effectiveFrom: BASELINE_RETENTION_EFFECTIVE_FROM,
        effectiveTo: null,
        description: "Baseline retention fallback for signed employee documents.",
      };
    }

    if (args.documentKind === "PROTOCOL") {
      return {
        id: null,
        organizationId: args.organizationId,
        retentionCode: "PROTOCOL_10Y",
        documentKind: args.documentKind,
        scopeType: args.scopeType,
        retentionValue: 10,
        retentionUnit: "YEARS" as const,
        archiveFormat: "PDF_A_1" as const,
        legalBasis:
          "P0 baseline: signed knowledge-check and commission protocols are retained for 10 years.",
        holdAllowed: true,
        destructionApprovalRequired: false,
        effectiveFrom: BASELINE_RETENTION_EFFECTIVE_FROM,
        effectiveTo: null,
        description: "Baseline retention fallback for signed protocols.",
      };
    }

    if (args.documentKind === "ORDER") {
      return {
        id: null,
        organizationId: args.organizationId,
        retentionCode: "RESPONSIBILITY_ORDER_10Y",
        documentKind: args.documentKind,
        scopeType: args.scopeType,
        retentionValue: 10,
        retentionUnit: "YEARS" as const,
        archiveFormat: "PDF_A_1" as const,
        legalBasis:
          "P1 baseline: signed responsibility orders are retained for 10 years.",
        holdAllowed: true,
        destructionApprovalRequired: false,
        effectiveFrom: BASELINE_RETENTION_EFFECTIVE_FROM,
        effectiveTo: null,
        description: "Baseline retention fallback for signed responsibility orders.",
      };
    }

    if (args.documentKind === "WORK_PERMIT") {
      return {
        id: null,
        organizationId: args.organizationId,
        retentionCode: "WORK_PERMIT_344_1Y",
        documentKind: args.documentKind,
        scopeType: args.scopeType,
        retentionValue: 1,
        retentionUnit: "YEARS" as const,
        archiveFormat: "PDF_A_1" as const,
        legalBasis:
          "Rules No. 344 baseline: work permits are retained for one year from closure.",
        holdAllowed: true,
        destructionApprovalRequired: false,
        effectiveFrom: BASELINE_RETENTION_EFFECTIVE_FROM,
        effectiveTo: null,
        description: "Baseline retention fallback for work permits.",
      };
    }

    return null;
  }

  private async resolveRetentionPolicyBaseline(args: {
    organizationId: string;
    documentKind: DocumentKind;
    scopeType: ScopeType;
    effectiveAt?: Date;
  }) {
    const effectiveAt = args.effectiveAt ?? new Date();
    const configuredPolicy = await this.prisma.retentionPolicy.findFirst({
      where: {
        organizationId: args.organizationId,
        documentKind: args.documentKind,
        scopeType: args.scopeType,
        effectiveFrom: {
          lte: effectiveAt,
        },
        OR: [
          { effectiveTo: null },
          {
            effectiveTo: {
              gte: effectiveAt,
            },
          },
        ],
      },
      orderBy: [{ effectiveFrom: "desc" }],
    });

    if (configuredPolicy) {
      return {
        source: "configured" as const,
        policy: configuredPolicy,
      };
    }

    const baselinePolicy = this.baselineRetentionPolicy({
      organizationId: args.organizationId,
      documentKind: args.documentKind,
      scopeType: args.scopeType,
    });

    if (baselinePolicy) {
      return {
        source: "baseline" as const,
        policy: baselinePolicy,
      };
    }

    return null;
  }

  private async materializeBaselineRetentionPolicy(policy: {
    organizationId: string;
    retentionCode: string;
    documentKind: DocumentKind;
    scopeType: ScopeType;
    retentionValue: number;
    retentionUnit: "DAYS" | "MONTHS" | "YEARS" | "INDEFINITE";
    archiveFormat: "PDF_A_1" | "PDF" | "JSON";
    legalBasis: string;
    holdAllowed: boolean;
    destructionApprovalRequired: boolean;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    description: string | null;
  }) {
    const existing = await this.prisma.retentionPolicy.findFirst({
      where: {
        organizationId: policy.organizationId,
        retentionCode: policy.retentionCode,
        effectiveFrom: policy.effectiveFrom,
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.retentionPolicy.create({
      data: {
        organizationId: policy.organizationId,
        retentionCode: policy.retentionCode,
        documentKind: policy.documentKind,
        scopeType: policy.scopeType,
        retentionValue: policy.retentionValue,
        retentionUnit: policy.retentionUnit,
        archiveFormat: policy.archiveFormat,
        legalBasis: policy.legalBasis,
        holdAllowed: policy.holdAllowed,
        destructionApprovalRequired: policy.destructionApprovalRequired,
        effectiveFrom: policy.effectiveFrom,
        effectiveTo: policy.effectiveTo,
        description: policy.description,
      },
    });
  }

  private calculateDisposalDate(
    retentionPolicy: {
      retentionValue: number;
      retentionUnit: string;
    },
    baseDate: Date,
  ) {
    if (retentionPolicy.retentionUnit === "INDEFINITE") {
      return null;
    }

    const result = new Date(baseDate);

    if (retentionPolicy.retentionUnit === "DAYS") {
      result.setDate(result.getDate() + retentionPolicy.retentionValue);
      return result;
    }

    if (retentionPolicy.retentionUnit === "MONTHS") {
      result.setMonth(result.getMonth() + retentionPolicy.retentionValue);
      return result;
    }

    if (retentionPolicy.retentionUnit === "YEARS") {
      result.setFullYear(result.getFullYear() + retentionPolicy.retentionValue);
      return result;
    }

    return null;
  }

  private async nextVersionNo<T extends { versionNo: number }>(
    items: T[],
  ) {
    return (items[0]?.versionNo ?? 0) + 1;
  }

  private mapSignature(signature: {
    id: string;
    organizationId: string | null;
    briefingJournalEntryId: string | null;
    documentEnvelopeId: string | null;
    documentVersionId: string | null;
    signerUserId: string | null;
    signerEmployeeId: string | null;
    signerRole: string | null;
    provider: string;
    status: string;
    signerName: string;
    signerIinMasked: string;
    certificateSerial: string;
    certificateMetadataId: string | null;
    documentHash: string;
    signatureHash: string | null;
    signedAt: Date | null;
    verifiedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: signature.id,
      organizationId: signature.organizationId,
      briefingJournalEntryId: signature.briefingJournalEntryId,
      documentEnvelopeId: signature.documentEnvelopeId,
      documentVersionId: signature.documentVersionId,
      signerUserId: signature.signerUserId,
      signerEmployeeId: signature.signerEmployeeId,
      signerRole: signature.signerRole,
      provider: signature.provider,
      status: signature.status,
      signerName: signature.signerName,
      signerIinMasked: signature.signerIinMasked,
      certificateSerial: signature.certificateSerial,
      certificateMetadataId: signature.certificateMetadataId,
      documentHash: signature.documentHash,
      signatureHash: signature.signatureHash,
      signedAt: signature.signedAt,
      verifiedAt: signature.verifiedAt,
      createdAt: signature.createdAt,
      updatedAt: signature.updatedAt,
    };
  }

  private mapContractorWorker(worker: {
    id: string;
    organizationId: string;
    contractorOrganizationId: string;
    fullName: string;
    iinLast4: string;
    workerNumber: string;
    email: string | null;
    phone: string | null;
    positionTitle: string | null;
    employeeKind: string;
    status: string;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
    contractorOrganization: {
      id: string;
      code: string;
      name: string;
    };
  }) {
    return {
      id: worker.id,
      organizationId: worker.organizationId,
      contractorOrganizationId: worker.contractorOrganizationId,
      fullName: worker.fullName,
      iinMasked: maskIin(worker.iinLast4.padStart(12, "*")),
      workerNumber: worker.workerNumber,
      email: worker.email,
      phone: worker.phone,
      positionTitle: worker.positionTitle,
      employeeKind: worker.employeeKind,
      status: worker.status,
      isArchived: worker.isArchived,
      contractorOrganization: worker.contractorOrganization,
      createdAt: worker.createdAt,
      updatedAt: worker.updatedAt,
    };
  }

  private buildIinHashes(iin: string) {
    return {
      current: hashSensitiveValue(iin),
      legacy: hashSensitiveValueLegacy(iin),
    };
  }

  private async ensureContractorWorkerIinAvailable(organizationId: string, iin: string) {
    const hashes = this.buildIinHashes(iin);
    const duplicate = await this.prisma.contractorWorker.findFirst({
      where: {
        organizationId,
        iinHash: {
          in: [...new Set([hashes.current, hashes.legacy])],
        },
      },
      select: {
        id: true,
      },
    });

    if (duplicate) {
      throw new BadRequestException("Contractor worker with this IIN already exists in the organization.");
    }

    return hashes;
  }

  private async signEnvelopeDocument(
    user: AuthenticatedUser,
    envelopeId: string,
    versionId: string,
    signatureInput: Omit<CreateSignatureInput, "envelopeId" | "versionId" | "status">,
  ) {
    return this.createSignature(user, {
      ...signatureInput,
      envelopeId,
      versionId,
      status: "SIGNED",
    });
  }

  async listOrganizations(user: AuthenticatedUser) {
    if (user.role === "SUPER_ADMIN") {
      return this.prisma.organization.findMany({
        orderBy: { name: "asc" },
      });
    }

    return [await this.resolveOrganizationRecord(user)];
  }

  async createOrganization(user: AuthenticatedUser, input: CreateOrganizationInput) {
    if (user.role !== "SUPER_ADMIN") {
      throw new ForbiddenException("Only a super admin can create an organization.");
    }

    const organization = await this.prisma.organization.create({
      data: {
        id: input.id ?? randomUUID(),
        code: input.code,
        name: input.name,
        bin: input.bin ?? null,
        timezone: input.timezone,
        isActive: input.isActive,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: organization.id,
      action: "organization.created",
      entityType: "Organization",
      entityId: organization.id,
      metadata: {
        code: organization.code,
        name: organization.name,
      },
    });

    return organization;
  }

  async listBranches(user: AuthenticatedUser, organizationId?: string) {
    const organization = await this.resolveOrganizationRecord(user, organizationId ?? null);
    return this.prisma.branch.findMany({
      where: { organizationId: organization.id },
      orderBy: [{ code: "asc" }, { name: "asc" }],
    });
  }

  async createBranch(user: AuthenticatedUser, input: CreateBranchInput) {
    const organization = await this.resolveOrganizationRecord(user, input.organizationId ?? null);

    const branch = await this.prisma.branch.create({
      data: {
        organizationId: organization.id,
        code: input.code,
        name: input.name,
        isActive: input.isActive,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: organization.id,
      action: "branch.created",
      entityType: "Branch",
      entityId: branch.id,
      metadata: {
        code: branch.code,
        name: branch.name,
      },
    });

    return branch;
  }

  async listWorkSites(user: AuthenticatedUser, organizationId?: string) {
    const organization = await this.resolveOrganizationRecord(user, organizationId ?? null);
    return this.prisma.workSite.findMany({
      where: { organizationId: organization.id },
      orderBy: [{ code: "asc" }, { name: "asc" }],
    });
  }

  async createWorkSite(user: AuthenticatedUser, input: CreateWorkSiteInput) {
    const organization = await this.resolveOrganizationRecord(user, input.organizationId ?? null);
    await this.ensureBranchInOrganization(organization.id, input.branchId ?? null);

    const workSite = await this.prisma.workSite.create({
      data: {
        organizationId: organization.id,
        branchId: input.branchId ?? null,
        code: input.code,
        name: input.name,
        location: input.location ?? null,
        isActive: input.isActive,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: organization.id,
      action: "work_site.created",
      entityType: "WorkSite",
      entityId: workSite.id,
      metadata: {
        code: workSite.code,
        name: workSite.name,
      },
    });

    return workSite;
  }

  async listPositions(user: AuthenticatedUser, organizationId?: string) {
    const organization = await this.resolveOrganizationRecord(user, organizationId ?? null);
    return this.prisma.position.findMany({
      where: { organizationId: organization.id },
      orderBy: [{ code: "asc" }, { name: "asc" }],
    });
  }

  async createPosition(user: AuthenticatedUser, input: CreatePositionInput) {
    const organization = await this.resolveOrganizationRecord(user, input.organizationId ?? null);
    await this.ensureBranchInOrganization(organization.id, input.branchId ?? null);

    const position = await this.prisma.position.create({
      data: {
        organizationId: organization.id,
        branchId: input.branchId ?? null,
        code: input.code,
        name: input.name,
        grade: input.grade ?? null,
        isActive: input.isActive,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: organization.id,
      action: "position.created",
      entityType: "Position",
      entityId: position.id,
      metadata: {
        code: position.code,
        name: position.name,
      },
    });

    return position;
  }

  async listContractorOrganizations(user: AuthenticatedUser, organizationId?: string) {
    const organization = await this.resolveOrganizationRecord(user, organizationId ?? null);
    return this.prisma.contractorOrganization.findMany({
      where: { organizationId: organization.id },
      orderBy: [{ code: "asc" }, { name: "asc" }],
    });
  }

  async createContractorOrganization(
    user: AuthenticatedUser,
    input: CreateContractorOrganizationInput,
  ) {
    const organization = await this.resolveOrganizationRecord(user, input.organizationId ?? null);

    const contractorOrganization = await this.prisma.contractorOrganization.create({
      data: {
        organizationId: organization.id,
        code: input.code,
        name: input.name,
        bin: input.bin ?? null,
        contactEmail: input.contactEmail ?? null,
        contactPhone: input.contactPhone ?? null,
        notes: input.notes ?? null,
        isActive: input.isActive,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: organization.id,
      action: "contractor_organization.created",
      entityType: "ContractorOrganization",
      entityId: contractorOrganization.id,
      metadata: {
        code: contractorOrganization.code,
        name: contractorOrganization.name,
      },
    });

    return contractorOrganization;
  }

  async listContractorWorkers(user: AuthenticatedUser, organizationId?: string) {
    const organization = await this.resolveOrganizationRecord(user, organizationId ?? null);
    return this.prisma.contractorWorker.findMany({
      where: { organizationId: organization.id },
      include: {
        contractorOrganization: true,
      },
      orderBy: [{ fullName: "asc" }],
    }).then((workers) => workers.map((worker) => this.mapContractorWorker(worker)));
  }

  async createContractorWorker(user: AuthenticatedUser, input: CreateContractorWorkerInput) {
    const organization = await this.resolveOrganizationRecord(user, input.organizationId ?? null);
    await this.ensureContractorOrganizationInOrganization(
      organization.id,
      input.contractorOrganizationId,
    );
    const iinHashes = await this.ensureContractorWorkerIinAvailable(
      organization.id,
      input.iin,
    );

    const contractorWorker = await this.prisma.contractorWorker.create({
      data: {
        organizationId: organization.id,
        contractorOrganizationId: input.contractorOrganizationId,
        fullName: input.fullName,
        iinEncrypted: encryptSensitiveValue(input.iin),
        iinHash: iinHashes.current,
        iinLast4: input.iin.slice(-4),
        workerNumber: input.workerNumber,
        email: input.email ?? null,
        phone: input.phone ?? null,
        positionTitle: input.positionTitle ?? null,
        employeeKind: input.employeeKind,
        status: input.status,
        isArchived: input.isArchived,
      },
      include: {
        contractorOrganization: true,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: organization.id,
      action: "contractor_worker.created",
      entityType: "ContractorWorker",
      entityId: contractorWorker.id,
      metadata: {
        workerNumber: contractorWorker.workerNumber,
        contractorOrganizationId: contractorWorker.contractorOrganizationId,
      },
    });

    return this.mapContractorWorker(contractorWorker);
  }

  async listScopeGrants(user: AuthenticatedUser, organizationId?: string) {
    const organization = await this.resolveOrganizationRecord(user, organizationId ?? null);
    return this.prisma.scopeGrant.findMany({
      where: { organizationId: organization.id },
      orderBy: [{ createdAt: "desc" }],
    });
  }

  async createScopeGrant(user: AuthenticatedUser, input: CreateScopeGrantInput) {
    const organization = await this.resolveOrganizationRecord(user, input.organizationId ?? null);

    switch (input.scopeType) {
      case "BRANCH":
        if (!input.branchId) {
          throw new BadRequestException("branchId is required for BRANCH scope.");
        }
        await this.ensureBranchInOrganization(organization.id, input.branchId);
        break;
      case "WORK_SITE":
        if (!input.workSiteId) {
          throw new BadRequestException("workSiteId is required for WORK_SITE scope.");
        }
        await this.ensureWorkSiteInOrganization(organization.id, input.workSiteId);
        break;
      case "DEPARTMENT":
        if (!input.departmentId) {
          throw new BadRequestException("departmentId is required for DEPARTMENT scope.");
        }
        await this.ensureDepartmentInOrganization(organization.id, input.departmentId);
        break;
      case "ORGANIZATION":
        break;
    }

    const scopeGrant = await this.prisma.scopeGrant.create({
      data: {
        organizationId: organization.id,
        principalType: input.principalType,
        principalId: input.principalId,
        scopeType: input.scopeType,
        branchId: input.branchId ?? null,
        departmentId: input.departmentId ?? null,
        workSiteId: input.workSiteId ?? null,
        accessLevel: input.accessLevel,
        businessProcessType: input.businessProcessType ?? null,
        startsAt: new Date(input.startsAt),
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: organization.id,
      action: "scope_grant.created",
      entityType: "ScopeGrant",
      entityId: scopeGrant.id,
      metadata: {
        principalType: scopeGrant.principalType,
        principalId: scopeGrant.principalId,
        accessLevel: scopeGrant.accessLevel,
      },
    });

    return scopeGrant;
  }

  async listClearanceTypes(user: AuthenticatedUser, organizationId?: string) {
    const organization = await this.resolveOrganizationRecord(user, organizationId ?? null);
    return this.prisma.clearanceType.findMany({
      where: { organizationId: organization.id },
      orderBy: [{ code: "asc" }],
    });
  }

  async createClearanceType(user: AuthenticatedUser, input: {
    organizationId?: string;
    code: string;
    name: string;
    description?: string | null;
    validityDays?: number | null;
    isActive?: boolean;
  }) {
    const organization = await this.resolveOrganizationRecord(user, input.organizationId ?? null);
    const clearanceType = await this.prisma.clearanceType.create({
      data: {
        organizationId: organization.id,
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        validityDays: input.validityDays ?? null,
        isActive: input.isActive ?? true,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: organization.id,
      action: "clearance_type.created",
      entityType: "ClearanceType",
      entityId: clearanceType.id,
      metadata: {
        code: clearanceType.code,
        name: clearanceType.name,
      },
    });

    return clearanceType;
  }

  async listTrainingTypes(user: AuthenticatedUser, organizationId?: string) {
    const organization = await this.resolveOrganizationRecord(user, organizationId ?? null);
    return this.prisma.trainingType.findMany({
      where: { organizationId: organization.id },
      orderBy: [{ code: "asc" }],
    });
  }

  async createTrainingType(user: AuthenticatedUser, input: {
    organizationId?: string;
    code: string;
    name: string;
    description?: string | null;
    validityDays?: number | null;
    requiresExam?: boolean;
    isActive?: boolean;
  }) {
    const organization = await this.resolveOrganizationRecord(user, input.organizationId ?? null);
    const trainingType = await this.prisma.trainingType.create({
      data: {
        organizationId: organization.id,
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        validityDays: input.validityDays ?? null,
        requiresExam: input.requiresExam ?? false,
        isActive: input.isActive ?? true,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: organization.id,
      action: "training_type.created",
      entityType: "TrainingType",
      entityId: trainingType.id,
      metadata: {
        code: trainingType.code,
        name: trainingType.name,
      },
    });

    return trainingType;
  }

  async listComplianceDocumentTypes(
    user: AuthenticatedUser,
    organizationId?: string,
  ) {
    const organization = await this.resolveOrganizationRecord(user, organizationId ?? null);
    return this.prisma.complianceDocumentType.findMany({
      where: { organizationId: organization.id },
      orderBy: [{ category: "asc" }, { code: "asc" }],
    });
  }

  async createComplianceDocumentType(
    user: AuthenticatedUser,
    input: CreateComplianceDocumentTypeInput,
  ) {
    const organization = await this.resolveOrganizationRecord(
      user,
      input.organizationId ?? null,
    );

    const documentType = await this.prisma.complianceDocumentType.create({
      data: {
        organizationId: organization.id,
        code: input.code,
        name: input.name,
        category: input.category,
        description: input.description ?? null,
        defaultValidityDays: input.defaultValidityDays ?? null,
        requiresExpiry: input.requiresExpiry,
        requiresVerification: input.requiresVerification,
        isActive: input.isActive,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: organization.id,
      action: "document_type.created",
      entityType: "ComplianceDocumentType",
      entityId: documentType.id,
      metadata: {
        code: documentType.code,
        category: documentType.category,
      },
    });

    return documentType;
  }

  async listJobRequirementMatrices(user: AuthenticatedUser, organizationId?: string) {
    const organization = await this.resolveOrganizationRecord(user, organizationId ?? null);
    return this.prisma.jobRequirementMatrix.findMany({
      where: { organizationId: organization.id },
      include: {
        currentVersion: true,
        versions: {
          orderBy: { versionNo: "asc" },
        },
        position: true,
      },
      orderBy: [{ matrixCode: "asc" }],
    });
  }

  async createJobRequirementMatrix(
    user: AuthenticatedUser,
    input: CreateJobRequirementMatrixInput,
  ) {
    const organization = await this.resolveOrganizationRecord(
      user,
      input.organizationId ?? null,
    );
    await this.ensurePositionInOrganization(organization.id, input.positionId ?? null);

    const matrix = await this.prisma.jobRequirementMatrix.create({
      data: {
        organizationId: organization.id,
        positionId: input.positionId ?? null,
        matrixCode: input.matrixCode,
        status: input.status,
        effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: organization.id,
      action: "job_requirement_matrix.created",
      entityType: "JobRequirementMatrix",
      entityId: matrix.id,
      metadata: {
        matrixCode: matrix.matrixCode,
        positionId: matrix.positionId,
      },
    });

    return matrix;
  }

  async createJobRequirementMatrixVersion(
    user: AuthenticatedUser,
    input: CreateJobRequirementMatrixVersionInput,
  ) {
    const matrix = await this.prisma.jobRequirementMatrix.findUnique({
      where: { id: input.matrixId },
    });

    if (!matrix) {
      throw new NotFoundException("Job requirement matrix not found.");
    }

    await this.resolveOrganizationRecord(user, matrix.organizationId);

    const latest = await this.prisma.jobRequirementMatrixVersion.findFirst({
      where: { matrixId: matrix.id },
      orderBy: { versionNo: "desc" },
      select: { versionNo: true },
    });

    const versionNo = input.versionNo ?? (await this.nextVersionNo(latest ? [latest] : []));
    const version = await this.prisma.jobRequirementMatrixVersion.create({
      data: {
        matrixId: matrix.id,
        versionNo,
        status: input.status,
        payloadJson: this.json(input.payloadJson),
        effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
      },
    });

    await this.prisma.jobRequirementMatrix.update({
      where: { id: matrix.id },
      data: {
        currentVersionId: version.id,
        status: version.status === "ACTIVE" ? "ACTIVE" : matrix.status,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: matrix.organizationId,
      action: "job_requirement_matrix_version.created",
      entityType: "JobRequirementMatrixVersion",
      entityId: version.id,
      metadata: {
        matrixId: matrix.id,
        versionNo: version.versionNo,
        status: version.status,
      },
    });

    return version;
  }

  async listTrainingPlans(user: AuthenticatedUser, organizationId?: string) {
    const organization = await this.resolveOrganizationRecord(user, organizationId ?? null);
    return this.prisma.trainingPlan.findMany({
      where: { organizationId: organization.id },
      include: {
        currentVersion: true,
        versions: {
          orderBy: { versionNo: "asc" },
        },
        position: true,
      },
      orderBy: [{ title: "asc" }],
    });
  }

  async createTrainingPlan(user: AuthenticatedUser, input: CreateTrainingPlanInput) {
    const organization = await this.resolveOrganizationRecord(
      user,
      input.organizationId ?? null,
    );
    await this.ensurePositionInOrganization(organization.id, input.positionId ?? null);

    if (input.matrixVersionId) {
      const matrixVersion = await this.prisma.jobRequirementMatrixVersion.findUnique({
        where: { id: input.matrixVersionId },
        include: { matrix: true },
      });

      if (!matrixVersion || matrixVersion.matrix.organizationId !== organization.id) {
        throw new BadRequestException("Matrix version does not belong to the organization.");
      }

      await this.resolveOrganizationRecord(user, matrixVersion.matrix.organizationId);
    }

    const trainingPlan = await this.prisma.trainingPlan.create({
      data: {
        organizationId: organization.id,
        planCode: input.planCode,
        title: input.title,
        description: input.description ?? null,
        positionId: input.positionId ?? null,
        matrixVersionId: input.matrixVersionId ?? null,
        status: input.status,
        requiresExam: input.requiresExam,
        effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: organization.id,
      action: "training_plan.created",
      entityType: "TrainingPlan",
      entityId: trainingPlan.id,
      metadata: {
        planCode: trainingPlan.planCode,
        title: trainingPlan.title,
      },
    });

    return trainingPlan;
  }

  async createTrainingPlanVersion(
    user: AuthenticatedUser,
    input: CreateTrainingPlanVersionInput,
  ) {
    const trainingPlan = await this.prisma.trainingPlan.findUnique({
      where: { id: input.trainingPlanId },
    });

    if (!trainingPlan) {
      throw new NotFoundException("Training plan not found.");
    }

    await this.resolveOrganizationRecord(user, trainingPlan.organizationId);

    const latest = await this.prisma.trainingPlanVersion.findFirst({
      where: { trainingPlanId: trainingPlan.id },
      orderBy: { versionNo: "desc" },
      select: { versionNo: true },
    });

    const versionNo = input.versionNo ?? (await this.nextVersionNo(latest ? [latest] : []));
    const version = await this.prisma.trainingPlanVersion.create({
      data: {
        trainingPlanId: trainingPlan.id,
        versionNo,
        status: input.status,
        payloadJson: this.json(input.payloadJson),
        documentEnvelopeId: input.documentEnvelopeId ?? null,
        createdByUserId: user.userId,
      },
    });

    await this.prisma.trainingPlan.update({
      where: { id: trainingPlan.id },
      data: {
        currentVersionId: version.id,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: trainingPlan.organizationId,
      action: "training_plan_version.created",
      entityType: "TrainingPlanVersion",
      entityId: version.id,
      metadata: {
        trainingPlanId: trainingPlan.id,
        versionNo: version.versionNo,
        status: version.status,
      },
    });

    return version;
  }

  async approveTrainingPlan(user: AuthenticatedUser, trainingPlanId: string) {
    const trainingPlan = await this.prisma.trainingPlan.findUnique({
      where: { id: trainingPlanId },
      include: {
        currentVersion: true,
      },
    });

    if (!trainingPlan) {
      throw new NotFoundException("Training plan not found.");
    }

    await this.resolveOrganizationRecord(user, trainingPlan.organizationId);

    const updated = await this.prisma.$transaction(async (transaction) => {
      if (trainingPlan.currentVersion) {
        await transaction.trainingPlanVersion.update({
          where: { id: trainingPlan.currentVersion.id },
          data: {
            status: "FINAL",
          },
        });
      }

      return transaction.trainingPlan.update({
        where: { id: trainingPlan.id },
        data: {
          status: "APPROVED",
        },
      });
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: trainingPlan.organizationId,
      action: "training_plan.approved",
      entityType: "TrainingPlan",
      entityId: trainingPlan.id,
      metadata: {
        currentVersionId: trainingPlan.currentVersionId,
      },
    });

    return updated;
  }

  async listOrders(user: AuthenticatedUser, organizationId?: string) {
    const organization = await this.resolveOrganizationRecord(user, organizationId ?? null);
    return this.prisma.order.findMany({
      where: { organizationId: organization.id },
      include: {
        basisDocument: true,
        currentVersion: true,
        versions: {
          orderBy: { versionNo: "asc" },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    });
  }

  async createOrder(user: AuthenticatedUser, input: CreateOrderInput) {
    const organization = await this.resolveOrganizationRecord(
      user,
      input.organizationId ?? null,
    );

    if (input.basisDocumentId) {
      await this.ensureDocumentEnvelopeInOrganization(organization.id, input.basisDocumentId);
    }

    const order = await this.prisma.order.create({
      data: {
        organizationId: organization.id,
        orderCode: input.orderCode,
        orderType: input.orderType,
        subject: input.subject,
        basisDocumentId: input.basisDocumentId ?? null,
        status: input.status,
        effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: organization.id,
      action: "order.created",
      entityType: "Order",
      entityId: order.id,
      metadata: {
        orderCode: order.orderCode,
        orderType: order.orderType,
      },
    });

    return order;
  }

  async createOrderVersion(user: AuthenticatedUser, input: CreateOrderVersionInput) {
    const order = await this.prisma.order.findUnique({
      where: { id: input.orderId },
    });

    if (!order) {
      throw new NotFoundException("Order not found.");
    }

    await this.resolveOrganizationRecord(user, order.organizationId);

    const latest = await this.prisma.orderVersion.findFirst({
      where: { orderId: order.id },
      orderBy: { versionNo: "desc" },
      select: { versionNo: true },
    });

    const versionNo = input.versionNo ?? (await this.nextVersionNo(latest ? [latest] : []));
    const version = await this.prisma.orderVersion.create({
      data: {
        orderId: order.id,
        versionNo,
        status: input.status,
        payloadJson: this.json(input.payloadJson),
        documentEnvelopeId: input.documentEnvelopeId ?? null,
      },
    });

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        currentVersionId: version.id,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: order.organizationId,
      action: "order_version.created",
      entityType: "OrderVersion",
      entityId: version.id,
      metadata: {
        orderId: order.id,
        versionNo: version.versionNo,
        status: version.status,
      },
    });

    return version;
  }

  async approveOrder(user: AuthenticatedUser, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        currentVersion: true,
      },
    });

    if (!order) {
      throw new NotFoundException("Order not found.");
    }

    await this.resolveOrganizationRecord(user, order.organizationId);

    const updated = await this.prisma.$transaction(async (transaction) => {
      if (order.currentVersion) {
        await transaction.orderVersion.update({
          where: { id: order.currentVersion.id },
          data: {
            status: "FINAL",
          },
        });
      }

      return transaction.order.update({
        where: { id: order.id },
        data: {
          status: "APPROVED",
        },
      });
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: order.organizationId,
      action: "order.approved",
      entityType: "Order",
      entityId: order.id,
      metadata: {
        currentVersionId: order.currentVersionId,
      },
    });

    return updated;
  }

  async signOrder(
    user: AuthenticatedUser,
    orderId: string,
    input: Omit<CreateSignatureInput, "envelopeId" | "versionId" | "status">,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        currentVersion: true,
      },
    });

    if (!order || !order.currentVersion || !order.currentVersion.documentEnvelopeId) {
      throw new NotFoundException("Order version is not ready for signing.");
    }

    await this.resolveOrganizationRecord(user, order.organizationId);

    const signature = await this.signEnvelopeDocument(
      user,
      order.currentVersion.documentEnvelopeId,
      order.currentVersion.id,
      input,
    );

    await this.prisma.$transaction(async (transaction) => {
      await transaction.orderVersion.update({
        where: { id: order.currentVersion!.id },
        data: {
          status: "SIGNED",
        },
      });

      await transaction.order.update({
        where: { id: order.id },
        data: {
          status: "SIGNED",
        },
      });
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: order.organizationId,
      action: "order.signed",
      entityType: "Order",
      entityId: order.id,
      metadata: {
        signatureId: signature.id,
      },
    });

    return signature;
  }

  async annulOrder(user: AuthenticatedUser, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException("Order not found.");
    }

    await this.resolveOrganizationRecord(user, order.organizationId);

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: "CANCELED",
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: order.organizationId,
      action: "order.annulled",
      entityType: "Order",
      entityId: order.id,
    });

    return updated;
  }

  async signBriefingJournalEntry(
    user: AuthenticatedUser,
    entryId: string,
    input: Omit<CreateSignatureInput, "envelopeId" | "versionId" | "status">,
  ) {
    const entry = await this.prisma.briefingJournalEntry.findUnique({
      where: { id: entryId },
      include: {
        journal: true,
        documentEnvelope: {
          include: {
            currentVersion: true,
          },
        },
      },
    });

    if (!entry || !entry.documentEnvelope || !entry.documentEnvelope.currentVersionId) {
      throw new NotFoundException("Briefing journal entry is not ready for signing.");
    }

    await this.resolveOrganizationRecord(user, entry.journal.organizationId);

    const signature = await this.signEnvelopeDocument(
      user,
      entry.documentEnvelope.id,
      entry.documentEnvelope.currentVersionId,
      input,
    );

    await this.prisma.briefingJournalEntry.update({
      where: { id: entry.id },
      data: {
        status: "SIGNED",
        employeeStatus: "SIGNED",
        signedAt: new Date(),
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: entry.journal.organizationId,
      action: "briefing_journal_entry.signed",
      entityType: "BriefingJournalEntry",
      entityId: entry.id,
      metadata: {
        signatureId: signature.id,
      },
    });

    return signature;
  }

  async archiveBriefingJournalEntry(user: AuthenticatedUser, entryId: string) {
    const entry = await this.prisma.briefingJournalEntry.findUnique({
      where: { id: entryId },
      include: {
        journal: true,
      },
    });

    if (!entry) {
      throw new NotFoundException("Briefing journal entry not found.");
    }

    await this.resolveOrganizationRecord(user, entry.journal.organizationId);

    const archived = await this.prisma.briefingJournalEntry.update({
      where: { id: entry.id },
      data: {
        status: "ARCHIVED",
        employeeStatus: "ARCHIVED",
        archivedAt: new Date(),
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: entry.journal.organizationId,
      action: "briefing_journal_entry.archived",
      entityType: "BriefingJournalEntry",
      entityId: entry.id,
    });

    return archived;
  }

  /*
   * Legacy permit prototype. The production workflow is implemented by
   * WorkPermitsService and these methods are intentionally unreachable.
   */
  /*
  private permitPayloadObject(value: unknown) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return { ...(value as Record<string, unknown>) };
    }

    return {};
  }

  private permitEntryFromPayload(value: unknown) {
    const payload = this.permitPayloadObject(value);
    const permitEntry = this.permitPayloadObject(payload.permitEntry);

    return { payload, permitEntry };
  }

  private withPermitEntryPatch(value: unknown, patch: Record<string, unknown>) {
    const { payload, permitEntry } = this.permitEntryFromPayload(value);

    return {
      ...payload,
      permitEntry: {
        ...permitEntry,
        ...patch,
        updatedAt: new Date().toISOString(),
      },
    };
  }

  private normalizeIdArray(value: unknown) {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
      : [];
  }

  private hasPermitValue(value: unknown) {
    if (Array.isArray(value)) {
      return value.length > 0;
    }

    return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
  }

  private buildPermitPrecheckSnapshot(permitEntry: Record<string, unknown>) {
    const checkedAt = new Date().toISOString();
    const checks: Array<{
      code: string;
      label: string;
      result: "PASS" | "FAIL";
      severity: "BLOCKER" | "WARNING";
      message: string;
      evidence: string[];
    }> = [];
    const pushCheck = (
      code: string,
      label: string,
      passed: boolean,
      message: string,
      evidence: string[] = [],
    ) => {
      checks.push({
        code,
        label,
        result: passed ? "PASS" : "FAIL",
        severity: "BLOCKER",
        message,
        evidence,
      });
    };
    const permitType = String(permitEntry.permitType ?? "");
    const workType = String(permitEntry.workType ?? "");
    const crewMemberIds = this.normalizeIdArray(permitEntry.crewMemberIds);
    const legalBasis = this.normalizeIdArray(permitEntry.legalBasis);
    const trainingEvidence = this.normalizeIdArray(permitEntry.trainingEvidenceIds);
    const briefingEvidence = this.normalizeIdArray(permitEntry.briefingEvidenceIds);
    const certificateEvidence = this.normalizeIdArray(permitEntry.certificateEvidenceIds);
    const medicalEvidence = this.normalizeIdArray(permitEntry.medicalEvidenceIds);
    const documentEvidence = this.normalizeIdArray(permitEntry.requiredDocumentIds);
    const requiresContractor =
      permitType === "CONTRACTOR_ACCESS" || workType === "CONTRACTOR_SITE_ACCESS";

    pushCheck(
      "PERMIT_CORE_FIELDS",
      "Основные данные допуска",
      this.hasPermitValue(permitEntry.permitNumber) &&
        this.hasPermitValue(permitEntry.journalRegistrationNumber) &&
        this.hasPermitValue(permitEntry.workDescription) &&
        this.hasPermitValue(permitEntry.workplace) &&
        this.hasPermitValue(permitEntry.startAt) &&
        this.hasPermitValue(permitEntry.endAt),
      "Номер, запись журнала, описание, место и сроки должны быть заполнены.",
      [
        String(permitEntry.permitNumber ?? ""),
        String(permitEntry.journalRegistrationNumber ?? ""),
      ].filter(Boolean),
    );
    pushCheck(
      "PERMIT_CREW_PRESENT",
      "Состав исполнителей",
      crewMemberIds.length > 0,
      "Перед согласованием нужна хотя бы одна запись исполнителя.",
      crewMemberIds,
    );
    pushCheck(
      "PERMIT_RESPONSIBLE_PERSONS",
      "Ответственные лица",
      this.hasPermitValue(permitEntry.issuerId) &&
        this.hasPermitValue(permitEntry.responsibleManagerId) &&
        this.hasPermitValue(permitEntry.workProducerId),
      "Выдающий, ответственный руководитель и производитель работ обязательны.",
      [
        String(permitEntry.issuerId ?? ""),
        String(permitEntry.responsibleManagerId ?? ""),
        String(permitEntry.workProducerId ?? ""),
      ].filter(Boolean),
    );
    pushCheck(
      "PERMIT_LEGAL_BASIS",
      "Нормативное основание",
      legalBasis.length > 0,
      "Выберите хотя бы одно нормативное основание из канонического списка.",
      legalBasis,
    );
    pushCheck(
      "TRAINING_SNAPSHOT",
      "Обучение и проверка знаний",
      trainingEvidence.length > 0,
      "Не выбрано подтверждение обучения или проверки знаний.",
      trainingEvidence,
    );
    pushCheck(
      "BRIEFING_SNAPSHOT",
      "Инструктаж",
      briefingEvidence.length > 0,
      "Не выбрано подтверждение инструктажа.",
      briefingEvidence,
    );
    pushCheck(
      "CERTIFICATE_SNAPSHOT",
      "Удостоверения и квалификация",
      certificateEvidence.length > 0,
      "Не выбрано подтверждение удостоверения или квалификации.",
      certificateEvidence,
    );
    pushCheck(
      "MEDICAL_SNAPSHOT",
      "Медосмотр",
      medicalEvidence.length > 0,
      "Не выбрано подтверждение действующего медосмотра. Диагнозы не сохраняются.",
      medicalEvidence,
    );
    pushCheck(
      "PPE_SNAPSHOT",
      "СИЗ",
      permitEntry.ppeIssuedConfirmed === true,
      "Подтвердите выдачу СИЗ для указанного вида работ.",
    );
    pushCheck(
      "REQUIRED_DOCUMENTS_SNAPSHOT",
      "Обязательные документы",
      documentEvidence.length > 0,
      "Не выбраны обязательные документы, схемы или вложения для допуска.",
      documentEvidence,
    );

    if (requiresContractor) {
      pushCheck(
        "CONTRACTOR_ACCESS_SCOPE",
        "Подрядный допуск",
        this.hasPermitValue(permitEntry.contractorId) &&
          this.hasPermitValue(permitEntry.contractorRepresentativeId),
        "Для contractor access нужен подрядчик и представитель подрядчика.",
        [
          String(permitEntry.contractorId ?? ""),
          String(permitEntry.contractorRepresentativeId ?? ""),
        ].filter(Boolean),
      );
    }

    const failed = checks.filter((check) => check.result === "FAIL");

    return {
      checkedAt,
      result: failed.length ? "FAIL" : "PASS",
      failedRules: failed.map((check) => check.code),
      checks,
      snapshots: {
        trainingCheckSnapshot: {
          checkedAt,
          result: trainingEvidence.length ? "PASS" : "FAIL",
          evidenceIds: trainingEvidence,
        },
        briefingCheckSnapshot: {
          checkedAt,
          result: briefingEvidence.length ? "PASS" : "FAIL",
          evidenceIds: briefingEvidence,
        },
        certificateCheckSnapshot: {
          checkedAt,
          result: certificateEvidence.length ? "PASS" : "FAIL",
          evidenceIds: certificateEvidence,
        },
        medicalCheckSnapshot: {
          checkedAt,
          result: medicalEvidence.length ? "PASS" : "FAIL",
          evidenceIds: medicalEvidence,
          containsDiagnosis: false,
        },
        ppeIssuedSnapshot: {
          checkedAt,
          result: permitEntry.ppeIssuedConfirmed === true ? "PASS" : "FAIL",
          confirmed: permitEntry.ppeIssuedConfirmed === true,
        },
        requiredDocumentSnapshot: {
          checkedAt,
          result: documentEvidence.length ? "PASS" : "FAIL",
          evidenceIds: documentEvidence,
        },
      },
    };
  }

  private async createNextWorkPermitVersion(args: {
    permitId: string;
    payloadJson: unknown;
    status?: "DRAFT" | "FINAL" | "SIGNED" | "VOIDED";
    documentEnvelopeId?: string | null;
    createdByUserId?: string | null;
  }) {
    const latest = await this.prisma.workPermitVersion.findFirst({
      where: { permitId: args.permitId },
      orderBy: { versionNo: "desc" },
      select: { versionNo: true },
    });
    const versionNo = await this.nextVersionNo(latest ? [latest] : []);

    return this.prisma.workPermitVersion.create({
      data: {
        permitId: args.permitId,
        versionNo,
        status: args.status ?? "DRAFT",
        payloadJson: this.json(args.payloadJson),
        documentEnvelopeId: args.documentEnvelopeId ?? null,
        createdByUserId: args.createdByUserId ?? null,
      },
    });
  }

  private async updateCurrentWorkPermitPayload(args: {
    permitId: string;
    currentVersionId?: string | null;
    payloadJson: unknown;
  }) {
    if (!args.currentVersionId) {
      return null;
    }

    return this.prisma.workPermitVersion.update({
      where: { id: args.currentVersionId },
      data: {
        payloadJson: this.json(args.payloadJson),
      },
    });
  }

  private assertWorkPermitEditable(permit: { status: string; currentVersion?: { status: string } | null }) {
    const editableStatuses = new Set(["DRAFT", "SUBMITTED"]);

    if (!editableStatuses.has(permit.status) || permit.currentVersion?.status === "SIGNED") {
      throw new BadRequestException("Approved or signed work permit fields are locked.");
    }
  }

  async listWorkPermits(user: AuthenticatedUser, organizationId?: string) {
    const organization = await this.resolveOrganizationRecord(user, organizationId ?? null);
    return this.prisma.workPermit.findMany({
      where: { organizationId: organization.id },
      include: {
        currentVersion: true,
        versions: {
          orderBy: { versionNo: "asc" },
        },
        brigades: {
          include: {
            members: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    });
  }

  async getWorkPermit(user: AuthenticatedUser, permitId: string) {
    const permit = await this.prisma.workPermit.findUnique({
      where: { id: permitId },
      include: {
        currentVersion: true,
        versions: {
          orderBy: { versionNo: "asc" },
        },
        brigades: {
          include: {
            members: true,
          },
        },
        branch: true,
        workSite: true,
      },
    });

    if (!permit) {
      throw new NotFoundException("Work permit not found.");
    }

    await this.resolveOrganizationRecord(user, permit.organizationId);

    return permit;
  }

  async createWorkPermit(user: AuthenticatedUser, input: CreateWorkPermitInput) {
    const scope = resolveCanonicalScope(user, {
      organizationId: input.organizationId ?? null,
      branchId: input.branchId ?? null,
      departmentId: input.departmentId ?? null,
      workSiteId: input.workSiteId ?? null,
    });
    const organization = await this.ensureOrganizationRecord(scope.organizationId);
    await Promise.all([
      this.ensureBranchInOrganization(organization.id, input.branchId ?? null),
      this.ensureDepartmentInOrganization(organization.id, input.departmentId ?? null),
      this.ensureWorkSiteInOrganization(organization.id, input.workSiteId ?? null),
    ]);

    const expectedScopeType = this.deriveScopeType({
      branchId: input.branchId ?? null,
      departmentId: input.departmentId ?? null,
      workSiteId: input.workSiteId ?? null,
    });

    if (expectedScopeType !== input.scopeType) {
      throw new BadRequestException("Scope type does not match the supplied scope references.");
    }

    const permit = await this.prisma.workPermit.create({
      data: {
        organizationId: organization.id,
        permitCode: input.permitCode,
        permitType: input.permitType,
        title: input.title,
        scopeType: input.scopeType,
        branchId: input.branchId ?? null,
        departmentId: input.departmentId ?? null,
        workSiteId: input.workSiteId ?? null,
        status: input.status,
        currentVersionId: input.currentVersionId ?? null,
        issuedAt: input.issuedAt ? new Date(input.issuedAt) : null,
        startedAt: input.startedAt ? new Date(input.startedAt) : null,
        closedAt: input.closedAt ? new Date(input.closedAt) : null,
        effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: organization.id,
      action: "work_permit.created",
      entityType: "WorkPermit",
      entityId: permit.id,
      metadata: {
        permitCode: permit.permitCode,
        permitType: permit.permitType,
        scopeType: permit.scopeType,
      },
    });

    return permit;
  }

  async createWorkPermitVersion(
    user: AuthenticatedUser,
    input: CreateWorkPermitVersionInput,
  ) {
    const permit = await this.prisma.workPermit.findUnique({
      where: { id: input.permitId },
    });

    if (!permit) {
      throw new NotFoundException("Work permit not found.");
    }

    await this.resolveOrganizationRecord(user, permit.organizationId);

    const latest = await this.prisma.workPermitVersion.findFirst({
      where: { permitId: permit.id },
      orderBy: { versionNo: "desc" },
      select: { versionNo: true },
    });

    const versionNo = input.versionNo ?? (await this.nextVersionNo(latest ? [latest] : []));
    const version = await this.prisma.workPermitVersion.create({
      data: {
        permitId: permit.id,
        versionNo,
        status: input.status,
        payloadJson: this.json(input.payloadJson),
        documentEnvelopeId: input.documentEnvelopeId ?? null,
      },
    });

    await this.prisma.workPermit.update({
      where: { id: permit.id },
      data: {
        currentVersionId: version.id,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: permit.organizationId,
      action: "work_permit_version.created",
      entityType: "WorkPermitVersion",
      entityId: version.id,
      metadata: {
        permitId: permit.id,
        versionNo: version.versionNo,
        status: version.status,
      },
    });

    return version;
  }

  async updateWorkPermit(
    user: AuthenticatedUser,
    permitId: string,
    input: UpdateWorkPermitInput,
  ) {
    const permit = await this.prisma.workPermit.findUnique({
      where: { id: permitId },
      include: {
        currentVersion: true,
      },
    });

    if (!permit) {
      throw new NotFoundException("Work permit not found.");
    }

    await this.resolveOrganizationRecord(user, permit.organizationId);
    this.assertWorkPermitEditable(permit);

    const branchId = input.branchId === undefined ? permit.branchId : input.branchId;
    const departmentId =
      input.departmentId === undefined ? permit.departmentId : input.departmentId;
    const workSiteId =
      input.workSiteId === undefined ? permit.workSiteId : input.workSiteId;
    const scopeType =
      input.scopeType ??
      this.deriveScopeType({
        branchId,
        departmentId,
        workSiteId,
      });

    await Promise.all([
      this.ensureBranchInOrganization(permit.organizationId, branchId ?? null),
      this.ensureDepartmentInOrganization(permit.organizationId, departmentId ?? null),
      this.ensureWorkSiteInOrganization(permit.organizationId, workSiteId ?? null),
    ]);

    const expectedScopeType = this.deriveScopeType({
      branchId,
      departmentId,
      workSiteId,
    });

    if (scopeType !== expectedScopeType) {
      throw new BadRequestException("Scope type does not match the supplied scope references.");
    }

    const nextPayload =
      input.payloadJson === undefined
        ? permit.currentVersion?.payloadJson
        : input.payloadJson;

    const updated = await this.prisma.$transaction(async (transaction) => {
      let versionId = permit.currentVersionId;

      if (nextPayload !== undefined) {
        const latest = await transaction.workPermitVersion.findFirst({
          where: { permitId: permit.id },
          orderBy: { versionNo: "desc" },
          select: { versionNo: true },
        });
        const versionNo = await this.nextVersionNo(latest ? [latest] : []);
        const version = await transaction.workPermitVersion.create({
          data: {
            permitId: permit.id,
            versionNo,
            status: "DRAFT",
            payloadJson: this.json(nextPayload),
            documentEnvelopeId: permit.currentVersion?.documentEnvelopeId ?? null,
            createdByUserId: user.userId,
          },
        });
        versionId = version.id;
      }

      return transaction.workPermit.update({
        where: { id: permit.id },
        data: {
          permitCode: input.permitCode ?? permit.permitCode,
          permitType: input.permitType ?? permit.permitType,
          title: input.title ?? permit.title,
          scopeType,
          branchId,
          departmentId,
          workSiteId,
          currentVersionId: versionId,
          issuedAt:
            input.issuedAt === undefined ? permit.issuedAt : this.toNullableDate(input.issuedAt),
          startedAt:
            input.startedAt === undefined ? permit.startedAt : this.toNullableDate(input.startedAt),
          effectiveFrom:
            input.effectiveFrom === undefined
              ? permit.effectiveFrom
              : this.toNullableDate(input.effectiveFrom),
          effectiveTo:
            input.effectiveTo === undefined
              ? permit.effectiveTo
              : this.toNullableDate(input.effectiveTo),
        },
      });
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: permit.organizationId,
      action: "work_permit.updated",
      entityType: "WorkPermit",
      entityId: permit.id,
    });

    return this.getWorkPermit(user, updated.id);
  }

  async runWorkPermitPrecheck(
    user: AuthenticatedUser,
    permitId: string,
    input: WorkPermitPrecheckInput,
  ) {
    const permit = await this.prisma.workPermit.findUnique({
      where: { id: permitId },
      include: {
        currentVersion: true,
      },
    });

    if (!permit || !permit.currentVersion) {
      throw new NotFoundException("Work permit version not found.");
    }

    await this.resolveOrganizationRecord(user, permit.organizationId);
    this.assertWorkPermitEditable(permit);

    const sourcePayload =
      input.payloadJson === undefined ? permit.currentVersion.payloadJson : input.payloadJson;
    const { permitEntry } = this.permitEntryFromPayload(sourcePayload);
    const precheck = this.buildPermitPrecheckSnapshot(permitEntry);
    const nextStatus = precheck.result === "PASS" ? "draft" : "missing_documents";
    const nextPayload = this.withPermitEntryPatch(sourcePayload, {
      status: nextStatus,
      precheckSummary: {
        result: precheck.result,
        checkedAt: precheck.checkedAt,
        failedRules: precheck.failedRules,
      },
      precheckChecks: precheck.checks,
      ...precheck.snapshots,
    });

    const version = await this.createNextWorkPermitVersion({
      permitId: permit.id,
      payloadJson: nextPayload,
      status: "DRAFT",
      documentEnvelopeId: permit.currentVersion.documentEnvelopeId,
      createdByUserId: user.userId,
    });

    await this.prisma.workPermit.update({
      where: { id: permit.id },
      data: {
        currentVersionId: version.id,
        status: "DRAFT",
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: permit.organizationId,
      action: precheck.result === "PASS" ? "work_permit.precheck_passed" : "work_permit.precheck_failed",
      entityType: "WorkPermit",
      entityId: permit.id,
      metadata: {
        failedRules: precheck.failedRules,
      },
    });

    return this.getWorkPermit(user, permit.id);
  }

  async submitWorkPermit(
    user: AuthenticatedUser,
    permitId: string,
    input: WorkPermitWorkflowInput,
  ) {
    const permit = await this.prisma.workPermit.findUnique({
      where: { id: permitId },
      include: {
        currentVersion: true,
      },
    });

    if (!permit || !permit.currentVersion) {
      throw new NotFoundException("Work permit version not found.");
    }

    await this.resolveOrganizationRecord(user, permit.organizationId);
    this.assertWorkPermitEditable(permit);

    const { permitEntry } = this.permitEntryFromPayload(permit.currentVersion.payloadJson);
    const precheckSummary = this.permitPayloadObject(permitEntry.precheckSummary);

    if (precheckSummary.result !== "PASS") {
      throw new BadRequestException("Precheck must pass before approval request.");
    }

    const nextPayload = this.withPermitEntryPatch(permit.currentVersion.payloadJson, {
      status: "pending_approval",
      approvalStatus: "pending_approval",
      approvalRequestedAt: new Date().toISOString(),
      approvalComment: input.comment ?? null,
    });

    await this.prisma.$transaction(async (transaction) => {
      await transaction.workPermitVersion.update({
        where: { id: permit.currentVersion!.id },
        data: {
          payloadJson: this.json(nextPayload),
        },
      });

      await transaction.workPermit.update({
        where: { id: permit.id },
        data: {
          status: "IN_APPROVAL",
        },
      });
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: permit.organizationId,
      action: "work_permit.submitted",
      entityType: "WorkPermit",
      entityId: permit.id,
    });

    return this.getWorkPermit(user, permit.id);
  }

  async createBrigade(user: AuthenticatedUser, input: CreateBrigadeInput) {
    const permit = await this.prisma.workPermit.findUnique({
      where: { id: input.permitId },
    });

    if (!permit) {
      throw new NotFoundException("Work permit not found.");
    }

    await this.resolveOrganizationRecord(user, permit.organizationId);

    if (input.leaderEmployeeId) {
      const leader = await this.prisma.employee.findUnique({
        where: { id: input.leaderEmployeeId },
      });
      if (!leader || leader.companyId !== permit.organizationId) {
        throw new BadRequestException("Leader employee does not belong to the organization.");
      }
    }

    const brigade = await this.prisma.brigade.create({
      data: {
        permitId: permit.id,
        brigadeCode: input.brigadeCode,
        title: input.title,
        leaderEmployeeId: input.leaderEmployeeId ?? null,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: permit.organizationId,
      action: "brigade.created",
      entityType: "Brigade",
      entityId: brigade.id,
      metadata: {
        permitId: permit.id,
        brigadeCode: brigade.brigadeCode,
      },
    });

    return brigade;
  }

  async createBrigadeMember(user: AuthenticatedUser, input: CreateBrigadeMemberInput) {
    const brigade = await this.prisma.brigade.findUnique({
      where: { id: input.brigadeId },
      include: {
        permit: true,
      },
    });

    if (!brigade) {
      throw new NotFoundException("Brigade not found.");
    }

    await this.resolveOrganizationRecord(user, brigade.permit.organizationId);

    if (!input.employeeId && !input.contractorWorkerId) {
      throw new BadRequestException("Either employeeId or contractorWorkerId is required.");
    }

    if (input.employeeId) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: input.employeeId },
      });
      if (!employee || employee.companyId !== brigade.permit.organizationId) {
        throw new BadRequestException("Employee does not belong to the organization.");
      }
    }

    if (input.contractorWorkerId) {
      const worker = await this.prisma.contractorWorker.findUnique({
        where: { id: input.contractorWorkerId },
      });
      if (!worker || worker.organizationId !== brigade.permit.organizationId) {
        throw new BadRequestException("Contractor worker does not belong to the organization.");
      }
    }

    const brigadeMember = await this.prisma.brigadeMember.create({
      data: {
        brigadeId: brigade.id,
        employeeId: input.employeeId ?? null,
        contractorWorkerId: input.contractorWorkerId ?? null,
        roleCode: input.roleCode,
        status: input.status,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: brigade.permit.organizationId,
      action: "brigade_member.created",
      entityType: "BrigadeMember",
      entityId: brigadeMember.id,
      metadata: {
        brigadeId: brigade.id,
        roleCode: brigadeMember.roleCode,
      },
    });

    return brigadeMember;
  }

  async approveWorkPermit(user: AuthenticatedUser, permitId: string) {
    const permit = await this.prisma.workPermit.findUnique({
      where: { id: permitId },
      include: {
        currentVersion: true,
      },
    });

    if (!permit) {
      throw new NotFoundException("Work permit not found.");
    }

    await this.resolveOrganizationRecord(user, permit.organizationId);

    const updated = await this.prisma.$transaction(async (transaction) => {
      if (permit.currentVersion) {
        const nextPayload = this.withPermitEntryPatch(permit.currentVersion.payloadJson, {
          status: "approved",
          approvalStatus: "approved",
          approvedAt: new Date().toISOString(),
        });

        await transaction.workPermitVersion.update({
          where: { id: permit.currentVersion.id },
          data: {
            status: "FINAL",
            payloadJson: this.json(nextPayload),
          },
        });
      }

      return transaction.workPermit.update({
        where: { id: permit.id },
        data: {
          status: "APPROVED",
        },
      });
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: permit.organizationId,
      action: "work_permit.approved",
      entityType: "WorkPermit",
      entityId: permit.id,
    });

    return updated;
  }

  async signWorkPermit(
    user: AuthenticatedUser,
    permitId: string,
    input: Omit<CreateSignatureInput, "envelopeId" | "versionId" | "status">,
  ) {
    const permit = await this.prisma.workPermit.findUnique({
      where: { id: permitId },
      include: {
        currentVersion: true,
      },
    });

    if (!permit || !permit.currentVersion || !permit.currentVersion.documentEnvelopeId) {
      throw new NotFoundException("Work permit version is not ready for signing.");
    }

    await this.resolveOrganizationRecord(user, permit.organizationId);

    const signature = await this.signEnvelopeDocument(
      user,
      permit.currentVersion.documentEnvelopeId,
      permit.currentVersion.id,
      input,
    );

    await this.prisma.$transaction(async (transaction) => {
      const nextPayload = this.withPermitEntryPatch(permit.currentVersion!.payloadJson, {
        status: "approved",
        signatureStatus: "signed",
        signedAt: new Date().toISOString(),
      });

      await transaction.workPermitVersion.update({
        where: { id: permit.currentVersion!.id },
        data: {
          status: "SIGNED",
          payloadJson: this.json(nextPayload),
        },
      });

      await transaction.workPermit.update({
        where: { id: permit.id },
        data: {
          status: "SIGNED",
        },
      });
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: permit.organizationId,
      action: "work_permit.signed",
      entityType: "WorkPermit",
      entityId: permit.id,
      metadata: {
        signatureId: signature.id,
      },
    });

    return signature;
  }

  async activateWorkPermit(
    user: AuthenticatedUser,
    permitId: string,
    input: WorkPermitWorkflowInput,
  ) {
    const permit = await this.prisma.workPermit.findUnique({
      where: { id: permitId },
      include: {
        currentVersion: true,
      },
    });

    if (!permit || !permit.currentVersion) {
      throw new NotFoundException("Work permit version not found.");
    }

    await this.resolveOrganizationRecord(user, permit.organizationId);

    if (permit.status !== "APPROVED" && permit.status !== "SIGNED") {
      throw new BadRequestException("Only approved or signed work permits can be activated.");
    }

    const now = new Date();
    const nextPayload = this.withPermitEntryPatch(permit.currentVersion.payloadJson, {
      status: "active",
      activatedAt: now.toISOString(),
      activationComment: input.comment ?? null,
    });

    await this.prisma.$transaction(async (transaction) => {
      await transaction.workPermitVersion.update({
        where: { id: permit.currentVersion!.id },
        data: {
          payloadJson: this.json(nextPayload),
        },
      });

      await transaction.workPermit.update({
        where: { id: permit.id },
        data: {
          status: "ACTIVE",
          startedAt: now,
        },
      });
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: permit.organizationId,
      action: "work_permit.activated",
      entityType: "WorkPermit",
      entityId: permit.id,
    });

    return this.getWorkPermit(user, permit.id);
  }

  async suspendWorkPermit(
    user: AuthenticatedUser,
    permitId: string,
    input: WorkPermitWorkflowInput,
  ) {
    const permit = await this.prisma.workPermit.findUnique({
      where: { id: permitId },
      include: {
        currentVersion: true,
      },
    });

    if (!permit || !permit.currentVersion) {
      throw new NotFoundException("Work permit version not found.");
    }

    await this.resolveOrganizationRecord(user, permit.organizationId);

    if (permit.status !== "ACTIVE") {
      throw new BadRequestException("Only active work permits can be suspended.");
    }

    const reason = input.reason ?? input.comment ?? null;

    if (!reason) {
      throw new BadRequestException("Suspension reason is required.");
    }

    const nextPayload = this.withPermitEntryPatch(permit.currentVersion.payloadJson, {
      status: "suspended",
      suspensionReason: reason,
      suspendedAt: new Date().toISOString(),
    });

    await this.prisma.$transaction(async (transaction) => {
      await transaction.workPermitVersion.update({
        where: { id: permit.currentVersion!.id },
        data: {
          payloadJson: this.json(nextPayload),
        },
      });

      await transaction.workPermit.update({
        where: { id: permit.id },
        data: {
          status: "SUSPENDED",
        },
      });
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: permit.organizationId,
      action: "work_permit.suspended",
      entityType: "WorkPermit",
      entityId: permit.id,
      metadata: {
        reason,
      },
    });

    return this.getWorkPermit(user, permit.id);
  }

  async closeWorkPermit(
    user: AuthenticatedUser,
    permitId: string,
    input?: WorkPermitWorkflowInput,
  ) {
    const permit = await this.prisma.workPermit.findUnique({
      where: { id: permitId },
      include: {
        currentVersion: true,
      },
    });

    if (!permit) {
      throw new NotFoundException("Work permit not found.");
    }

    await this.resolveOrganizationRecord(user, permit.organizationId);

    if (permit.status !== "ACTIVE" && permit.status !== "SUSPENDED") {
      throw new BadRequestException("Only active or suspended work permits can be closed.");
    }

    const now = new Date();
    const nextPayload = permit.currentVersion
      ? this.withPermitEntryPatch(permit.currentVersion.payloadJson, {
          status: "closed",
          closure: input?.closure ?? {
            closedAt: now.toISOString(),
            comment: input?.comment ?? null,
          },
          closedAt: now.toISOString(),
        })
      : null;

    const updated = await this.prisma.$transaction(async (transaction) => {
      if (permit.currentVersion && nextPayload) {
        await transaction.workPermitVersion.update({
          where: { id: permit.currentVersion.id },
          data: {
            payloadJson: this.json(nextPayload),
          },
        });
      }

      return transaction.workPermit.update({
        where: { id: permit.id },
        data: {
          status: "CLOSED",
          closedAt: now,
        },
      });
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: permit.organizationId,
      action: "work_permit.closed",
      entityType: "WorkPermit",
      entityId: permit.id,
    });

    return updated;
  }

  async annulWorkPermit(
    user: AuthenticatedUser,
    permitId: string,
    input?: WorkPermitWorkflowInput,
  ) {
    const permit = await this.prisma.workPermit.findUnique({
      where: { id: permitId },
      include: {
        currentVersion: true,
      },
    });

    if (!permit) {
      throw new NotFoundException("Work permit not found.");
    }

    await this.resolveOrganizationRecord(user, permit.organizationId);

    const nextPayload = permit.currentVersion
      ? this.withPermitEntryPatch(permit.currentVersion.payloadJson, {
          status: "cancelled",
          cancellationReason: input?.reason ?? input?.comment ?? null,
          cancelledAt: new Date().toISOString(),
        })
      : null;

    const updated = await this.prisma.$transaction(async (transaction) => {
      if (permit.currentVersion && nextPayload) {
        await transaction.workPermitVersion.update({
          where: { id: permit.currentVersion.id },
          data: {
            payloadJson: this.json(nextPayload),
          },
        });
      }

      return transaction.workPermit.update({
        where: { id: permit.id },
        data: {
          status: "ANNULLED",
        },
      });
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: permit.organizationId,
      action: "work_permit.annulled",
      entityType: "WorkPermit",
      entityId: permit.id,
    });

    return updated;
  }

  */
  async listQualificationDocuments(user: AuthenticatedUser, organizationId?: string) {
    const organization = await this.resolveOrganizationRecord(user, organizationId ?? null);
    return this.prisma.qualificationDocument.findMany({
      where: { organizationId: organization.id },
      include: {
        clearanceType: true,
        trainingType: true,
        documentEnvelope: true,
        contractorWorker: {
          include: {
            contractorOrganization: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    });
  }

  async createQualificationDocument(
    user: AuthenticatedUser,
    input: CreateQualificationDocumentInput,
  ) {
    const organization = await this.resolveOrganizationRecord(
      user,
      input.organizationId ?? null,
    );

    if (!input.employeeId && !input.contractorWorkerId) {
      throw new BadRequestException("Either employeeId or contractorWorkerId is required.");
    }

    if (input.employeeId) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: input.employeeId },
      });
      if (!employee || employee.companyId !== organization.id) {
        throw new BadRequestException("Employee does not belong to the organization.");
      }
    }

    if (input.contractorWorkerId) {
      const contractorWorker = await this.prisma.contractorWorker.findUnique({
        where: { id: input.contractorWorkerId },
      });
      if (!contractorWorker || contractorWorker.organizationId !== organization.id) {
        throw new BadRequestException("Contractor worker does not belong to the organization.");
      }
    }

    if (input.clearanceTypeId) {
      const clearanceType = await this.prisma.clearanceType.findUnique({
        where: { id: input.clearanceTypeId },
      });
      if (!clearanceType || clearanceType.organizationId !== organization.id) {
        throw new BadRequestException("Clearance type does not belong to the organization.");
      }

      await this.resolveOrganizationRecord(user, clearanceType.organizationId);
    }

    if (input.trainingTypeId) {
      const trainingType = await this.prisma.trainingType.findUnique({
        where: { id: input.trainingTypeId },
      });
      if (!trainingType || trainingType.organizationId !== organization.id) {
        throw new BadRequestException("Training type does not belong to the organization.");
      }

      await this.resolveOrganizationRecord(user, trainingType.organizationId);
    }

    const qualificationDocument = await this.prisma.qualificationDocument.create({
      data: {
        organizationId: organization.id,
        employeeId: input.employeeId ?? null,
        contractorWorkerId: input.contractorWorkerId ?? null,
        clearanceTypeId: input.clearanceTypeId ?? null,
        trainingTypeId: input.trainingTypeId ?? null,
        documentKind: input.documentKind,
        documentNumber: input.documentNumber,
        issueDate: new Date(input.issueDate),
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
        status: input.status,
        documentEnvelopeId: input.documentEnvelopeId ?? null,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: organization.id,
      action: "qualification_document.created",
      entityType: "QualificationDocument",
      entityId: qualificationDocument.id,
      metadata: {
        documentNumber: qualificationDocument.documentNumber,
        documentKind: qualificationDocument.documentKind,
      },
    });

    return qualificationDocument;
  }

  async listAdmissionEvaluations(user: AuthenticatedUser, organizationId?: string) {
    const organization = await this.resolveOrganizationRecord(user, organizationId ?? null);
    const evaluations = await this.prisma.admissionEvaluation.findMany({
      where: { organizationId: organization.id },
      orderBy: [{ evaluatedAt: "desc" }],
    });

    return evaluations.map((evaluation) => ({
      ...evaluation,
      checks: evaluation.checksJson,
      warnings: evaluation.warningsJson,
      nextActions: evaluation.nextActionsJson,
    }));
  }

  async checkAdmission(
    user: AuthenticatedUser,
    input: CreateAdmissionCheckInput,
  ) {
    const organization = await this.resolveOrganizationRecord(
      user,
      input.organizationId ?? null,
    );

    const subjectId = input.subjectType === "EMPLOYEE"
      ? (input.employeeId ?? input.subjectId)
      : (input.contractorWorkerId ?? input.subjectId);

    if (input.subjectType === "EMPLOYEE") {
      const employee = await this.prisma.employee.findUnique({
        where: { id: subjectId },
      });
      if (!employee || employee.companyId !== organization.id) {
        throw new BadRequestException("Employee does not belong to the organization.");
      }
    } else {
      const contractorWorker = await this.prisma.contractorWorker.findUnique({
        where: { id: subjectId },
      });
      if (!contractorWorker || contractorWorker.organizationId !== organization.id) {
        throw new BadRequestException("Contractor worker does not belong to the organization.");
      }
    }

    const evaluatedAt = input.evaluatedAt ? new Date(input.evaluatedAt) : new Date();
    const subjectQuery = input.subjectType === "EMPLOYEE"
      ? { employeeId: subjectId }
      : { contractorWorkerId: subjectId };

    const [matrixVersion, trainingPlanVersion, briefingEntry, permit, qualificationDocs] = await Promise.all([
      input.matrixVersionId
        ? this.prisma.jobRequirementMatrixVersion.findUnique({
            where: { id: input.matrixVersionId },
            include: { matrix: true },
          })
        : Promise.resolve(null),
      input.trainingPlanVersionId
        ? this.prisma.trainingPlanVersion.findUnique({
            where: { id: input.trainingPlanVersionId },
            include: { trainingPlan: true },
          })
        : Promise.resolve(null),
      input.briefingJournalEntryId
        ? this.prisma.briefingJournalEntry.findUnique({
            where: { id: input.briefingJournalEntryId },
            include: { journal: true },
          })
        : Promise.resolve(null),
      input.workPermitId
        ? this.prisma.workPermit.findUnique({
            where: { id: input.workPermitId },
          })
        : Promise.resolve(null),
      this.prisma.qualificationDocument.findMany({
        where: {
          organizationId: organization.id,
          ...subjectQuery,
          status: {
            in: ["ACTIVE", "EXPIRING"],
          },
        },
        orderBy: [{ expiryDate: "asc" }],
      }),
    ]);

    const medicalClearance = qualificationDocs.find((doc) => doc.documentKind === "MEDICAL_CLEARANCE") ?? null;
    const activeQualification = qualificationDocs.find((doc) => doc.status === "ACTIVE") ?? null;
    const hasMatrixVersion = Boolean(
      matrixVersion
        && matrixVersion.matrix.organizationId === organization.id
        && matrixVersion.status !== "ANNULLED"
        && matrixVersion.status !== "SUPERSEDED",
    );
    const hasTrainingPlanVersion = Boolean(trainingPlanVersion && trainingPlanVersion.trainingPlan.organizationId === organization.id && trainingPlanVersion.status !== "VOIDED");
    const hasBriefingJournalEntry = Boolean(briefingEntry && briefingEntry.journal.organizationId === organization.id);
    const briefingIsSigned = Boolean(briefingEntry && briefingEntry.status === "SIGNED");
    const hasMedicalClearance = Boolean(medicalClearance && (!medicalClearance.expiryDate || medicalClearance.expiryDate.getTime() >= evaluatedAt.getTime()));
    const medicalClearanceExpiringSoon = Boolean(medicalClearance?.expiryDate && medicalClearance.expiryDate.getTime() - evaluatedAt.getTime() <= 1000 * 60 * 60 * 24 * 30);
    const hasActiveQualificationDocument = Boolean(activeQualification);
    const qualificationExpiringSoon = Boolean(activeQualification?.expiryDate && activeQualification.expiryDate.getTime() - evaluatedAt.getTime() <= 1000 * 60 * 60 * 24 * 30);
    const requiresPermit = derivePermitRequirement(input.workType);
    const workPermitRequired = requiresPermit;
    const hasWorkPermit = Boolean(permit && permit.organizationId === organization.id);
    const workPermitIsActive = Boolean(permit && permit.organizationId === organization.id && permit.status === "ACTIVE");
    const workPermitExpiringSoon = Boolean(
      permit && permit.organizationId === organization.id && permit.effectiveTo && permit.effectiveTo.getTime() - evaluatedAt.getTime() <= 1000 * 60 * 60 * 24 * 30,
    );

    const decision = evaluateAdmissionDecision(input, {
      hasMatrixVersion,
      hasTrainingPlanVersion,
      hasBriefingJournalEntry,
      briefingIsSigned,
      hasMedicalClearance,
      medicalClearanceExpiringSoon,
      hasActiveQualificationDocument,
      qualificationExpiringSoon,
      requiresPermit: workPermitRequired,
      hasWorkPermit,
      workPermitIsActive,
      workPermitExpiringSoon,
    });

    const expiryCandidates = [
      medicalClearance?.expiryDate ?? null,
      activeQualification?.expiryDate ?? null,
      permit?.effectiveTo ?? null,
    ].filter((value): value is Date => Boolean(value));
    const nextReviewAt = expiryCandidates.sort((left, right) => left.getTime() - right.getTime())[0] ?? null;

    const evaluation = await this.prisma.admissionEvaluation.create({
      data: {
        organizationId: organization.id,
        subjectType: input.subjectType,
        subjectId,
        employeeId: input.employeeId ?? null,
        contractorWorkerId: input.contractorWorkerId ?? null,
        branchId: input.branchId ?? null,
        departmentId: input.departmentId ?? null,
        workSiteId: input.workSiteId ?? null,
        positionId: input.positionId ?? null,
        workType: input.workType,
        matrixId: matrixVersion?.matrixId ?? null,
        matrixVersionId: input.matrixVersionId ?? null,
        trainingPlanVersionId: input.trainingPlanVersionId ?? null,
        briefingJournalEntryId: input.briefingJournalEntryId ?? null,
        workPermitId: input.workPermitId ?? null,
        status: decision.status,
        decisionCode: decision.decisionCode,
        ruleVersion: decision.ruleVersion,
        evaluatedAt,
        nextReviewAt,
        checksJson: this.json(decision.checks),
        warningsJson: this.json(decision.warnings),
        nextActionsJson: this.json(decision.nextActions),
        resultJson: this.json(decision),
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: organization.id,
      action: "admission.checked",
      entityType: "AdmissionEvaluation",
      entityId: evaluation.id,
      metadata: {
        subjectType: evaluation.subjectType,
        subjectId: evaluation.subjectId,
        status: evaluation.status,
        decisionCode: evaluation.decisionCode,
      },
    });

    return {
      ...evaluation,
      checks: decision.checks,
      warnings: decision.warnings,
      nextActions: decision.nextActions,
    };
  }

  async getAdmissionEvaluation(user: AuthenticatedUser, evaluationId: string) {
    const evaluation = await this.prisma.admissionEvaluation.findUnique({
      where: { id: evaluationId },
    });

    if (!evaluation) {
      throw new NotFoundException("Admission evaluation not found.");
    }

    await this.resolveOrganizationRecord(user, evaluation.organizationId);

    return {
      ...evaluation,
      checks: evaluation.checksJson,
      warnings: evaluation.warningsJson,
      nextActions: evaluation.nextActionsJson,
    };
  }

  async listBriefingJournalEntries(
    user: AuthenticatedUser,
    organizationId?: string,
  ) {
    const organization = await this.resolveOrganizationRecord(
      user,
      organizationId ?? null,
    );
    return this.prisma.briefingJournalEntry.findMany({
      where: { organizationId: organization.id },
      orderBy: [{ briefingDate: "desc" }, { entryNo: "desc" }],
    });
  }

  async listBriefingJournals(user: AuthenticatedUser, organizationId?: string) {
    const organization = await this.resolveOrganizationRecord(user, organizationId ?? null);
    return this.prisma.briefingJournal.findMany({
      where: { organizationId: organization.id },
      include: {
        entries: {
          orderBy: { entryNo: "asc" },
          include: {
            signatures: {
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
      orderBy: [{ journalCode: "asc" }],
    });
  }

  async createBriefingJournal(
    user: AuthenticatedUser,
    input: CreateBriefingJournalInput,
  ) {
    const scope = resolveCanonicalScope(user, {
      organizationId: input.organizationId ?? null,
      branchId: input.branchId ?? null,
      departmentId: input.departmentId ?? null,
      workSiteId: input.workSiteId ?? null,
    });
    const organization = await this.ensureOrganizationRecord(scope.organizationId);
    await Promise.all([
      this.ensureBranchInOrganization(organization.id, input.branchId ?? null),
      this.ensureDepartmentInOrganization(organization.id, input.departmentId ?? null),
      this.ensureWorkSiteInOrganization(organization.id, input.workSiteId ?? null),
    ]);

    if (input.status !== "DRAFT" && input.status !== "IN_APPROVAL" && input.status !== "SIGNING_READY") {
      throw new BadRequestException("Invalid briefing journal status.");
    }

    const journal = await this.prisma.briefingJournal.create({
      data: {
        organizationId: organization.id,
        journalCode: input.journalCode,
        title: input.title,
        scopeType: input.scopeType,
        branchId: input.branchId ?? null,
        departmentId: input.departmentId ?? null,
        workSiteId: input.workSiteId ?? null,
        status: input.status,
        effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: organization.id,
      action: "briefing_journal.created",
      entityType: "BriefingJournal",
      entityId: journal.id,
      metadata: {
        journalCode: journal.journalCode,
        scopeType: journal.scopeType,
      },
    });

    return journal;
  }

  async createBriefingJournalEntry(
    user: AuthenticatedUser,
    input: CreateBriefingJournalEntryInput,
  ) {
    const journal = await this.prisma.briefingJournal.findUnique({
      where: { id: input.journalId },
    });

    if (!journal) {
      throw new NotFoundException("Briefing journal not found.");
    }

    await this.resolveOrganizationRecord(user, journal.organizationId);

    const employee = await this.prisma.employee.findUnique({
      where: { id: input.employeeId },
    });
    if (!employee || employee.companyId !== journal.organizationId) {
      throw new BadRequestException("Employee does not belong to the organization.");
    }

    const instructor = await this.prisma.user.findUnique({
      where: { id: input.instructorUserId },
    });
    if (!instructor || instructor.companyId !== journal.organizationId) {
      throw new BadRequestException("Instructor does not belong to the organization.");
    }

    const latest = await this.prisma.briefingJournalEntry.findFirst({
      where: { journalId: journal.id },
      orderBy: { entryNo: "desc" },
      select: { entryNo: true },
    });
    const entryNo = input.entryNo ?? ((latest?.entryNo ?? 0) + 1);

    const entry = await this.prisma.briefingJournalEntry.create({
      data: {
        organizationId: input.organizationId ?? journal.organizationId,
        journalId: journal.id,
        entryNo,
        registrationNo: input.registrationNo ?? null,
        journalKind: input.journalKind,
        employeeId: input.employeeId,
        instructorUserId: input.instructorUserId,
        departmentId: input.departmentId ?? null,
        workSiteId: input.workSiteId ?? null,
        briefingType: input.briefingType,
        status: input.status,
        employeeStatus: input.employeeStatus,
        briefingDate: new Date(input.briefingDate),
        briefingTime: input.briefingTime ? new Date(input.briefingTime) : null,
        topic: input.topic,
        program: input.program ?? null,
        basis: input.basis ?? null,
        unscheduledReason: input.unscheduledReason ?? null,
        notes: input.notes ?? null,
        openedAt: input.openedAt ? new Date(input.openedAt) : null,
        acknowledgedAt: input.acknowledgedAt ? new Date(input.acknowledgedAt) : null,
        signedAt: input.signedAt ? new Date(input.signedAt) : null,
        archivedAt: input.archivedAt ? new Date(input.archivedAt) : null,
        finalSignedAt: input.finalSignedAt ? new Date(input.finalSignedAt) : null,
        documentHash: input.documentHash ?? null,
        documentEnvelopeId: input.documentEnvelopeId ?? null,
        archiveRecordId: input.archiveRecordId ?? null,
        retentionPolicyId: input.retentionPolicyId ?? null,
        replacesEntryId: input.replacesEntryId ?? null,
        annulReason: input.annulReason ?? null,
        createdByUserId: input.createdByUserId ?? user.userId,
        updatedByUserId: input.updatedByUserId ?? user.userId,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: journal.organizationId,
      action: "briefing_journal_entry.created",
      entityType: "BriefingJournalEntry",
      entityId: entry.id,
      metadata: {
        journalId: journal.id,
        entryNo: entry.entryNo,
        briefingType: entry.briefingType,
      },
    });

    return entry;
  }

  async openBriefingJournalEntry(user: AuthenticatedUser, entryId: string) {
    const entry = await this.prisma.briefingJournalEntry.findUnique({
      where: { id: entryId },
      include: { journal: true },
    });

    if (!entry) {
      throw new NotFoundException("Briefing journal entry not found.");
    }

    await this.resolveOrganizationRecord(user, entry.journal.organizationId);

    return this.prisma.briefingJournalEntry.update({
      where: { id: entry.id },
      data: {
        status: "OPENED",
        employeeStatus: "OPENED",
        openedAt: entry.openedAt ?? new Date(),
      },
    });
  }

  async acknowledgeBriefingJournalEntry(user: AuthenticatedUser, entryId: string) {
    const entry = await this.prisma.briefingJournalEntry.findUnique({
      where: { id: entryId },
      include: { journal: true },
    });

    if (!entry) {
      throw new NotFoundException("Briefing journal entry not found.");
    }

    await this.resolveOrganizationRecord(user, entry.journal.organizationId);

    return this.prisma.briefingJournalEntry.update({
      where: { id: entry.id },
      data: {
        status: "ACKNOWLEDGED",
        employeeStatus: "ACKNOWLEDGED",
        openedAt: entry.openedAt ?? new Date(),
        acknowledgedAt: new Date(),
      },
    });
  }



  async listDocumentTemplates(user: AuthenticatedUser, organizationId?: string) {
    const organization = await this.resolveOrganizationRecord(user, organizationId ?? null);
    return this.prisma.documentTemplate.findMany({
      where: { organizationId: organization.id },
      orderBy: [{ templateCode: "asc" }, { templateVersion: "desc" }],
    });
  }

  async createDocumentTemplate(
    user: AuthenticatedUser,
    input: CreateDocumentTemplateInput,
  ) {
    const organization = await this.resolveOrganizationRecord(
      user,
      input.organizationId ?? null,
    );

    const template = await this.prisma.documentTemplate.create({
      data: {
        organizationId: organization.id,
        templateCode: input.templateCode,
        documentKind: input.documentKind,
        scopeType: input.scopeType,
        templateVersion: input.templateVersion,
        status: input.status,
        schemaJson: this.json(input.schemaJson),
        renderPolicyJson: this.json(input.renderPolicyJson),
        effectiveFrom: new Date(input.effectiveFrom),
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: organization.id,
      action: "document_template.created",
      entityType: "DocumentTemplate",
      entityId: template.id,
      metadata: {
        templateCode: template.templateCode,
        documentKind: template.documentKind,
        scopeType: template.scopeType,
        templateVersion: template.templateVersion,
      },
    });

    return template;
  }

  async listApprovalRoutes(user: AuthenticatedUser, organizationId?: string) {
    const organization = await this.resolveOrganizationRecord(user, organizationId ?? null);
    return this.prisma.approvalRoute.findMany({
      where: { organizationId: organization.id },
      include: {
        steps: {
          orderBy: { stepNo: "asc" },
        },
      },
      orderBy: [{ routeCode: "asc" }, { routeVersion: "desc" }],
    });
  }

  async createApprovalRoute(
    user: AuthenticatedUser,
    input: CreateApprovalRouteInput,
  ) {
    const organization = await this.resolveOrganizationRecord(
      user,
      input.organizationId ?? null,
    );

    const route = await this.prisma.approvalRoute.create({
      data: {
        organizationId: organization.id,
        routeCode: input.routeCode,
        documentKind: input.documentKind,
        scopeType: input.scopeType,
        routeVersion: input.routeVersion,
        status: input.status,
        isDefault: input.isDefault,
        effectiveFrom: new Date(input.effectiveFrom),
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: organization.id,
      action: "approval_route.created",
      entityType: "ApprovalRoute",
      entityId: route.id,
      metadata: {
        routeCode: route.routeCode,
        documentKind: route.documentKind,
        scopeType: route.scopeType,
        routeVersion: route.routeVersion,
      },
    });

    return route;
  }

  async createApprovalStep(user: AuthenticatedUser, input: CreateApprovalStepInput) {
    const route = await this.prisma.approvalRoute.findUnique({
      where: { id: input.routeId },
    });

    if (!route) {
      throw new NotFoundException("Approval route not found.");
    }

    await this.resolveOrganizationRecord(user, route.organizationId);

    await Promise.all([
      this.ensureDepartmentInOrganization(route.organizationId, input.requiredDepartmentId ?? null),
      this.ensureBranchInOrganization(route.organizationId, input.requiredBranchId ?? null),
      this.ensureWorkSiteInOrganization(route.organizationId, input.requiredWorkSiteId ?? null),
    ]);

    const step = await this.prisma.approvalStep.create({
      data: {
        routeId: input.routeId,
        stepNo: input.stepNo,
        groupKey: input.groupKey ?? null,
        quorum: input.quorum,
        action: input.action,
        requiredRoleCode: input.requiredRoleCode ?? null,
        requiredPrincipalType: input.requiredPrincipalType ?? null,
        requiredPrincipalId: input.requiredPrincipalId ?? null,
        requiredDepartmentId: input.requiredDepartmentId ?? null,
        requiredBranchId: input.requiredBranchId ?? null,
        requiredWorkSiteId: input.requiredWorkSiteId ?? null,
        slaHours: input.slaHours ?? null,
        isMandatory: input.isMandatory,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: route.organizationId,
      action: "approval_step.created",
      entityType: "ApprovalStep",
      entityId: step.id,
      metadata: {
        routeId: step.routeId,
        stepNo: step.stepNo,
        action: step.action,
      },
    });

    return step;
  }

  async listDocumentEnvelopes(user: AuthenticatedUser, organizationId?: string) {
    const organization = await this.resolveOrganizationRecord(user, organizationId ?? null);
    const envelopes = await this.prisma.documentEnvelope.findMany({
      where: { organizationId: organization.id },
      include: {
        currentVersion: true,
        template: true,
        approvalRoute: {
          include: {
            steps: {
              orderBy: { stepNo: "asc" },
            },
          },
        },
        signatures: {
          orderBy: { createdAt: "desc" },
        },
        archiveRecords: true,
        exportSnapshots: true,
      },
      orderBy: [{ createdAt: "desc" }],
    });

    return envelopes.map((envelope) => ({
      ...envelope,
      canonicalDocument: this.mapCanonicalDocument(envelope),
    }));
  }

  async createDocumentEnvelope(
    user: AuthenticatedUser,
    input: CreateDocumentEnvelopeInput,
  ) {
    const organization = await this.resolveOrganizationRecord(
      user,
      input.scope.organizationId,
    );

    await Promise.all([
      this.ensureBranchInOrganization(organization.id, input.scope.branchId ?? null),
      this.ensureDepartmentInOrganization(organization.id, input.scope.departmentId ?? null),
      this.ensureWorkSiteInOrganization(organization.id, input.scope.workSiteId ?? null),
      this.ensureDocumentTemplateInOrganization(organization.id, input.templateId ?? null),
      this.ensureApprovalRouteInOrganization(organization.id, input.approvalRouteId ?? null),
    ]);

    const scopeType = this.deriveScopeType(input.scope);

    const envelope = await this.prisma.documentEnvelope.create({
      data: {
        organizationId: organization.id,
        documentKind: input.documentKind,
        scopeType,
        branchId: input.scope.branchId ?? null,
        departmentId: input.scope.departmentId ?? null,
        workSiteId: input.scope.workSiteId ?? null,
        businessObjectType: input.businessObjectType,
        businessObjectId: input.businessObjectId,
        documentNumber: input.documentNumber,
        title: input.title,
        status: input.status,
        templateId: input.templateId ?? null,
        approvalRouteId: input.approvalRouteId ?? null,
        createdByUserId: user.userId,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: organization.id,
      action: "document_envelope.created",
      entityType: "DocumentEnvelope",
      entityId: envelope.id,
      metadata: {
        documentKind: envelope.documentKind,
        documentNumber: envelope.documentNumber,
        scopeType: envelope.scopeType,
      },
    });

    return envelope;
  }

  async createDocumentVersion(
    user: AuthenticatedUser,
    input: CreateDocumentVersionInput,
  ) {
    const envelope = await this.prisma.documentEnvelope.findUnique({
      where: { id: input.envelopeId },
      include: {
        currentVersion: true,
      },
    });

    if (!envelope) {
      throw new NotFoundException("Document envelope not found.");
    }

    await this.resolveOrganizationRecord(user, envelope.organizationId);
    await this.ensureDocumentTemplateInOrganization(envelope.organizationId, input.templateId ?? null);

    if (envelope.documentKind === "WORK_PERMIT") {
      throw new BadRequestException(
        "Work permit versions are managed only by the work permit lifecycle.",
      );
    }

    if (envelope.currentVersion?.status === "SIGNED" || envelope.status === "SIGNED") {
      throw new BadRequestException(
        "Signed documents are immutable. Create a replacement or annulment flow instead of mutating the signed revision.",
      );
    }

    const latest = await this.prisma.documentVersion.findFirst({
      where: { envelopeId: envelope.id },
      orderBy: { versionNo: "desc" },
      select: { versionNo: true },
    });

    const versionNo = input.versionNo ?? (await this.nextVersionNo(latest ? [latest] : []));
    const version = await this.prisma.documentVersion.create({
      data: {
        envelopeId: envelope.id,
        versionNo,
        templateId: input.templateId ?? null,
        status: input.status,
        payloadJson: this.json(input.payloadJson),
        renderedHash: input.renderedHash ?? null,
        changeReason: input.changeReason ?? null,
        createdByUserId: user.userId,
        signedAt: input.status === "SIGNED" ? new Date() : null,
        annulledAt: input.status === "VOIDED" ? new Date() : null,
      },
    });

    await this.prisma.documentEnvelope.update({
      where: { id: envelope.id },
      data: {
        currentVersionId: version.id,
        status: this.normalizeDocumentVersionStatus(version.status),
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: envelope.organizationId,
      action: "document_version.created",
      entityType: "DocumentVersion",
      entityId: version.id,
      metadata: {
        envelopeId: envelope.id,
        versionNo: version.versionNo,
        status: version.status,
      },
    });

    return version;
  }

  async listCertificateMetadata(user: AuthenticatedUser, organizationId?: string) {
    const organization = await this.resolveOrganizationRecord(user, organizationId ?? null);
    return this.prisma.certificateMetadata.findMany({
      where: { organizationId: organization.id },
      orderBy: [{ createdAt: "desc" }],
    });
  }

  async createCertificateMetadata(
    user: AuthenticatedUser,
    input: CreateCertificateMetadataInput,
  ) {
    const organization = await this.resolveOrganizationRecord(
      user,
      input.organizationId ?? null,
    );

    const certificateMetadata = await this.prisma.certificateMetadata.create({
      data: {
        organizationId: organization.id,
        provider: input.provider,
        serial: input.serial,
        thumbprint: input.thumbprint,
        subjectDn: input.subjectDn,
        issuerDn: input.issuerDn,
        validFrom: new Date(input.validFrom),
        validTo: new Date(input.validTo),
        source: input.source,
        isRevoked: input.isRevoked,
        revocationReason: input.revocationReason ?? null,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: organization.id,
      action: "certificate_metadata.created",
      entityType: "CertificateMetadata",
      entityId: certificateMetadata.id,
      metadata: {
        serial: certificateMetadata.serial,
        provider: certificateMetadata.provider,
      },
    });

    return certificateMetadata;
  }

  async createSignature(
    user: AuthenticatedUser,
    input: CreateSignatureInput,
  ) {
    if (!input.envelopeId) {
      throw new BadRequestException("envelopeId is required for the core platform signature flow.");
    }

    const envelope = await this.prisma.documentEnvelope.findUnique({
      where: { id: input.envelopeId },
      include: {
        currentVersion: true,
      },
    });

    if (!envelope) {
      throw new NotFoundException("Document envelope not found.");
    }

    const organization = await this.resolveOrganizationRecord(user, envelope.organizationId);
    const versionId = input.versionId ?? envelope.currentVersionId;

    if (!versionId) {
      throw new BadRequestException("A document version must be resolved before signing.");
    }

    const version = await this.ensureDocumentVersionInEnvelope(envelope.id, versionId);

    if (version.status === "SIGNED" || envelope.status === "SIGNED") {
      throw new BadRequestException("The current document revision is already signed and immutable.");
    }

    if (input.certificateMetadataId) {
      const certificateMetadata = await this.prisma.certificateMetadata.findUnique({
        where: { id: input.certificateMetadataId },
      });

      if (!certificateMetadata || certificateMetadata.organizationId !== organization.id) {
        throw new BadRequestException("Certificate metadata does not belong to the organization.");
      }

      await this.resolveOrganizationRecord(user, certificateMetadata.organizationId);
    }

    const shouldVerify =
      input.status === "SIGNED" || input.status === "VERIFIED" || input.status === "FAILED" || input.status === "REVOKED";

    const signature = await this.prisma.$transaction(async (transaction) => {
      const createdSignature = await transaction.signature.create({
        data: {
          organizationId: organization.id,
          companyId: organization.id,
          briefingJournalEntryId: input.briefingJournalEntryId ?? null,
          documentEnvelopeId: envelope.id,
          documentVersionId: version.id,
          signerUserId: input.signerUserId ?? null,
          signerEmployeeId: input.signerEmployeeId ?? null,
          signerRole: input.signerRole ?? null,
          provider: input.provider as never,
          status: input.status,
          signerName: input.signerName,
          signerIinMasked: input.signerIinMasked,
          certificateSerial: input.certificateSerial,
          certificateMetadataId: input.certificateMetadataId ?? null,
          documentHash: input.documentHash,
          signatureHash: input.signatureHash ?? null,
          signedAt: input.signedAt ? new Date(input.signedAt) : null,
          verifiedAt: input.status === "SIGNED" || input.status === "VERIFIED" ? new Date() : null,
          payload: input.payload ? this.json(input.payload) : undefined,
        },
      });

      if (shouldVerify) {
        await transaction.signatureVerification.create({
          data: {
            signatureId: createdSignature.id,
            checkedAt: new Date(),
            result: input.status === "SIGNED" || input.status === "VERIFIED" ? "PASS" : "FAIL",
            chainStatus: input.status === "FAILED" ? "BROKEN" : "VALID",
            revocationStatus: input.status === "REVOKED" ? "REVOKED" : "CLEAR",
            evidenceJson: this.json({
              provider: input.provider,
              certificateSerial: input.certificateSerial,
              documentHash: input.documentHash,
              signatureHash: input.signatureHash ?? null,
            }),
            errorCode: input.status === "FAILED" ? "SIGNATURE_FAILED" : null,
            verifiedByUserId: input.signerUserId ?? user.userId,
          },
        });
      }

      if (
        (input.status === "SIGNED" || input.status === "VERIFIED") &&
        input.finalizeDocumentOnSign !== false
      ) {
        await transaction.documentVersion.update({
          where: { id: version.id },
          data: {
            status: "SIGNED",
            signedAt: new Date(),
          },
        });

        await transaction.documentEnvelope.update({
          where: { id: envelope.id },
          data: {
            currentVersionId: version.id,
            status: "SIGNED",
          },
        });
      }

      return createdSignature;
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: organization.id,
      action: "signature.created",
      entityType: "Signature",
      entityId: signature.id,
      metadata: {
        documentEnvelopeId: signature.documentEnvelopeId,
        documentVersionId: signature.documentVersionId,
        status: signature.status,
        provider: signature.provider,
      },
    });

    return this.mapSignature(signature);
  }

  async createSignatureVerification(
    user: AuthenticatedUser,
    input: CreateSignatureVerificationInput,
  ) {
    const signature = await this.prisma.signature.findUnique({
      where: { id: input.signatureId },
    });

    if (!signature) {
      throw new NotFoundException("Signature not found.");
    }

    const organizationId = signature.organizationId ?? signature.companyId ?? null;
    const organization = organizationId
      ? await this.resolveOrganizationRecord(user, organizationId)
      : null;

    const evidenceJson =
      input.evidenceJson === undefined
        ? undefined
        : input.evidenceJson === null
          ? Prisma.JsonNull
          : this.json(input.evidenceJson);

    const verification = await this.prisma.signatureVerification.upsert({
      where: { signatureId: input.signatureId },
      create: {
        signatureId: input.signatureId,
        checkedAt: new Date(),
        result: input.result,
        chainStatus: input.chainStatus ?? null,
        revocationStatus: input.revocationStatus ?? null,
        evidenceJson,
        errorCode: input.errorCode ?? null,
        verifiedByUserId: input.verifiedByUserId ?? user.userId,
      },
      update: {
        checkedAt: new Date(),
        result: input.result,
        chainStatus: input.chainStatus ?? null,
        revocationStatus: input.revocationStatus ?? null,
        evidenceJson,
        errorCode: input.errorCode ?? null,
        verifiedByUserId: input.verifiedByUserId ?? user.userId,
      },
    });

    await this.prisma.signature.update({
      where: { id: signature.id },
      data: {
        status: input.result === "PASS" ? "VERIFIED" : "FAILED",
        verifiedAt: input.result === "PASS" ? new Date() : null,
      },
    });

    if (organization) {
      await this.auditService.log({
        actorUserId: user.userId,
        companyId: organization.id,
        action: "signature.verified",
        entityType: "SignatureVerification",
        entityId: verification.id,
        metadata: {
          signatureId: signature.id,
          result: verification.result,
        },
      });
    }

    return verification;
  }

  async createAttachment(user: AuthenticatedUser, input: CreateAttachmentInput) {
    const organization = await this.resolveOrganizationRecord(
      user,
      input.organizationId ?? null,
    );

    switch (input.ownerType) {
      case "DOCUMENT_ENVELOPE":
        await this.ensureDocumentEnvelopeInOrganization(organization.id, input.ownerId);
        break;
      case "DOCUMENT_VERSION": {
        const version = await this.prisma.documentVersion.findUnique({
          where: { id: input.ownerId },
          include: { envelope: true },
        });
        if (!version || version.envelope.organizationId !== organization.id) {
          throw new BadRequestException("Document version does not belong to the organization.");
        }
        break;
      }
      case "WORK_PERMIT":
        await this.ensureWorkPermitInOrganization(organization.id, input.ownerId);
        break;
      case "WORK_PERMIT_VERSION": {
        const permitVersion = await this.prisma.workPermitVersion.findUnique({
          where: { id: input.ownerId },
          include: { permit: true },
        });
        if (!permitVersion || permitVersion.permit.organizationId !== organization.id) {
          throw new BadRequestException("Work permit version does not belong to the organization.");
        }
        break;
      }
      case "BRIEFING_JOURNAL_ENTRY": {
        const entry = await this.prisma.briefingJournalEntry.findUnique({
          where: { id: input.ownerId },
          include: { journal: true },
        });
        if (!entry || entry.journal.organizationId !== organization.id) {
          throw new BadRequestException("Briefing journal entry does not belong to the organization.");
        }
        break;
      }
      case "ORDER_VERSION": {
        const orderVersion = await this.prisma.orderVersion.findUnique({
          where: { id: input.ownerId },
          include: { order: true },
        });
        if (!orderVersion || orderVersion.order.organizationId !== organization.id) {
          throw new BadRequestException("Order version does not belong to the organization.");
        }
        break;
      }
      case "ARCHIVE_RECORD": {
        const archiveRecord = await this.prisma.archiveRecord.findUnique({
          where: { id: input.ownerId },
        });
        if (!archiveRecord || archiveRecord.organizationId !== organization.id) {
          throw new BadRequestException("Archive record does not belong to the organization.");
        }
        break;
      }
    }

    const attachment = await this.prisma.attachment.create({
      data: {
        organizationId: organization.id,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        sha256: input.sha256,
        storageUri: input.storageUri,
        createdByUserId: input.createdByUserId ?? user.userId,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: organization.id,
      action: "attachment.created",
      entityType: "Attachment",
      entityId: attachment.id,
      metadata: {
        ownerType: attachment.ownerType,
        ownerId: attachment.ownerId,
        fileName: attachment.fileName,
      },
    });

    return attachment;
  }

  async createExportSnapshot(
    user: AuthenticatedUser,
    input: CreateExportSnapshotInput,
  ) {
    const envelope = await this.prisma.documentEnvelope.findUnique({
      where: { id: input.envelopeId },
    });

    if (!envelope) {
      throw new NotFoundException("Document envelope not found.");
    }

    const organization = await this.resolveOrganizationRecord(user, envelope.organizationId);

    if (input.versionId) {
      await this.ensureDocumentVersionInEnvelope(envelope.id, input.versionId);
    }

    const snapshot = await this.prisma.exportSnapshot.create({
      data: {
        organizationId: organization.id,
        envelopeId: envelope.id,
        versionId: input.versionId ?? null,
        format: input.format,
        storageUri: input.storageUri,
        sha256: input.sha256,
        manifestJson:
          input.manifestJson === undefined
            ? undefined
            : input.manifestJson === null
              ? Prisma.JsonNull
              : this.json(input.manifestJson),
        generatedByUserId: input.generatedByUserId ?? user.userId,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: organization.id,
      action: "export_snapshot.created",
      entityType: "ExportSnapshot",
      entityId: snapshot.id,
      metadata: {
        envelopeId: envelope.id,
        versionId: snapshot.versionId,
        format: snapshot.format,
      },
    });

    return snapshot;
  }

  async buildEvidencePackage(
    user: AuthenticatedUser,
    envelopeId: string,
  ) {
    const envelope = await this.prisma.documentEnvelope.findUnique({
      where: { id: envelopeId },
      include: {
        currentVersion: true,
        signatures: {
          orderBy: { createdAt: "asc" },
          include: {
            certificateMetadata: true,
            verification: true,
          },
        },
        exportSnapshots: {
          orderBy: { generatedAt: "asc" },
        },
        archiveRecords: {
          orderBy: { createdAt: "asc" },
          include: {
            retentionPolicy: true,
          },
        },
      },
    });

    if (!envelope) {
      throw new NotFoundException("Document envelope not found.");
    }

    await this.resolveOrganizationRecord(user, envelope.organizationId);

    return {
      generatedAt: new Date(),
      document: this.mapCanonicalDocument(envelope),
      signatures: envelope.signatures.map((signature) => ({
        ...this.mapSignature(signature),
        certificateMetadata: signature.certificateMetadata,
        verification: signature.verification,
      })),
      exportSnapshots: envelope.exportSnapshots,
      archiveRecords: envelope.archiveRecords,
    };
  }

  async listRetentionPolicies(user: AuthenticatedUser, organizationId?: string) {
    const organization = await this.resolveOrganizationRecord(user, organizationId ?? null);
    return this.prisma.retentionPolicy.findMany({
      where: { organizationId: organization.id },
      orderBy: [{ retentionCode: "asc" }, { effectiveFrom: "desc" }],
    });
  }

  async createRetentionPolicy(
    user: AuthenticatedUser,
    input: CreateRetentionPolicyInput,
  ) {
    const organization = await this.resolveOrganizationRecord(
      user,
      input.organizationId ?? null,
    );

    const retentionPolicy = await this.prisma.retentionPolicy.create({
      data: {
        organizationId: organization.id,
        retentionCode: input.retentionCode,
        documentKind: input.documentKind,
        scopeType: input.scopeType,
        retentionValue: input.retentionValue,
        retentionUnit: input.retentionUnit,
        archiveFormat: input.archiveFormat,
        legalBasis: input.legalBasis,
        holdAllowed: input.holdAllowed,
        destructionApprovalRequired: input.destructionApprovalRequired,
        effectiveFrom: new Date(input.effectiveFrom),
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
        description: input.description ?? null,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: organization.id,
      action: "retention_policy.created",
      entityType: "RetentionPolicy",
      entityId: retentionPolicy.id,
      metadata: {
        retentionCode: retentionPolicy.retentionCode,
        documentKind: retentionPolicy.documentKind,
        scopeType: retentionPolicy.scopeType,
      },
    });

    return retentionPolicy;
  }

  async resolveRetentionPolicy(
    user: AuthenticatedUser,
    input: {
      organizationId?: string | null;
      documentKind: DocumentKind;
      scopeType: ScopeType;
      effectiveAt?: string | null;
    },
  ) {
    const organization = await this.resolveOrganizationRecord(
      user,
      input.organizationId ?? null,
    );

    return this.resolveRetentionPolicyBaseline({
      organizationId: organization.id,
      documentKind: input.documentKind,
      scopeType: input.scopeType,
      effectiveAt: input.effectiveAt ? new Date(input.effectiveAt) : new Date(),
    });
  }

  async ensureRetentionPolicyResolved(
    user: AuthenticatedUser,
    input: {
      organizationId?: string | null;
      documentKind: DocumentKind;
      scopeType: ScopeType;
      effectiveAt?: string | null;
    },
  ) {
    const organization = await this.resolveOrganizationRecord(
      user,
      input.organizationId ?? null,
    );
    const resolved = await this.resolveRetentionPolicyBaseline({
      organizationId: organization.id,
      documentKind: input.documentKind,
      scopeType: input.scopeType,
      effectiveAt: input.effectiveAt ? new Date(input.effectiveAt) : new Date(),
    });

    if (!resolved) {
      return null;
    }

    if (resolved.source === "configured") {
      return resolved;
    }

    return {
      source: resolved.source,
      policy: await this.materializeBaselineRetentionPolicy(resolved.policy),
    };
  }

  async listArchiveRecords(user: AuthenticatedUser, organizationId?: string) {
    const organization = await this.resolveOrganizationRecord(user, organizationId ?? null);
    return this.prisma.archiveRecord.findMany({
      where: { organizationId: organization.id },
      include: {
        envelope: true,
        version: true,
        retentionPolicy: true,
      },
      orderBy: [{ createdAt: "desc" }],
    });
  }

  async createArchiveRecord(
    user: AuthenticatedUser,
    input: CreateArchiveRecordInput,
  ) {
    const envelope = await this.prisma.documentEnvelope.findUnique({
      where: { id: input.envelopeId },
    });

    if (!envelope) {
      throw new NotFoundException("Document envelope not found.");
    }

    const organization = await this.resolveOrganizationRecord(user, envelope.organizationId);

    if (input.versionId) {
      await this.ensureDocumentVersionInEnvelope(envelope.id, input.versionId);
    }

    const retentionPolicy = await this.prisma.retentionPolicy.findUnique({
      where: { id: input.retentionPolicyId },
    });

    if (!retentionPolicy || retentionPolicy.organizationId !== organization.id) {
      throw new BadRequestException("Retention policy does not belong to the organization.");
    }

    const archivedAt = input.archivedAt ? new Date(input.archivedAt) : null;
    const sealedAt = input.sealedAt ? new Date(input.sealedAt) : null;
    const disposalEligibleAt =
      input.disposalEligibleAt
        ? new Date(input.disposalEligibleAt)
        : sealedAt
          ? this.calculateDisposalDate(retentionPolicy, sealedAt)
          : archivedAt
            ? this.calculateDisposalDate(retentionPolicy, archivedAt)
            : null;

    const archiveRecord = await this.prisma.archiveRecord.create({
      data: {
        organizationId: organization.id,
        envelopeId: envelope.id,
        versionId: input.versionId ?? null,
        retentionPolicyId: retentionPolicy.id,
        status: input.status,
        sealedAt,
        archivedAt,
        disposalEligibleAt,
        disposedAt: input.disposedAt ? new Date(input.disposedAt) : null,
        archiveManifestHash: input.archiveManifestHash,
        storageUri: input.storageUri ?? null,
        holdReason: input.holdReason ?? null,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: organization.id,
      action: "archive_record.created",
      entityType: "ArchiveRecord",
      entityId: archiveRecord.id,
      metadata: {
        envelopeId: envelope.id,
        versionId: archiveRecord.versionId,
        status: archiveRecord.status,
      },
    });

    return archiveRecord;
  }
}
