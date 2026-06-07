import { createHash, randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  ClosePermitInput,
  ContractorAccessActSummary,
  CreatePermitInput,
  CreatePpeIssueRecordInput,
  MockSignInput,
  NcalayerBridgeSignature,
  PermitEntry,
  PermitListFilter,
  PermitReasonInput,
  PermitWorkflowInput,
  PreparePermitSignInput,
  UpdatePermitInput,
} from "@dsj/types";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import {
  assertOrganizationAccess,
  requireOrganizationScope,
} from "../common/utils/tenant-scope";
import { PrismaService } from "../database/prisma.service";
import { PdfService } from "../pdf/pdf.service";
import { MockSigningProvider } from "../signatures/providers/mock-signing.provider";
import { NcalayerSigningProvider } from "../signatures/providers/ncalayer-signing.provider";
import type { SigningRequestContext } from "../signing/signing.types";
import { CorePlatformService } from "./core-platform.service";
import { canonicalPermitPayloadHash } from "./permit-hash";
import {
  assertWorkPermitActionAccess,
  assertWorkPermitTransition,
  isWorkPermitParticipant,
  resolveWorkPermitApprovalSteps,
  type WorkPermitAction,
  type WorkPermitDbStatus,
} from "./permit-workflow";

const KZ_ORDER_344_APPENDIX_1_LEGAL_BASIS = "KZ_ORDER_344_APPENDIX_1";
const KZ_ORDER_344_EFFECTIVE_DATE = "2020-08-28";

const permitInclude = {
  currentVersion: {
    include: {
      documentVersion: true,
    },
  },
  versions: {
    orderBy: { versionNo: "asc" as const },
    include: {
      documentVersion: true,
    },
  },
  brigades: {
    include: {
      members: true,
    },
  },
  approvals: {
    orderBy: { stepNo: "asc" as const },
  },
  precheckRuns: {
    orderBy: { checkedAt: "desc" as const },
    take: 10,
  },
  closure: true,
  branch: true,
  workSite: true,
  contractorAccessAct: {
    include: {
      contractorOrganization: true,
      contractorRepresentative: true,
    },
  },
  documentEnvelope: {
    include: {
      currentVersion: true,
      approvalRoute: {
        include: {
          steps: {
            orderBy: { stepNo: "asc" as const },
          },
        },
      },
      signatures: {
        orderBy: { createdAt: "asc" as const },
        include: {
          verification: true,
          certificateMetadata: true,
        },
      },
      archiveRecords: {
        orderBy: { createdAt: "desc" as const },
        include: {
          retentionPolicy: true,
        },
      },
      exportSnapshots: {
        orderBy: { generatedAt: "desc" as const },
        take: 20,
      },
    },
  },
  archiveRecord: {
    include: {
      retentionPolicy: true,
    },
  },
} satisfies Prisma.WorkPermitInclude;

type PermitWithDetails = Prisma.WorkPermitGetPayload<{
  include: typeof permitInclude;
}>;

type PermitTransaction = Prisma.TransactionClient;

const entryStatusByDbStatus: Record<string, PermitEntry["status"]> = {
  DRAFT: "draft",
  SUBMITTED: "pending_approval",
  MISSING_DOCUMENTS: "missing_documents",
  IN_APPROVAL: "pending_approval",
  APPROVED: "approved",
  SIGNING_READY: "signing_ready",
  SIGNED: "signed",
  ACTIVE: "active",
  SUSPENDED: "suspended",
  EXTENDED: "extended",
  CLOSED: "closed",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
  ANNULLED: "cancelled",
  EXPIRED: "expired",
  ARCHIVED: "archived",
};

const dbStatusByEntryStatus: Partial<
  Record<PermitEntry["status"], WorkPermitDbStatus>
> = {
  draft: "DRAFT",
  missing_documents: "MISSING_DOCUMENTS",
  pending_approval: "IN_APPROVAL",
  approved: "APPROVED",
  signing_ready: "SIGNING_READY",
  signed: "SIGNED",
  active: "ACTIVE",
  suspended: "SUSPENDED",
  extended: "EXTENDED",
  closed: "CLOSED",
  rejected: "REJECTED",
  cancelled: "CANCELLED",
  expired: "EXPIRED",
  archived: "ARCHIVED",
};

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? ({ ...value } as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string => typeof item === "string" && item.length > 0,
      )
    : [];
}

function canonicalHash(value: unknown) {
  return canonicalPermitPayloadHash(value);
}

function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

@Injectable()
export class WorkPermitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly corePlatformService: CorePlatformService,
    private readonly pdfService: PdfService,
    private readonly mockSigningProvider: MockSigningProvider,
    private readonly ncalayerSigningProvider: NcalayerSigningProvider,
  ) {}

  private async actorEmployeeId(
    user: AuthenticatedUser,
    organizationId: string,
  ) {
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

  private crewEmployeeIds(permit: PermitWithDetails) {
    return permit.brigades.flatMap((brigade) =>
      brigade.members.flatMap((member) =>
        member.employeeId ? [member.employeeId] : [],
      ),
    );
  }

  private async assertAccess(
    user: AuthenticatedUser,
    permit: PermitWithDetails,
    action?: WorkPermitAction,
  ) {
    assertOrganizationAccess(user, permit.organizationId);
    const actorEmployeeId = await this.actorEmployeeId(
      user,
      permit.organizationId,
    );

    if (
      user.role === "EMPLOYEE_SIGNER" &&
      (!actorEmployeeId ||
        !isWorkPermitParticipant(
          actorEmployeeId,
          permit,
          this.crewEmployeeIds(permit),
        ))
    ) {
      throw new ForbiddenException(
        "Work permit does not belong to the current signer.",
      );
    }

    if (action) {
      assertWorkPermitActionAccess(user, permit, action, actorEmployeeId);
    }

    return actorEmployeeId;
  }

  private async findPermit(id: string) {
    const permit = await this.prisma.workPermit.findUnique({
      where: { id },
      include: permitInclude,
    });

    if (!permit) {
      throw new NotFoundException("Work permit not found.");
    }

    return permit;
  }

  private payloadEntry(permit: PermitWithDetails) {
    const payload = objectValue(permit.currentVersion?.payloadJson);
    return objectValue(payload.permitEntry);
  }

  private payloadWithEntry(
    permit: PermitWithDetails,
    entry: Record<string, unknown>,
  ) {
    const payload = objectValue(permit.currentVersion?.payloadJson);
    return {
      ...payload,
      source: "PERMIT_JOURNAL_UI_CANONICAL",
      permitEntry: entry,
    };
  }

  private nullableIso(value: Date | string | null | undefined) {
    if (value instanceof Date) return value.toISOString();
    return typeof value === "string" && value.length > 0 ? value : null;
  }

  private contractorAccessActSummary(
    act:
      | {
          id: string;
          actNumber: string;
          status: string;
          validFrom: Date;
          validTo: Date;
          workArea: string;
          contractorOrganizationId: string;
          contractorRepresentativeId: string | null;
        }
      | null
      | undefined,
  ): ContractorAccessActSummary | null {
    if (!act) return null;
    return {
      id: act.id,
      actNumber: act.actNumber,
      status: act.status as ContractorAccessActSummary["status"],
      validFrom: act.validFrom.toISOString(),
      validTo: act.validTo.toISOString(),
      workArea: act.workArea,
      contractorOrganizationId: act.contractorOrganizationId,
      contractorRepresentativeId: act.contractorRepresentativeId,
    };
  }

  private isUniqueConstraintError(error: unknown): error is {
    code: "P2002";
    meta?: { target?: unknown };
  } {
    return (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002"
    );
  }

  private duplicatePermitConflict(error: unknown) {
    if (!this.isUniqueConstraintError(error)) {
      throw error;
    }
    const target = error.meta?.target;
    const fields = Array.isArray(target) ? target.join(",") : String(target);
    if (fields.includes("journalRegistrationNumber")) {
      throw new ConflictException(
        "Journal registration number already exists in this organization.",
      );
    }
    if (fields.includes("permitCode")) {
      throw new ConflictException(
        "Work permit number already exists in this organization.",
      );
    }
    throw new ConflictException("Work permit unique constraint violated.");
  }

  private async attachJournalRows(permits: PermitWithDetails[]) {
    if (!permits.length) return [];

    const organizationId = permits[0].organizationId;
    const issuerIds = [
      ...new Set(
        permits
          .map((permit) => permit.issuerEmployeeId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const contractorIds = [
      ...new Set(
        permits
          .map((permit) => permit.contractorOrganizationId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const [issuers, contractors] = await Promise.all([
      issuerIds.length
        ? this.prisma.employee.findMany({
            where: { companyId: organizationId, id: { in: issuerIds } },
            select: {
              id: true,
              fullName: true,
              employeeNumber: true,
              jobTitle: true,
            },
          })
        : [],
      contractorIds.length
        ? this.prisma.contractorOrganization.findMany({
            where: {
              organizationId,
              id: { in: contractorIds },
            },
            select: { id: true, name: true, bin: true },
          })
        : [],
    ]);
    const issuerById = new Map(issuers.map((issuer) => [issuer.id, issuer]));
    const contractorById = new Map(
      contractors.map((contractor) => [contractor.id, contractor]),
    );

    return permits.map((permit) => {
      const entry = this.payloadEntry(permit);
      const issuer = permit.issuerEmployeeId
        ? issuerById.get(permit.issuerEmployeeId)
        : null;
      const contractor = permit.contractorOrganizationId
        ? contractorById.get(permit.contractorOrganizationId)
        : null;
      const latestArchive =
        permit.archiveRecord ?? permit.documentEnvelope?.archiveRecords[0];
      const initialAdmissionAt =
        this.nullableIso(permit.startedAt) ??
        this.nullableIso(entry.admissionAt as string | null | undefined);
      const repeatedAdmissionAt = this.nullableIso(
        entry.repeatedAdmissionAt as string | null | undefined,
      );
      const startAt = this.nullableIso(permit.effectiveFrom);
      const endAt = this.nullableIso(permit.effectiveTo);
      const closedAt = this.nullableIso(permit.closedAt);
      const archivedAt =
        this.nullableIso(permit.archivedAt) ??
        this.nullableIso(latestArchive?.archivedAt);
      const retentionUntil =
        this.nullableIso(latestArchive?.disposalEligibleAt) ??
        this.nullableIso(
          permit.archiveRecord?.retentionPolicy?.effectiveTo ?? null,
        );

      return {
        ...permit,
        journal: {
          journalRegistrationNumber: permit.journalRegistrationNumber,
          permitNumber: permit.permitCode,
          initialAdmissionAt,
          repeatedAdmissionAt,
          issuer: issuer
            ? {
                id: issuer.id,
                displayName: issuer.fullName,
                sublabel: [issuer.employeeNumber, issuer.jobTitle]
                  .filter(Boolean)
                  .join(" / "),
              }
            : null,
          workDescription: permit.workDescription,
          workplace: permit.workplace,
          workType: permit.workType,
          status: entryStatusByDbStatus[permit.status] ?? "draft",
          startAt,
          endAt,
          validUntil:
            endAt ?? this.nullableIso(entry.validUntil as string | null),
          contractor: contractor
            ? {
                id: contractor.id,
                displayName: contractor.name,
                sublabel: contractor.bin ?? null,
              }
            : null,
          closedAt,
          archivedAt,
          retentionUntil,
          archiveStatus: latestArchive?.status ?? null,
        },
      };
    });
  }

  private async attachJournalRow(permit: PermitWithDetails) {
    const [withJournal] = await this.attachJournalRows([permit]);
    return withJournal;
  }

  private entryFromInput(
    input: CreatePermitInput,
    status: PermitEntry["status"] = "draft",
    contractorAccessAct: ContractorAccessActSummary | null = null,
  ): PermitEntry {
    const now = new Date().toISOString();
    return {
      companyId: input.organizationId ?? null,
      journalId: "PERMIT_JOURNAL_MAIN",
      permitNumber: input.permitNumber,
      journalRegistrationNumber: input.journalRegistrationNumber,
      permitType: input.permitType,
      workType: input.workType,
      status,
      workDescription: input.workDescription,
      workplace: input.workplace,
      equipmentOrObject: input.equipmentOrObject ?? null,
      workZoneId: input.workSiteId ?? null,
      departmentId: input.departmentId ?? null,
      startAt: input.startAt,
      endAt: input.endAt,
      validUntil: input.endAt,
      contractorId: input.contractorId ?? null,
      contractorRepresentativeId: input.contractorRepresentativeId ?? null,
      contractorAccessActId: input.contractorAccessActId ?? null,
      contractorAccessAct,
      issuerId: input.issuerId ?? null,
      responsibleManagerId: input.responsibleManagerId ?? null,
      workProducerId: input.workProducerId ?? null,
      admitterId: input.admitterId ?? null,
      observerId: input.observerId ?? null,
      crew: [
        ...input.crew.employeeIds.map((employeeId) => ({
          employeeId,
          contractorWorkerId: null,
          roleCode: "EXECUTOR",
        })),
        ...input.crew.contractorWorkerIds.map((contractorWorkerId) => ({
          employeeId: null,
          contractorWorkerId,
          roleCode: "EXECUTOR",
        })),
      ],
      crewMemberIds: input.crew.employeeIds,
      hazardFactors: input.hazardFactors,
      safetyMeasures: input.safetyMeasures,
      workplacePreparationMeasures: input.workplacePreparationMeasures ?? null,
      safetyMeasureExecutors: input.safetyMeasureExecutors ?? null,
      airAnalysisRequired: input.airAnalysisRequired ?? false,
      airAnalysisResult: input.airAnalysisResult ?? null,
      airAnalysisAt: input.airAnalysisAt ?? null,
      airAnalysisBy: input.airAnalysisBy ?? null,
      isolationLockoutMeasures: input.isolationLockoutMeasures ?? null,
      fencingAndSignsMeasures: input.fencingAndSignsMeasures ?? null,
      fireSafetyMeasures: input.fireSafetyMeasures ?? null,
      communicationOrAdjacentAreaApprovals:
        input.communicationOrAdjacentAreaApprovals ?? null,
      targetBriefingText: input.targetBriefingText ?? null,
      targetBriefingAt: input.targetBriefingAt ?? null,
      targetBriefingInstructorId: input.targetBriefingInstructorId ?? null,
      crewInstructionAcknowledgements: [
        ...input.crew.employeeIds.map((employeeId) => ({
          employeeId,
          contractorWorkerId: null,
          status: input.crewAcknowledgementsComplete
            ? ("acknowledged" as const)
            : ("pending" as const),
          acknowledgedAt: input.crewAcknowledgementsComplete
            ? (input.targetBriefingAt ?? now)
            : null,
        })),
        ...input.crew.contractorWorkerIds.map((contractorWorkerId) => ({
          employeeId: null,
          contractorWorkerId,
          status: input.crewAcknowledgementsComplete
            ? ("acknowledged" as const)
            : ("pending" as const),
          acknowledgedAt: input.crewAcknowledgementsComplete
            ? (input.targetBriefingAt ?? now)
            : null,
        })),
      ],
      admissionAt: input.admissionAt ?? null,
      admittedById: input.admittedById ?? null,
      acceptedByWorkProducerAt: input.acceptedByWorkProducerAt ?? null,
      ppeRequirements: input.ppeRequirements ?? null,
      ppeIssueRecordIds: input.ppeIssueRecordIds,
      legalBasis: input.legalBasis,
      legalBasisVersion: KZ_ORDER_344_APPENDIX_1_LEGAL_BASIS,
      legalBasisEffectiveDate: KZ_ORDER_344_EFFECTIVE_DATE,
      trainingEvidenceIds: input.trainingEvidenceIds,
      briefingEvidenceIds: input.briefingEvidenceIds,
      certificateEvidenceIds: input.certificateEvidenceIds,
      medicalEvidenceIds: input.medicalEvidenceIds,
      requiredDocumentIds: input.requiredDocumentIds,
      createdAt: now,
      updatedAt: now,
    };
  }

  private async validateReferences(
    organizationId: string,
    input: Pick<
      CreatePermitInput,
      | "branchId"
      | "departmentId"
      | "workSiteId"
      | "contractorId"
      | "contractorRepresentativeId"
      | "contractorAccessActId"
      | "workType"
      | "startAt"
      | "endAt"
      | "issuerId"
      | "responsibleManagerId"
      | "workProducerId"
      | "admitterId"
      | "observerId"
      | "crew"
    >,
  ) {
    const employeeIds = [
      input.issuerId,
      input.responsibleManagerId,
      input.workProducerId,
      input.admitterId,
      input.observerId,
      ...input.crew.employeeIds,
    ].filter((id): id is string => Boolean(id));
    const uniqueEmployeeIds = [...new Set(employeeIds)];
    const uniqueWorkerIds = [
      ...new Set(
        [
          input.contractorRepresentativeId,
          ...input.crew.contractorWorkerIds,
        ].filter((id): id is string => Boolean(id)),
      ),
    ];

    const [
      employees,
      workers,
      contractor,
      contractorAccessAct,
      branch,
      department,
      workSite,
    ] = await Promise.all([
      uniqueEmployeeIds.length
        ? this.prisma.employee.findMany({
            where: {
              id: { in: uniqueEmployeeIds },
              companyId: organizationId,
              isArchived: false,
            },
            select: { id: true, status: true },
          })
        : [],
      uniqueWorkerIds.length
        ? this.prisma.contractorWorker.findMany({
            where: {
              id: { in: uniqueWorkerIds },
              organizationId,
              isArchived: false,
            },
            select: {
              id: true,
              status: true,
              contractorOrganizationId: true,
            },
          })
        : [],
      input.contractorId
        ? this.prisma.contractorOrganization.findFirst({
            where: { id: input.contractorId, organizationId, isActive: true },
            select: { id: true },
          })
        : null,
      input.contractorAccessActId
        ? this.prisma.contractorAccessAct.findFirst({
            where: { id: input.contractorAccessActId, organizationId },
            select: {
              id: true,
              actNumber: true,
              status: true,
              validFrom: true,
              validTo: true,
              workArea: true,
              contractorOrganizationId: true,
              contractorRepresentativeId: true,
            },
          })
        : null,
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

    if (
      employees.length !== uniqueEmployeeIds.length ||
      employees.some((employee) => employee.status !== "active")
    ) {
      throw new BadRequestException(
        "All assigned employees must be active members of the organization.",
      );
    }

    if (
      workers.length !== uniqueWorkerIds.length ||
      workers.some((worker) => worker.status !== "active")
    ) {
      throw new BadRequestException(
        "All assigned contractor workers must be active members of the organization.",
      );
    }

    if (input.contractorId && !contractor) {
      throw new BadRequestException(
        "Contractor does not belong to the organization.",
      );
    }
    if (input.contractorAccessActId && !contractorAccessAct) {
      throw new BadRequestException(
        "Contractor access act does not belong to the organization.",
      );
    }
    if (contractorAccessAct) {
      if (contractorAccessAct.status !== "ACTIVE") {
        throw new BadRequestException(
          "Work permit can link only to an active contractor access act.",
        );
      }
      if (!input.contractorId) {
        throw new BadRequestException(
          "Contractor is required when linking a contractor access act.",
        );
      }
      if (contractorAccessAct.contractorOrganizationId !== input.contractorId) {
        throw new BadRequestException(
          "Work permit contractor does not match the contractor access act.",
        );
      }
      const effectiveFrom = new Date(input.startAt);
      const effectiveTo = new Date(input.endAt);
      if (
        Number.isNaN(effectiveFrom.getTime()) ||
        Number.isNaN(effectiveTo.getTime()) ||
        effectiveTo.getTime() <= effectiveFrom.getTime()
      ) {
        throw new BadRequestException(
          "Work permit endAt must be after startAt.",
        );
      }
      if (
        effectiveFrom.getTime() < contractorAccessAct.validFrom.getTime() ||
        effectiveTo.getTime() > contractorAccessAct.validTo.getTime()
      ) {
        throw new BadRequestException(
          "Work permit validity must be inside contractor access act validity.",
        );
      }
    }
    if (
      input.contractorId &&
      workers.some(
        (worker) => worker.contractorOrganizationId !== input.contractorId,
      )
    ) {
      throw new BadRequestException(
        "Contractor representative or crew belongs to another contractor.",
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
    return this.contractorAccessActSummary(contractorAccessAct);
  }

  private async approvalRoute(
    organizationId: string,
    scopeType: CreatePermitInput["scopeType"],
  ) {
    const now = new Date();
    return this.prisma.approvalRoute.findFirst({
      where: {
        organizationId,
        documentKind: "WORK_PERMIT",
        scopeType,
        status: "ACTIVE",
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
      include: {
        steps: {
          orderBy: { stepNo: "asc" },
        },
      },
      orderBy: [{ isDefault: "desc" }, { routeVersion: "desc" }],
    });
  }

  private async appendVersion(
    transaction: PermitTransaction,
    permit: {
      id: string;
      documentEnvelopeId: string | null;
      effectiveFrom: Date | null;
      effectiveTo: Date | null;
    },
    payload: unknown,
    userId: string,
    status: "DRAFT" | "FINAL" = "DRAFT",
  ) {
    if (!permit.documentEnvelopeId) {
      throw new BadRequestException(
        "Work permit document envelope is missing.",
      );
    }
    const latest = await transaction.workPermitVersion.findFirst({
      where: { permitId: permit.id },
      orderBy: { versionNo: "desc" },
      select: { versionNo: true },
    });
    const versionNo = (latest?.versionNo ?? 0) + 1;
    const payloadHash = canonicalHash(payload);
    const documentVersion = await transaction.documentVersion.create({
      data: {
        envelopeId: permit.documentEnvelopeId,
        versionNo,
        status,
        payloadJson: payload as Prisma.InputJsonValue,
        renderedHash: payloadHash,
        createdByUserId: userId,
        effectiveFrom: permit.effectiveFrom,
        effectiveTo: permit.effectiveTo,
      },
    });
    const version = await transaction.workPermitVersion.create({
      data: {
        permitId: permit.id,
        versionNo,
        status,
        payloadJson: payload as Prisma.InputJsonValue,
        payloadHash,
        documentEnvelopeId: permit.documentEnvelopeId,
        documentVersionId: documentVersion.id,
        createdByUserId: userId,
      },
    });
    await transaction.documentEnvelope.update({
      where: { id: permit.documentEnvelopeId },
      data: { currentVersionId: documentVersion.id },
    });
    await transaction.workPermit.update({
      where: { id: permit.id },
      data: { currentVersionId: version.id, updatedByUserId: userId },
    });
    return version;
  }

  private async expireDuePermits(organizationId: string) {
    const permits = await this.prisma.workPermit.findMany({
      where: {
        organizationId,
        status: { in: ["ACTIVE", "SUSPENDED", "EXTENDED"] },
        effectiveTo: { lt: new Date() },
      },
      select: {
        id: true,
        status: true,
        effectiveTo: true,
      },
    });

    for (const permit of permits) {
      const updated = await this.prisma.workPermit.updateMany({
        where: {
          id: permit.id,
          status: permit.status,
          effectiveTo: { lt: new Date() },
        },
        data: {
          status: "EXPIRED",
        },
      });
      if (updated.count > 0) {
        await this.auditService.log({
          companyId: organizationId,
          action: "work_permit.expired",
          entityType: "WorkPermit",
          entityId: permit.id,
          metadata: {
            previousStatus: permit.status,
            effectiveTo: permit.effectiveTo?.toISOString() ?? null,
          },
        });
      }
    }
  }

  async list(user: AuthenticatedUser, filters: PermitListFilter) {
    const organizationId = requireOrganizationScope(
      user,
      filters.organizationId ?? null,
    );
    await this.expireDuePermits(organizationId);
    const actorEmployeeId = await this.actorEmployeeId(user, organizationId);
    const status =
      filters.status && dbStatusByEntryStatus[filters.status]
        ? dbStatusByEntryStatus[filters.status]
        : undefined;
    const where: Prisma.WorkPermitWhereInput = {
      organizationId,
      ...(filters.permitType ? { permitType: filters.permitType } : {}),
      ...(filters.workType ? { workType: filters.workType } : {}),
      ...(status ? { status } : {}),
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters.contractorId
        ? { contractorOrganizationId: filters.contractorId }
        : {}),
      ...(filters.dateFrom
        ? { effectiveTo: { gte: new Date(filters.dateFrom) } }
        : {}),
      ...(filters.dateTo
        ? { effectiveFrom: { lte: new Date(filters.dateTo) } }
        : {}),
      ...(filters.missingOnly ? { status: "MISSING_DOCUMENTS" } : {}),
      ...(filters.activeOnly ? { status: "ACTIVE" } : {}),
      ...(filters.archivedOnly ? { status: "ARCHIVED" } : {}),
    };

    if (user.role === "EMPLOYEE_SIGNER") {
      if (!actorEmployeeId) {
        return {
          items: [],
          total: 0,
          page: filters.page,
          pageSize: filters.pageSize,
        };
      }
      where.OR = [
        { issuerEmployeeId: actorEmployeeId },
        { responsibleManagerEmployeeId: actorEmployeeId },
        { workProducerEmployeeId: actorEmployeeId },
        { admitterEmployeeId: actorEmployeeId },
        {
          brigades: {
            some: {
              members: {
                some: { employeeId: actorEmployeeId },
              },
            },
          },
        },
      ];
    }

    const orderBy: Prisma.WorkPermitOrderByWithRelationInput =
      filters.sortBy === "permitNumber"
        ? { permitCode: filters.sortOrder }
        : filters.sortBy === "startAt"
          ? { effectiveFrom: filters.sortOrder }
          : filters.sortBy === "endAt"
            ? { effectiveTo: filters.sortOrder }
            : { createdAt: filters.sortOrder };
    const [items, total] = await Promise.all([
      this.prisma.workPermit.findMany({
        where,
        include: permitInclude,
        orderBy,
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.prisma.workPermit.count({ where }),
    ]);

    const journalItems = await this.attachJournalRows(items);
    return {
      items: journalItems,
      total,
      page: filters.page,
      pageSize: filters.pageSize,
    };
  }

  async get(user: AuthenticatedUser, id: string) {
    let permit = await this.findPermit(id);
    assertOrganizationAccess(user, permit.organizationId);
    await this.expireDuePermits(permit.organizationId);
    permit = await this.findPermit(id);
    await this.assertAccess(user, permit);
    return this.attachJournalRow(permit);
  }

  async create(user: AuthenticatedUser, input: CreatePermitInput) {
    const organizationId = requireOrganizationScope(
      user,
      input.organizationId ?? null,
    );
    const contractorAccessAct = await this.validateReferences(
      organizationId,
      input,
    );
    const route = await this.approvalRoute(organizationId, input.scopeType);
    resolveWorkPermitApprovalSteps(route?.steps ?? []);
    const id = randomUUID();
    const envelopeId = randomUUID();
    const documentVersionId = randomUUID();
    const workPermitVersionId = randomUUID();
    const entry = this.entryFromInput(
      { ...input, organizationId },
      "draft",
      contractorAccessAct,
    );
    const payload = {
      source: "PERMIT_JOURNAL_UI_CANONICAL",
      canonicalContextFile: "docs/context/PERMIT_JOURNAL_UI_CANONICAL.md",
      permitEntry: entry,
    };
    const payloadHash = canonicalHash(payload);

    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.documentEnvelope.create({
          data: {
            id: envelopeId,
            organizationId,
            documentKind: "WORK_PERMIT",
            scopeType: input.scopeType,
            branchId: input.branchId ?? null,
            departmentId: input.departmentId ?? null,
            workSiteId: input.workSiteId ?? null,
            businessObjectType: "WorkPermit",
            businessObjectId: id,
            documentNumber: input.permitNumber,
            title: input.workDescription,
            status: "DRAFT",
            approvalRouteId: route?.id ?? null,
            createdByUserId: user.userId,
          },
        });
        await transaction.documentVersion.create({
          data: {
            id: documentVersionId,
            envelopeId,
            versionNo: 1,
            status: "DRAFT",
            payloadJson: payload as Prisma.InputJsonValue,
            renderedHash: payloadHash,
            createdByUserId: user.userId,
            effectiveFrom: new Date(input.startAt),
            effectiveTo: new Date(input.endAt),
          },
        });
        await transaction.workPermit.create({
          data: {
            id,
            organizationId,
            permitCode: input.permitNumber,
            journalRegistrationNumber: input.journalRegistrationNumber,
            permitType: input.permitType,
            workType: input.workType,
            title: input.workDescription,
            workDescription: input.workDescription,
            workplace: input.workplace,
            scopeType: input.scopeType,
            branchId: input.branchId ?? null,
            departmentId: input.departmentId ?? null,
            workSiteId: input.workSiteId ?? null,
            contractorOrganizationId: input.contractorId ?? null,
            contractorRepresentativeId:
              input.contractorRepresentativeId ?? null,
            contractorAccessActId: input.contractorAccessActId ?? null,
            issuerEmployeeId: input.issuerId ?? null,
            responsibleManagerEmployeeId: input.responsibleManagerId ?? null,
            workProducerEmployeeId: input.workProducerId ?? null,
            admitterEmployeeId: input.admitterId ?? null,
            observerEmployeeId: input.observerId ?? null,
            status: "DRAFT",
            documentEnvelopeId: envelopeId,
            currentVersionId: null,
            effectiveFrom: new Date(input.startAt),
            effectiveTo: new Date(input.endAt),
            createdByUserId: user.userId,
            updatedByUserId: user.userId,
          },
        });
        await transaction.workPermitVersion.create({
          data: {
            id: workPermitVersionId,
            permitId: id,
            versionNo: 1,
            status: "DRAFT",
            payloadJson: payload as Prisma.InputJsonValue,
            payloadHash,
            documentEnvelopeId: envelopeId,
            documentVersionId,
            createdByUserId: user.userId,
          },
        });
        await transaction.documentEnvelope.update({
          where: { id: envelopeId },
          data: { currentVersionId: documentVersionId },
        });
        await transaction.workPermit.update({
          where: { id },
          data: { currentVersionId: workPermitVersionId },
        });
        const brigade = await transaction.brigade.create({
          data: {
            permitId: id,
            brigadeCode: `${input.permitNumber}-BRG`,
            title: "Main work crew",
            leaderEmployeeId: input.workProducerId ?? null,
          },
        });
        if (
          input.crew.employeeIds.length ||
          input.crew.contractorWorkerIds.length
        ) {
          await transaction.brigadeMember.createMany({
            data: [
              ...input.crew.employeeIds.map((employeeId) => ({
                brigadeId: brigade.id,
                employeeId,
                contractorWorkerId: null,
                roleCode: "EXECUTOR",
                status: "ASSIGNED" as const,
              })),
              ...input.crew.contractorWorkerIds.map((contractorWorkerId) => ({
                brigadeId: brigade.id,
                employeeId: null,
                contractorWorkerId,
                roleCode: "EXECUTOR",
                status: "ASSIGNED" as const,
              })),
            ],
          });
        }
      });
    } catch (error) {
      this.duplicatePermitConflict(error);
    }

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: organizationId,
      action: "work_permit.created",
      entityType: "WorkPermit",
      entityId: id,
      metadata: { payloadHash, approvalRouteId: route?.id ?? null },
    });
    return this.get(user, id);
  }

  async update(user: AuthenticatedUser, id: string, input: UpdatePermitInput) {
    const permit = await this.findPermit(id);
    await this.assertAccess(user, permit, "edit");

    if (!["DRAFT", "MISSING_DOCUMENTS", "REJECTED"].includes(permit.status)) {
      throw new ConflictException(
        "Approved or signed work permit fields are immutable.",
      );
    }

    const current = this.payloadEntry(permit);
    const currentCrew = {
      employeeIds: permit.brigades.flatMap((brigade) =>
        brigade.members.flatMap((member) =>
          member.employeeId ? [member.employeeId] : [],
        ),
      ),
      contractorWorkerIds: permit.brigades.flatMap((brigade) =>
        brigade.members.flatMap((member) =>
          member.contractorWorkerId ? [member.contractorWorkerId] : [],
        ),
      ),
    };
    const supportedWorkTypes = [
      "GENERAL_HIGH_RISK",
      "HEIGHT_WORK",
      "CONTRACTOR_SITE_ACCESS",
    ] as const;
    const currentWorkType = supportedWorkTypes.find(
      (workType) => workType === permit.workType,
    );
    if (!currentWorkType) {
      throw new ConflictException(
        "This work permit type requires a dedicated non-MVP form.",
      );
    }
    const merged = {
      organizationId: permit.organizationId,
      permitNumber: input.permitNumber ?? permit.permitCode,
      journalRegistrationNumber:
        input.journalRegistrationNumber ?? permit.journalRegistrationNumber,
      permitType: input.permitType ?? permit.permitType,
      workType: input.workType ?? currentWorkType,
      workDescription: input.workDescription ?? permit.workDescription,
      workplace: input.workplace ?? permit.workplace,
      equipmentOrObject:
        input.equipmentOrObject === undefined
          ? (current.equipmentOrObject as string | null | undefined)
          : input.equipmentOrObject,
      scopeType: input.scopeType ?? permit.scopeType,
      branchId: input.branchId === undefined ? permit.branchId : input.branchId,
      departmentId:
        input.departmentId === undefined
          ? permit.departmentId
          : input.departmentId,
      workSiteId:
        input.workSiteId === undefined ? permit.workSiteId : input.workSiteId,
      startAt:
        input.startAt ??
        permit.effectiveFrom?.toISOString() ??
        new Date().toISOString(),
      endAt:
        input.endAt ??
        permit.effectiveTo?.toISOString() ??
        new Date().toISOString(),
      contractorId:
        input.contractorId === undefined
          ? permit.contractorOrganizationId
          : input.contractorId,
      contractorRepresentativeId:
        input.contractorRepresentativeId === undefined
          ? permit.contractorRepresentativeId
          : input.contractorRepresentativeId,
      contractorAccessActId:
        input.contractorAccessActId === undefined
          ? permit.contractorAccessActId
          : input.contractorAccessActId,
      issuerId:
        input.issuerId === undefined ? permit.issuerEmployeeId : input.issuerId,
      responsibleManagerId:
        input.responsibleManagerId === undefined
          ? permit.responsibleManagerEmployeeId
          : input.responsibleManagerId,
      workProducerId:
        input.workProducerId === undefined
          ? permit.workProducerEmployeeId
          : input.workProducerId,
      admitterId:
        input.admitterId === undefined
          ? permit.admitterEmployeeId
          : input.admitterId,
      observerId:
        input.observerId === undefined
          ? permit.observerEmployeeId
          : input.observerId,
      crew: input.crew ?? currentCrew,
      hazardFactors: input.hazardFactors ?? stringArray(current.hazardFactors),
      safetyMeasures:
        input.safetyMeasures ?? String(current.safetyMeasures ?? ""),
      workplacePreparationMeasures:
        input.workplacePreparationMeasures === undefined
          ? (current.workplacePreparationMeasures as string | null | undefined)
          : input.workplacePreparationMeasures,
      safetyMeasureExecutors:
        input.safetyMeasureExecutors === undefined
          ? (current.safetyMeasureExecutors as string | null | undefined)
          : input.safetyMeasureExecutors,
      airAnalysisRequired:
        input.airAnalysisRequired === undefined
          ? Boolean(current.airAnalysisRequired)
          : input.airAnalysisRequired,
      airAnalysisResult:
        input.airAnalysisResult === undefined
          ? (current.airAnalysisResult as string | null | undefined)
          : input.airAnalysisResult,
      airAnalysisAt:
        input.airAnalysisAt === undefined
          ? (current.airAnalysisAt as string | null | undefined)
          : input.airAnalysisAt,
      airAnalysisBy:
        input.airAnalysisBy === undefined
          ? (current.airAnalysisBy as string | null | undefined)
          : input.airAnalysisBy,
      isolationLockoutMeasures:
        input.isolationLockoutMeasures === undefined
          ? (current.isolationLockoutMeasures as string | null | undefined)
          : input.isolationLockoutMeasures,
      fencingAndSignsMeasures:
        input.fencingAndSignsMeasures === undefined
          ? (current.fencingAndSignsMeasures as string | null | undefined)
          : input.fencingAndSignsMeasures,
      fireSafetyMeasures:
        input.fireSafetyMeasures === undefined
          ? (current.fireSafetyMeasures as string | null | undefined)
          : input.fireSafetyMeasures,
      communicationOrAdjacentAreaApprovals:
        input.communicationOrAdjacentAreaApprovals === undefined
          ? (current.communicationOrAdjacentAreaApprovals as
              | string
              | null
              | undefined)
          : input.communicationOrAdjacentAreaApprovals,
      targetBriefingText:
        input.targetBriefingText === undefined
          ? (current.targetBriefingText as string | null | undefined)
          : input.targetBriefingText,
      targetBriefingAt:
        input.targetBriefingAt === undefined
          ? (current.targetBriefingAt as string | null | undefined)
          : input.targetBriefingAt,
      targetBriefingInstructorId:
        input.targetBriefingInstructorId === undefined
          ? (current.targetBriefingInstructorId as string | null | undefined)
          : input.targetBriefingInstructorId,
      crewAcknowledgementsComplete:
        input.crewAcknowledgementsComplete === undefined
          ? Array.isArray(current.crewInstructionAcknowledgements) &&
            current.crewInstructionAcknowledgements.length > 0 &&
            current.crewInstructionAcknowledgements.every(
              (acknowledgement) =>
                objectValue(acknowledgement).status === "acknowledged",
            )
          : input.crewAcknowledgementsComplete,
      admissionAt:
        input.admissionAt === undefined
          ? (current.admissionAt as string | null | undefined)
          : input.admissionAt,
      admittedById:
        input.admittedById === undefined
          ? (current.admittedById as string | null | undefined)
          : input.admittedById,
      acceptedByWorkProducerAt:
        input.acceptedByWorkProducerAt === undefined
          ? (current.acceptedByWorkProducerAt as string | null | undefined)
          : input.acceptedByWorkProducerAt,
      ppeRequirements:
        input.ppeRequirements === undefined
          ? (current.ppeRequirements as string | null | undefined)
          : input.ppeRequirements,
      ppeIssueRecordIds:
        input.ppeIssueRecordIds ?? stringArray(current.ppeIssueRecordIds),
      legalBasis: input.legalBasis ?? stringArray(current.legalBasis),
      trainingEvidenceIds:
        input.trainingEvidenceIds ?? stringArray(current.trainingEvidenceIds),
      briefingEvidenceIds:
        input.briefingEvidenceIds ?? stringArray(current.briefingEvidenceIds),
      certificateEvidenceIds:
        input.certificateEvidenceIds ??
        stringArray(current.certificateEvidenceIds),
      medicalEvidenceIds:
        input.medicalEvidenceIds ?? stringArray(current.medicalEvidenceIds),
      requiredDocumentIds:
        input.requiredDocumentIds ?? stringArray(current.requiredDocumentIds),
    } satisfies CreatePermitInput;
    const contractorAccessAct = await this.validateReferences(
      permit.organizationId,
      merged,
    );
    const entry = {
      ...this.entryFromInput(merged, "draft", contractorAccessAct),
      createdAt: String(current.createdAt ?? permit.createdAt.toISOString()),
    };
    const payload = this.payloadWithEntry(permit, entry);

    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.workPermit.update({
          where: { id },
          data: {
            permitCode: merged.permitNumber,
            journalRegistrationNumber: merged.journalRegistrationNumber,
            permitType: merged.permitType,
            workType: merged.workType,
            title: merged.workDescription,
            workDescription: merged.workDescription,
            workplace: merged.workplace,
            scopeType: merged.scopeType,
            branchId: merged.branchId ?? null,
            departmentId: merged.departmentId ?? null,
            workSiteId: merged.workSiteId ?? null,
            contractorOrganizationId: merged.contractorId ?? null,
            contractorRepresentativeId:
              merged.contractorRepresentativeId ?? null,
            contractorAccessActId: merged.contractorAccessActId ?? null,
            issuerEmployeeId: merged.issuerId ?? null,
            responsibleManagerEmployeeId: merged.responsibleManagerId ?? null,
            workProducerEmployeeId: merged.workProducerId ?? null,
            admitterEmployeeId: merged.admitterId ?? null,
            observerEmployeeId: merged.observerId ?? null,
            status: "DRAFT",
            effectiveFrom: new Date(merged.startAt),
            effectiveTo: new Date(merged.endAt),
            rejectionReason: null,
            suspensionReason: null,
            cancellationReason: null,
            updatedByUserId: user.userId,
          },
        });
        await transaction.workPermitApproval.deleteMany({
          where: { permitId: id },
        });
        const brigade =
          permit.brigades[0] ??
          (await transaction.brigade.create({
            data: {
              permitId: id,
              brigadeCode: `${merged.permitNumber}-BRG`,
              title: "Main work crew",
              leaderEmployeeId: merged.workProducerId ?? null,
            },
          }));
        await transaction.brigade.update({
          where: { id: brigade.id },
          data: {
            brigadeCode: `${merged.permitNumber}-BRG`,
            leaderEmployeeId: merged.workProducerId ?? null,
          },
        });
        await transaction.brigadeMember.deleteMany({
          where: { brigadeId: brigade.id },
        });
        if (
          merged.crew.employeeIds.length ||
          merged.crew.contractorWorkerIds.length
        ) {
          await transaction.brigadeMember.createMany({
            data: [
              ...merged.crew.employeeIds.map((employeeId) => ({
                brigadeId: brigade.id,
                employeeId,
                contractorWorkerId: null,
                roleCode: "EXECUTOR",
                status: "ASSIGNED" as const,
              })),
              ...merged.crew.contractorWorkerIds.map((contractorWorkerId) => ({
                brigadeId: brigade.id,
                employeeId: null,
                contractorWorkerId,
                roleCode: "EXECUTOR",
                status: "ASSIGNED" as const,
              })),
            ],
          });
        }
        await this.appendVersion(
          transaction,
          {
            ...permit,
            effectiveFrom: new Date(merged.startAt),
            effectiveTo: new Date(merged.endAt),
          },
          payload,
          user.userId,
        );
      });
    } catch (error) {
      this.duplicatePermitConflict(error);
    }

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: permit.organizationId,
      action: "work_permit.updated",
      entityType: "WorkPermit",
      entityId: id,
      metadata: { payloadHash: canonicalHash(payload) },
    });
    return this.get(user, id);
  }

  private snapshotEvidence(
    sourceType: string,
    record: Record<string, unknown>,
    overrides: Record<string, unknown> = {},
  ) {
    const safeEvidence = {
      id: String(record.id),
      sourceType,
      sourceStatus: String(record.status ?? "ACTIVE"),
      issuedAt:
        record.issueDate instanceof Date
          ? record.issueDate.toISOString()
          : record.issuedAt instanceof Date
            ? record.issuedAt.toISOString()
            : null,
      validUntil:
        record.expiryDate instanceof Date
          ? record.expiryDate.toISOString()
          : record.validUntil instanceof Date
            ? record.validUntil.toISOString()
            : null,
      verifiedAt:
        record.verifiedAt instanceof Date
          ? record.verifiedAt.toISOString()
          : null,
      subjectId:
        String(
          record.employeeId ??
            record.contractorWorkerId ??
            record.subjectId ??
            "",
        ) || null,
      documentNumber:
        String(
          record.documentNumber ??
            record.certificateNumber ??
            record.itemCode ??
            "",
        ) || null,
      ...overrides,
    };
    return {
      ...safeEvidence,
      sourceHash: canonicalHash(safeEvidence),
    };
  }

  private validUntil(
    record: { expiryDate?: Date | null; validUntil?: Date | null },
    at: Date,
  ) {
    const expires = record.expiryDate ?? record.validUntil ?? null;
    return !expires || expires.getTime() >= at.getTime();
  }

  private precheckPayloadHash(entry: Record<string, unknown>) {
    const businessEntry = { ...entry };
    for (const key of [
      "status",
      "precheckSummary",
      "precheckChecks",
      "trainingCheckSnapshot",
      "briefingCheckSnapshot",
      "certificateCheckSnapshot",
      "medicalCheckSnapshot",
      "ppeIssuedSnapshot",
      "requiredDocumentSnapshot",
      "contractorAccessActSnapshot",
      "approvalStatus",
      "signatureStatus",
      "approvalRequestedAt",
      "approvalComment",
      "submitAt",
      "submitComment",
      "confirmAt",
      "confirmComment",
      "approveAt",
      "approveComment",
      "preparesignAt",
      "preparesignComment",
      "activateAt",
      "activateComment",
      "documentVersionHash",
      "signedPayloadHash",
      "updatedAt",
    ]) {
      delete businessEntry[key];
    }
    return canonicalHash(businessEntry);
  }

  private assertCurrentPrecheck(permit: PermitWithDetails) {
    const latestRun = permit.precheckRuns[0];
    const entry = this.payloadEntry(permit);
    const summary = objectValue(entry.precheckSummary);
    const currentPayloadHash = this.precheckPayloadHash(entry);
    if (
      !latestRun ||
      latestRun.result !== "PASS" ||
      summary.result !== "PASS" ||
      summary.payloadHash !== currentPayloadHash
    ) {
      throw new BadRequestException(
        "A successful precheck for the current permit payload is required.",
      );
    }
  }

  async precheck(user: AuthenticatedUser, id: string) {
    const permit = await this.findPermit(id);
    await this.assertAccess(user, permit, "precheck");
    if (!["DRAFT", "MISSING_DOCUMENTS"].includes(permit.status)) {
      throw new ConflictException(
        "Precheck is only available for editable permits.",
      );
    }
    const entry = this.payloadEntry(permit);
    const checkedAt = new Date();
    const validAt = permit.effectiveTo ?? permit.effectiveFrom ?? checkedAt;
    const crewEmployeeIds = this.crewEmployeeIds(permit);
    const crewWorkerIds = permit.brigades.flatMap((brigade) =>
      brigade.members.flatMap((member) =>
        member.contractorWorkerId ? [member.contractorWorkerId] : [],
      ),
    );
    const participantEmployeeIds = [
      ...new Set(
        [
          ...crewEmployeeIds,
          permit.issuerEmployeeId,
          permit.responsibleManagerEmployeeId,
          permit.workProducerEmployeeId,
          permit.admitterEmployeeId,
          permit.observerEmployeeId,
        ].filter((value): value is string => Boolean(value)),
      ),
    ];
    const participantWorkerIds = [
      ...new Set(
        [permit.contractorRepresentativeId, ...crewWorkerIds].filter(
          (value): value is string => Boolean(value),
        ),
      ),
    ];
    const trainingIds = stringArray(entry.trainingEvidenceIds);
    const briefingIds = stringArray(entry.briefingEvidenceIds);
    const certificateIds = stringArray(entry.certificateEvidenceIds);
    const medicalIds = stringArray(entry.medicalEvidenceIds);
    const requiredIds = stringArray(entry.requiredDocumentIds);
    const ppeIds = stringArray(entry.ppeIssueRecordIds);

    const [
      employees,
      workers,
      trainings,
      briefings,
      employeeDocuments,
      safetyCertificates,
      qualifications,
      requiredEnvelopes,
      ppeIssues,
      workSite,
      contractor,
      contractorAccessAct,
    ] = await Promise.all([
      this.prisma.employee.findMany({
        where: {
          id: { in: participantEmployeeIds },
          companyId: permit.organizationId,
        },
      }),
      this.prisma.contractorWorker.findMany({
        where: {
          id: { in: participantWorkerIds },
          organizationId: permit.organizationId,
        },
      }),
      trainingIds.length
        ? this.prisma.trainingAssignment.findMany({
            where: {
              id: { in: trainingIds },
              companyId: permit.organizationId,
              employeeId: { in: crewEmployeeIds },
            },
            include: {
              trainingProgram: true,
              examAttempts: {
                where: { passed: true },
                orderBy: { submittedAt: "desc" },
                take: 1,
              },
            },
          })
        : [],
      briefingIds.length
        ? this.prisma.briefingJournalEntry.findMany({
            where: {
              id: { in: briefingIds },
              organizationId: permit.organizationId,
              employeeId: { in: crewEmployeeIds },
            },
          })
        : [],
      [...certificateIds, ...medicalIds, ...requiredIds].length
        ? this.prisma.employeeDocument.findMany({
            where: {
              id: { in: [...certificateIds, ...medicalIds, ...requiredIds] },
              companyId: permit.organizationId,
              employeeId: { in: crewEmployeeIds },
            },
          })
        : [],
      certificateIds.length
        ? this.prisma.safetyCertificate.findMany({
            where: {
              id: { in: certificateIds },
              companyId: permit.organizationId,
              employeeId: { in: crewEmployeeIds },
            },
          })
        : [],
      [...certificateIds, ...medicalIds, ...requiredIds].length
        ? this.prisma.qualificationDocument.findMany({
            where: {
              id: { in: [...certificateIds, ...medicalIds, ...requiredIds] },
              organizationId: permit.organizationId,
              OR: [
                { employeeId: { in: crewEmployeeIds } },
                { contractorWorkerId: { in: crewWorkerIds } },
              ],
            },
          })
        : [],
      requiredIds.length
        ? this.prisma.documentEnvelope.findMany({
            where: {
              id: { in: requiredIds },
              organizationId: permit.organizationId,
            },
          })
        : [],
      ppeIds.length
        ? this.prisma.ppeIssueRecord.findMany({
            where: {
              id: { in: ppeIds },
              organizationId: permit.organizationId,
            },
          })
        : [],
      permit.workSiteId
        ? this.prisma.workSite.findFirst({
            where: {
              id: permit.workSiteId,
              organizationId: permit.organizationId,
              isActive: true,
            },
          })
        : null,
      permit.contractorOrganizationId
        ? this.prisma.contractorOrganization.findFirst({
            where: {
              id: permit.contractorOrganizationId,
              organizationId: permit.organizationId,
              isActive: true,
            },
          })
        : null,
      permit.contractorAccessActId
        ? this.prisma.contractorAccessAct.findFirst({
            where: {
              id: permit.contractorAccessActId,
              organizationId: permit.organizationId,
            },
            select: {
              id: true,
              actNumber: true,
              status: true,
              validFrom: true,
              validTo: true,
              workArea: true,
              contractorOrganizationId: true,
              contractorRepresentativeId: true,
            },
          })
        : null,
    ]);

    const contractorWorkersInScope =
      participantWorkerIds.length === 0 ||
      Boolean(
        permit.contractorOrganizationId &&
        contractor &&
        workers.length === participantWorkerIds.length &&
        workers.every(
          (worker) =>
            worker.contractorOrganizationId === permit.contractorOrganizationId,
        ),
      );
    const trainingEvidence = trainings
      .filter(
        (record) =>
          record.status === "COMPLETED" &&
          (!record.trainingProgram.requiresExam ||
            record.examAttempts.length > 0),
      )
      .map((record) => this.snapshotEvidence("TRAINING_ASSIGNMENT", record));
    const briefingEvidence = briefings
      .filter((record) => record.status === "SIGNED")
      .map((record) => this.snapshotEvidence("BRIEFING_JOURNAL_ENTRY", record));
    const certificateEvidence = [
      ...employeeDocuments
        .filter(
          (record) =>
            certificateIds.includes(record.id) &&
            record.status === "ACTIVE" &&
            record.verificationStatus === "VERIFIED" &&
            this.validUntil(record, validAt),
        )
        .map((record) => this.snapshotEvidence("EMPLOYEE_DOCUMENT", record)),
      ...safetyCertificates
        .filter(
          (record) =>
            record.status === "ACTIVE" && this.validUntil(record, validAt),
        )
        .map((record) => this.snapshotEvidence("SAFETY_CERTIFICATE", record)),
      ...qualifications
        .filter(
          (record) =>
            certificateIds.includes(record.id) &&
            record.documentKind !== "MEDICAL_CLEARANCE" &&
            record.status === "ACTIVE" &&
            this.validUntil(record, validAt),
        )
        .map((record) =>
          this.snapshotEvidence("QUALIFICATION_DOCUMENT", record),
        ),
    ];
    const medicalEvidence = [
      ...qualifications
        .filter(
          (record) =>
            medicalIds.includes(record.id) &&
            record.documentKind === "MEDICAL_CLEARANCE" &&
            record.status === "ACTIVE" &&
            this.validUntil(record, validAt),
        )
        .map((record) => this.snapshotEvidence("MEDICAL_CLEARANCE", record)),
    ];
    const requiredEvidence = [
      ...employeeDocuments
        .filter(
          (record) =>
            requiredIds.includes(record.id) &&
            record.status === "ACTIVE" &&
            record.verificationStatus === "VERIFIED" &&
            this.validUntil(record, validAt),
        )
        .map((record) => this.snapshotEvidence("EMPLOYEE_DOCUMENT", record)),
      ...qualifications
        .filter(
          (record) =>
            requiredIds.includes(record.id) &&
            record.status === "ACTIVE" &&
            this.validUntil(record, validAt),
        )
        .map((record) =>
          this.snapshotEvidence("QUALIFICATION_DOCUMENT", record),
        ),
      ...requiredEnvelopes
        .filter((record) => ["SIGNED", "ACTIVE"].includes(record.status))
        .map((record) => this.snapshotEvidence("DOCUMENT_ENVELOPE", record)),
    ];
    const ppeEvidence = ppeIssues
      .filter(
        (record) =>
          record.status === "ACTIVE" &&
          this.validUntil(record, validAt) &&
          ((record.employeeId && crewEmployeeIds.includes(record.employeeId)) ||
            (record.contractorWorkerId &&
              crewWorkerIds.includes(record.contractorWorkerId))),
      )
      .map((record) => this.snapshotEvidence("PPE_ISSUE", record));
    const contractorAccessActCoversPermit = Boolean(
      contractorAccessAct &&
      contractorAccessAct.status === "ACTIVE" &&
      permit.contractorOrganizationId &&
      contractorAccessAct.contractorOrganizationId ===
        permit.contractorOrganizationId &&
      permit.effectiveFrom &&
      permit.effectiveTo &&
      permit.effectiveFrom.getTime() >=
        contractorAccessAct.validFrom.getTime() &&
      permit.effectiveTo.getTime() <= contractorAccessAct.validTo.getTime(),
    );
    const checkedAtIso = checkedAt.toISOString();
    type CheckInput = {
      code: string;
      label: string;
      passed: boolean;
      severity: "BLOCKER" | "WARNING";
      message: string;
      subjectType:
        | "EMPLOYEE"
        | "CONTRACTOR_WORKER"
        | "CONTRACTOR_ACCESS_ACT"
        | "WORKPLACE"
        | "DOCUMENT"
        | "PPE";
      subjectId?: string | null;
      evidenceIds?: string[];
      expiresAt?: string | null;
      sourceType?: string | null;
      sourceStatus?: string | null;
    };
    const check = (input: CheckInput) => ({
      code: input.code,
      label: input.label,
      result: input.passed ? ("PASS" as const) : ("FAIL" as const),
      severity: input.severity,
      message: input.message,
      subjectType: input.subjectType,
      subjectId: input.subjectId ?? null,
      evidenceIds: input.evidenceIds ?? [],
      checkedAt: checkedAtIso,
      expiresAt: input.expiresAt ?? null,
      sourceType: input.sourceType ?? null,
      sourceStatus: input.sourceStatus ?? null,
    });
    const evidenceExpiry = (
      evidence: ReturnType<WorkPermitsService["snapshotEvidence"]>[],
    ) =>
      evidence
        .map((item) => item.validUntil)
        .filter((value): value is string => Boolean(value))
        .sort()[0] ?? null;
    const evidenceCheck = (
      code: string,
      label: string,
      requestedIds: string[],
      evidence: ReturnType<WorkPermitsService["snapshotEvidence"]>[],
      subjectType: CheckInput["subjectType"],
      required: boolean,
    ) => {
      const evidenceIds = [...new Set(evidence.map((item) => item.id))];
      const passed =
        requestedIds.length > 0 &&
        requestedIds.every((evidenceId) => evidenceIds.includes(evidenceId));
      const severity =
        requestedIds.length > 0 || required
          ? ("BLOCKER" as const)
          : ("WARNING" as const);
      return check({
        code,
        label,
        passed,
        severity,
        subjectType,
        evidenceIds,
        expiresAt: evidenceExpiry(evidence),
        sourceType:
          evidence.length === 1 ? (evidence[0].sourceType ?? null) : null,
        sourceStatus:
          evidence.length === 1 ? (evidence[0].sourceStatus ?? null) : null,
        message: passed
          ? `${label}: database records are valid for the permit period.`
          : requestedIds.length
            ? `${label}: an explicit evidence ID is missing, expired, inactive, tenant-invalid, or belongs to another subject.`
            : required
              ? `${label}: evidence is required by the permit payload but was not provided.`
              : `${label}: no evidence was provided and the current model has no work/position requirement matrix.`,
      });
    };
    const employeePeopleValid =
      employees.length === participantEmployeeIds.length &&
      employees.every(
        (employee) => employee.status === "active" && !employee.isArchived,
      );
    const workerPeopleValid =
      workers.length === participantWorkerIds.length &&
      workers.every(
        (worker) => worker.status === "active" && !worker.isArchived,
      );
    const actRequired = permit.workType === "CONTRACTOR_SITE_ACCESS";
    const actPresent = Boolean(contractorAccessAct);
    const actActiveAndCompatible = Boolean(
      contractorAccessAct &&
      contractorAccessAct.status === "ACTIVE" &&
      (!permit.contractorRepresentativeId ||
        !contractorAccessAct.contractorRepresentativeId ||
        contractorAccessAct.contractorRepresentativeId ===
          permit.contractorRepresentativeId),
    );
    const acknowledgements = Array.isArray(
      entry.crewInstructionAcknowledgements,
    )
      ? entry.crewInstructionAcknowledgements.map(objectValue)
      : [];
    const targetBriefingValid =
      crewEmployeeIds.length + crewWorkerIds.length > 0 &&
      Boolean(entry.targetBriefingText) &&
      Boolean(entry.targetBriefingAt) &&
      Boolean(entry.targetBriefingInstructorId) &&
      acknowledgements.length ===
        crewEmployeeIds.length + crewWorkerIds.length &&
      acknowledgements.every(
        (acknowledgement) =>
          acknowledgement.status === "acknowledged" &&
          Boolean(acknowledgement.acknowledgedAt),
      );
    const checks = [
      check({
        code: "INTERNAL_EMPLOYEE_ACTIVE",
        label: "Internal employees are active",
        passed: employeePeopleValid,
        severity: "BLOCKER",
        subjectType: "EMPLOYEE",
        evidenceIds: employees.map((employee) => employee.id),
        sourceType: "EMPLOYEE",
        sourceStatus: employeePeopleValid ? "active" : "invalid",
        message: employeePeopleValid
          ? "All assigned internal employees exist in the organization and are active."
          : "An assigned employee is missing, inactive, archived, or outside the organization.",
      }),
      check({
        code: "CONTRACTOR_WORKER_ACTIVE",
        label: "Contractor workers are active",
        passed: workerPeopleValid,
        severity: "BLOCKER",
        subjectType: "CONTRACTOR_WORKER",
        evidenceIds: workers.map((worker) => worker.id),
        sourceType: "CONTRACTOR_WORKER",
        sourceStatus: workerPeopleValid ? "active" : "invalid",
        message: workerPeopleValid
          ? "All assigned contractor workers exist in the organization and are active."
          : "An assigned contractor worker is missing, inactive, archived, or outside the organization.",
      }),
      check({
        code: "CONTRACTOR_WORKER_MATCHES_CONTRACTOR",
        label: "Contractor workers match the selected contractor",
        passed: contractorWorkersInScope,
        severity: "BLOCKER",
        subjectType: "CONTRACTOR_WORKER",
        evidenceIds: participantWorkerIds,
        sourceType: "CONTRACTOR_WORKER",
        sourceStatus: contractorWorkersInScope ? "MATCHED" : "MISMATCH",
        message: contractorWorkersInScope
          ? "Contractor worker ownership matches the selected contractor."
          : "A contractor worker or representative belongs to another contractor.",
      }),
      check({
        code: "CONTRACTOR_ACCESS_ACT_PRESENT",
        label: "Contractor access act is linked",
        passed: actRequired
          ? actPresent
          : !permit.contractorOrganizationId || actPresent,
        severity: actRequired ? "BLOCKER" : "WARNING",
        subjectType: "CONTRACTOR_ACCESS_ACT",
        subjectId: contractorAccessAct?.id ?? null,
        evidenceIds: contractorAccessAct ? [contractorAccessAct.id] : [],
        sourceType: "CONTRACTOR_ACCESS_ACT",
        sourceStatus: contractorAccessAct?.status ?? null,
        message: actPresent
          ? "A tenant-scoped ContractorAccessAct record is linked."
          : actRequired
            ? "CONTRACTOR_SITE_ACCESS requires a linked ContractorAccessAct."
            : permit.contractorOrganizationId
              ? "No ContractorAccessAct is linked; the current product decision does not make it mandatory for GENERAL_HIGH_RISK."
              : "Contractor access act is not applicable.",
      }),
      check({
        code: "CONTRACTOR_ACCESS_ACT_ACTIVE",
        label: "Contractor access act is active and compatible",
        passed: actPresent ? actActiveAndCompatible : !actRequired,
        severity: actRequired || actPresent ? "BLOCKER" : "WARNING",
        subjectType: "CONTRACTOR_ACCESS_ACT",
        subjectId: contractorAccessAct?.id ?? null,
        evidenceIds: contractorAccessAct ? [contractorAccessAct.id] : [],
        sourceType: "CONTRACTOR_ACCESS_ACT",
        sourceStatus: contractorAccessAct?.status ?? null,
        message: !actPresent
          ? "No act record was available for status validation."
          : actActiveAndCompatible
            ? "The act is ACTIVE and its representative is compatible with the permit."
            : "The act is inactive or its contractor representative conflicts with the permit.",
      }),
      check({
        code: "CONTRACTOR_ACCESS_ACT_DATE_COVERAGE",
        label: "Contractor access act covers permit dates",
        passed: actPresent ? contractorAccessActCoversPermit : !actRequired,
        severity: actRequired || actPresent ? "BLOCKER" : "WARNING",
        subjectType: "CONTRACTOR_ACCESS_ACT",
        subjectId: contractorAccessAct?.id ?? null,
        evidenceIds: contractorAccessAct ? [contractorAccessAct.id] : [],
        expiresAt: contractorAccessAct?.validTo.toISOString() ?? null,
        sourceType: "CONTRACTOR_ACCESS_ACT",
        sourceStatus: contractorAccessAct?.status ?? null,
        message: !actPresent
          ? "No act record was available for date validation."
          : contractorAccessActCoversPermit
            ? "The permit validity is fully inside the act validity period."
            : "The act belongs to another contractor or does not cover the full permit period.",
      }),
      evidenceCheck(
        "TRAINING_EVIDENCE_VALID",
        "Training and knowledge-check evidence",
        trainingIds,
        trainingEvidence,
        "DOCUMENT",
        false,
      ),
      evidenceCheck(
        "BRIEFING_EVIDENCE_VALID",
        "Briefing evidence",
        briefingIds,
        briefingEvidence,
        "DOCUMENT",
        false,
      ),
      check({
        code: "TARGET_BRIEFING_PRESENT",
        label: "Target briefing and crew acknowledgement",
        passed: targetBriefingValid,
        severity: "BLOCKER",
        subjectType: "EMPLOYEE",
        subjectId:
          typeof entry.targetBriefingInstructorId === "string"
            ? entry.targetBriefingInstructorId
            : null,
        evidenceIds: [...crewEmployeeIds, ...crewWorkerIds],
        sourceType: "PERMIT_PAYLOAD",
        sourceStatus: targetBriefingValid ? "ACKNOWLEDGED" : "INCOMPLETE",
        message: targetBriefingValid
          ? "Target briefing details and payload-level crew acknowledgements are complete."
          : "A non-empty crew, target briefing text/date/instructor, and acknowledgement by every crew member are required.",
      }),
      evidenceCheck(
        "QUALIFICATION_OR_CERTIFICATE_VALID",
        "Qualification or certificate evidence",
        certificateIds,
        certificateEvidence,
        "DOCUMENT",
        false,
      ),
      evidenceCheck(
        "MEDICAL_CLEARANCE_VALID",
        "Medical clearance evidence",
        medicalIds,
        medicalEvidence,
        "DOCUMENT",
        false,
      ),
      check({
        code: "MEDICAL_SNAPSHOT_DIAGNOSIS_FREE",
        label: "Medical snapshot contains no diagnosis data",
        passed: true,
        severity: "BLOCKER",
        subjectType: "DOCUMENT",
        evidenceIds: medicalEvidence.map((item) => item.id),
        expiresAt: evidenceExpiry(medicalEvidence),
        sourceType: "MEDICAL_CLEARANCE",
        sourceStatus: "STATUS_ONLY",
        message:
          "Only clearance status, dates, subject, document reference, and verification metadata are snapshotted.",
      }),
      evidenceCheck(
        "PPE_ISSUED_VALID",
        "Issued PPE evidence",
        ppeIds,
        ppeEvidence,
        "PPE",
        Boolean(entry.ppeRequirements),
      ),
      evidenceCheck(
        "REQUIRED_DOCUMENTS_PRESENT",
        "Required documents",
        requiredIds,
        requiredEvidence,
        "DOCUMENT",
        false,
      ),
      check({
        code: "WORKPLACE_PREPARATION_MEASURES_PRESENT",
        label: "Workplace preparation measures",
        passed:
          permit.workType !== "GENERAL_HIGH_RISK" ||
          (Boolean(String(entry.workplacePreparationMeasures ?? "").trim()) &&
            (!permit.workSiteId || Boolean(workSite))),
        severity: "BLOCKER",
        subjectType: "WORKPLACE",
        subjectId: permit.workSiteId,
        evidenceIds: permit.workSiteId ? [permit.workSiteId] : [],
        sourceType: permit.workSiteId ? "WORK_SITE" : "PERMIT_PAYLOAD",
        sourceStatus:
          permit.workSiteId && !workSite ? "INACTIVE_OR_MISSING" : "PRESENT",
        message:
          permit.workType !== "GENERAL_HIGH_RISK" ||
          (Boolean(String(entry.workplacePreparationMeasures ?? "").trim()) &&
            (!permit.workSiteId || Boolean(workSite)))
            ? "Workplace preparation measures are present and the referenced work site is active."
            : "GENERAL_HIGH_RISK requires workplace preparation measures and an active referenced work site.",
      }),
      check({
        code: "SAFETY_MEASURES_PRESENT",
        label: "Safety measures",
        passed: Boolean(String(entry.safetyMeasures ?? "").trim()),
        severity: "BLOCKER",
        subjectType: "WORKPLACE",
        subjectId: permit.workSiteId,
        sourceType: "PERMIT_PAYLOAD",
        sourceStatus: Boolean(String(entry.safetyMeasures ?? "").trim())
          ? "PRESENT"
          : "MISSING",
        message: Boolean(String(entry.safetyMeasures ?? "").trim())
          ? "Safety measures are present."
          : "Safety measures are mandatory.",
      }),
      check({
        code: "LEGAL_BASIS_PRESENT",
        label: "Legal basis",
        passed:
          stringArray(entry.legalBasis).length > 0 &&
          Boolean(entry.legalBasisVersion) &&
          Boolean(entry.legalBasisEffectiveDate),
        severity: "BLOCKER",
        subjectType: "DOCUMENT",
        sourceType: "PERMIT_PAYLOAD",
        sourceStatus: "SYSTEM_SET",
        message:
          stringArray(entry.legalBasis).length > 0 &&
          Boolean(entry.legalBasisVersion) &&
          Boolean(entry.legalBasisEffectiveDate)
            ? "Legal basis and system-controlled version metadata are present."
            : "Legal basis, version, and effective date are required.",
      }),
    ];
    const result = checks.every(
      (check) => check.result === "PASS" || check.severity === "WARNING",
    )
      ? ("PASS" as const)
      : ("FAIL" as const);
    const snapshot = (
      evidence: ReturnType<WorkPermitsService["snapshotEvidence"]>[],
      checkCode: string,
    ) => ({
      checkedAt: checkedAt.toISOString(),
      result:
        checks.find((check) => check.code === checkCode)?.result ??
        ("FAIL" as const),
      evidence,
    });
    const snapshots = {
      trainingCheckSnapshot: snapshot(
        trainingEvidence,
        "TRAINING_EVIDENCE_VALID",
      ),
      briefingCheckSnapshot: snapshot(
        briefingEvidence,
        "BRIEFING_EVIDENCE_VALID",
      ),
      certificateCheckSnapshot: snapshot(
        certificateEvidence,
        "QUALIFICATION_OR_CERTIFICATE_VALID",
      ),
      medicalCheckSnapshot: {
        ...snapshot(medicalEvidence, "MEDICAL_CLEARANCE_VALID"),
        containsDiagnosis: false as const,
      },
      ppeIssuedSnapshot: snapshot(ppeEvidence, "PPE_ISSUED_VALID"),
      requiredDocumentSnapshot: snapshot(
        requiredEvidence,
        "REQUIRED_DOCUMENTS_PRESENT",
      ),
      contractorAccessActSnapshot: {
        checkedAt: checkedAt.toISOString(),
        result:
          checks.find(
            (check) => check.code === "CONTRACTOR_ACCESS_ACT_DATE_COVERAGE",
          )?.result ?? ("FAIL" as const),
        evidence: contractorAccessAct
          ? [
              this.snapshotEvidence("CONTRACTOR_ACCESS_ACT", {
                id: contractorAccessAct.id,
                status: contractorAccessAct.status,
                documentNumber: contractorAccessAct.actNumber,
                validUntil: contractorAccessAct.validTo,
                subjectId: contractorAccessAct.contractorOrganizationId,
              }),
            ]
          : [],
      },
    };
    const payloadHash = this.precheckPayloadHash(entry);
    const blockerCount = checks.filter(
      (check) => check.result === "FAIL" && check.severity === "BLOCKER",
    ).length;
    const warningCount = checks.filter(
      (check) => check.result === "FAIL" && check.severity === "WARNING",
    ).length;
    const nextEntry = {
      ...entry,
      status: result === "PASS" ? "draft" : "missing_documents",
      precheckSummary: {
        result,
        checkedAt: checkedAt.toISOString(),
        failedRules: checks
          .filter((check) => check.result === "FAIL")
          .map((check) => check.code),
        blockerCount,
        warningCount,
        payloadHash,
      },
      precheckChecks: checks,
      ...snapshots,
      documentVersionHash: undefined,
      signedPayloadHash: undefined,
      updatedAt: checkedAt.toISOString(),
    };
    const payload = this.payloadWithEntry(permit, nextEntry);
    const snapshotHash = canonicalHash({ checks, snapshots, payloadHash });

    await this.prisma.$transaction(async (transaction) => {
      const version = await this.appendVersion(
        transaction,
        permit,
        payload,
        user.userId,
      );
      await transaction.workPermitPrecheckRun.create({
        data: {
          permitId: permit.id,
          versionId: version.id,
          result,
          checksJson: checks as Prisma.InputJsonValue,
          snapshotsJson: snapshots as Prisma.InputJsonValue,
          snapshotHash,
          checkedByUserId: user.userId,
          checkedAt,
        },
      });
      await transaction.workPermit.update({
        where: { id: permit.id },
        data: {
          status: result === "PASS" ? "DRAFT" : "MISSING_DOCUMENTS",
        },
      });
    });
    await this.auditService.log({
      actorUserId: user.userId,
      companyId: permit.organizationId,
      action:
        result === "PASS"
          ? "work_permit.precheck_passed"
          : "work_permit.precheck_failed",
      entityType: "WorkPermit",
      entityId: permit.id,
      metadata: { snapshotHash },
    });
    return this.get(user, permit.id);
  }

  private async transition(
    user: AuthenticatedUser,
    id: string,
    action: WorkPermitAction,
    nextStatus: WorkPermitDbStatus,
    input: { comment?: string | null; reason?: string | null } = {},
  ) {
    const permit = await this.findPermit(id);
    const actorEmployeeId = await this.assertAccess(user, permit, action);
    assertWorkPermitTransition(permit.status, nextStatus);
    const entry = this.payloadEntry(permit);
    const now = new Date();
    const nextEntry = {
      ...entry,
      status: entryStatusByDbStatus[nextStatus],
      [`${action.replace("-", "")}At`]: now.toISOString(),
      ...(input.comment
        ? { [`${action.replace("-", "")}Comment`]: input.comment }
        : {}),
      ...(input.reason
        ? action === "reject"
          ? { rejectionReason: input.reason }
          : action === "cancel"
            ? { cancellationReason: input.reason }
            : { suspensionReason: input.reason }
        : {}),
      updatedAt: now.toISOString(),
    };
    const payload = this.payloadWithEntry(permit, nextEntry);
    const appendDocumentVersion = ![
      "SIGNED",
      "ACTIVE",
      "SUSPENDED",
      "EXTENDED",
      "CLOSED",
      "EXPIRED",
    ].includes(permit.status);

    await this.prisma.$transaction(async (transaction) => {
      if (appendDocumentVersion) {
        await this.appendVersion(transaction, permit, payload, user.userId);
      }
      await transaction.workPermit.update({
        where: { id },
        data: {
          status: nextStatus,
          rejectionReason:
            action === "reject"
              ? (input.reason ?? null)
              : permit.rejectionReason,
          cancellationReason:
            action === "cancel"
              ? (input.reason ?? null)
              : permit.cancellationReason,
          suspensionReason:
            action === "suspend"
              ? (input.reason ?? null)
              : permit.suspensionReason,
          signedPayloadHash:
            action === "reject" ? null : permit.signedPayloadHash,
          updatedByUserId: user.userId,
        },
      });
      if (action === "activate" && permit.documentEnvelopeId) {
        await transaction.documentEnvelope.update({
          where: { id: permit.documentEnvelopeId },
          data: { status: "ACTIVE" },
        });
      }
      if (action === "cancel" && permit.documentEnvelopeId) {
        await transaction.documentEnvelope.update({
          where: { id: permit.documentEnvelopeId },
          data: { status: "ANNULLED" },
        });
      }
      if (action === "reject" && permit.documentEnvelopeId) {
        await transaction.documentEnvelope.update({
          where: { id: permit.documentEnvelopeId },
          data: { status: "DRAFT" },
        });
      }
      if (action === "confirm") {
        await transaction.workPermitApproval.update({
          where: { permitId_stepNo: { permitId: id, stepNo: 1 } },
          data: {
            status: "CONFIRMED",
            comment: input.comment ?? null,
            decidedAt: now,
            decidedByUserId: user.userId,
          },
        });
      }
      if (action === "approve") {
        await transaction.workPermitApproval.update({
          where: { permitId_stepNo: { permitId: id, stepNo: 2 } },
          data: {
            status: "APPROVED",
            comment: input.comment ?? null,
            decidedAt: now,
            decidedByUserId: user.userId,
          },
        });
      }
      if (action === "reject") {
        await transaction.workPermitApproval.updateMany({
          where: { permitId: id, status: "PENDING" },
          data: {
            status: "REJECTED",
            rejectionReason: input.reason ?? null,
            decidedAt: now,
            decidedByUserId: user.userId,
          },
        });
      }
      if (action === "activate") {
        await transaction.workPermitApproval.update({
          where: { permitId_stepNo: { permitId: id, stepNo: 4 } },
          data: {
            status: "ACTIVATED",
            comment: input.comment ?? null,
            decidedAt: now,
            decidedByUserId: user.userId,
          },
        });
      }
      void actorEmployeeId;
    });
    await this.auditService.log({
      actorUserId: user.userId,
      companyId: permit.organizationId,
      action: `work_permit.${action}`,
      entityType: "WorkPermit",
      entityId: id,
      metadata: input,
    });
    return this.get(user, id);
  }

  async submit(
    user: AuthenticatedUser,
    id: string,
    input: PermitWorkflowInput,
  ) {
    const permit = await this.findPermit(id);
    await this.assertAccess(user, permit, "submit");
    assertWorkPermitTransition(permit.status, "IN_APPROVAL");
    this.assertCurrentPrecheck(permit);
    if (
      !permit.workProducerEmployeeId ||
      !permit.responsibleManagerEmployeeId ||
      !permit.issuerEmployeeId ||
      !permit.admitterEmployeeId
    ) {
      throw new BadRequestException(
        "Work producer, responsible manager, permit issuer, and admitter must be assigned before submit.",
      );
    }
    const routeSteps = resolveWorkPermitApprovalSteps(
      permit.documentEnvelope?.approvalRoute?.steps ?? [],
    );
    const employeeByRole = {
      WORK_PRODUCER: permit.workProducerEmployeeId,
      RESPONSIBLE_MANAGER: permit.responsibleManagerEmployeeId,
      PERMIT_ISSUER: permit.issuerEmployeeId,
      ADMITTER: permit.admitterEmployeeId,
    };
    const now = new Date();
    const payload = this.payloadWithEntry(permit, {
      ...this.payloadEntry(permit),
      status: "pending_approval",
      approvalStatus: "pending_approval",
      approvalRequestedAt: now.toISOString(),
      approvalComment: input.comment ?? null,
      updatedAt: now.toISOString(),
    });
    await this.prisma.$transaction(async (transaction) => {
      await this.appendVersion(transaction, permit, payload, user.userId);
      await transaction.workPermit.update({
        where: { id },
        data: { status: "IN_APPROVAL", updatedByUserId: user.userId },
      });
      await transaction.documentEnvelope.update({
        where: { id: permit.documentEnvelopeId! },
        data: { status: "IN_APPROVAL" },
      });
      await transaction.workPermitApproval.deleteMany({
        where: { permitId: id },
      });
      await transaction.workPermitApproval.createMany({
        data: routeSteps.map((step) => ({
          permitId: id,
          stepNo: step.stepNo,
          role: step.role,
          assignedEmployeeId: employeeByRole[step.role],
          metadataJson: {
            approvalRouteId: permit.documentEnvelope?.approvalRouteId ?? null,
            sourceStepId: step.sourceStepId,
            sourceStepNo: step.sourceStepNo,
            action: step.action,
          },
        })),
      });
    });
    await this.auditService.log({
      actorUserId: user.userId,
      companyId: permit.organizationId,
      action: "work_permit.submitted",
      entityType: "WorkPermit",
      entityId: id,
    });
    return this.get(user, id);
  }

  async confirm(
    user: AuthenticatedUser,
    id: string,
    input: PermitWorkflowInput,
  ) {
    const permit = await this.findPermit(id);
    if (permit.status !== "IN_APPROVAL") {
      throw new ConflictException(
        "Permit is not awaiting work producer confirmation.",
      );
    }
    const decision = permit.approvals.find((approval) => approval.stepNo === 1);
    if (decision?.status !== "PENDING") {
      throw new ConflictException(
        "Work producer confirmation is already recorded.",
      );
    }
    const actor = await this.assertAccess(user, permit, "confirm");
    await this.prisma.workPermitApproval.update({
      where: { permitId_stepNo: { permitId: id, stepNo: 1 } },
      data: {
        status: "CONFIRMED",
        comment: input.comment ?? null,
        decidedAt: new Date(),
        decidedByUserId: user.userId,
        metadataJson: {
          ...objectValue(decision.metadataJson),
          actorEmployeeId: actor,
        },
      },
    });
    await this.auditService.log({
      actorUserId: user.userId,
      companyId: permit.organizationId,
      action: "work_permit.confirmed",
      entityType: "WorkPermit",
      entityId: id,
      metadata: { comment: input.comment ?? null },
    });
    return this.get(user, id);
  }

  async approve(
    user: AuthenticatedUser,
    id: string,
    input: PermitWorkflowInput,
  ) {
    const permit = await this.findPermit(id);
    const producerDecision = permit.approvals.find(
      (decision) => decision.stepNo === 1,
    );
    if (producerDecision?.status !== "CONFIRMED") {
      throw new ConflictException(
        "Work producer must confirm the permit first.",
      );
    }
    return this.transition(user, id, "approve", "APPROVED", input);
  }

  async reject(user: AuthenticatedUser, id: string, input: PermitReasonInput) {
    const permit = await this.findPermit(id);
    if (!["IN_APPROVAL", "SIGNING_READY"].includes(permit.status)) {
      throw new ConflictException("Only pending permits can be rejected.");
    }
    return this.transition(user, id, "reject", "REJECTED", input);
  }

  async prepareSign(
    user: AuthenticatedUser,
    id: string,
    input: PreparePermitSignInput,
  ) {
    const permit = await this.findPermit(id);
    await this.assertAccess(user, permit, "prepare-sign");
    assertWorkPermitTransition(permit.status, "SIGNING_READY");
    if (
      !permit.currentVersion ||
      !permit.currentVersion.documentVersionId ||
      !permit.documentEnvelopeId
    ) {
      throw new BadRequestException(
        "Current permit document version is missing.",
      );
    }
    const payload = permit.currentVersion.payloadJson;
    const signedPayloadHash = canonicalHash(payload);
    if (signedPayloadHash !== permit.currentVersion.payloadHash) {
      throw new ConflictException(
        "Current permit payload hash is inconsistent.",
      );
    }
    const now = new Date();
    await this.prisma.$transaction(async (transaction) => {
      await transaction.documentVersion.update({
        where: { id: permit.currentVersion!.documentVersionId! },
        data: {
          status: "FINAL",
          renderedHash: signedPayloadHash,
          changeReason: input.comment ?? null,
        },
      });
      await transaction.workPermitVersion.update({
        where: { id: permit.currentVersion!.id },
        data: {
          status: "FINAL",
          signedPayloadHash,
          approvedAt: now,
        },
      });
      await transaction.documentEnvelope.update({
        where: { id: permit.documentEnvelopeId! },
        data: { status: "SIGNING_READY" },
      });
      await transaction.workPermit.update({
        where: { id },
        data: {
          status: "SIGNING_READY",
          approvedAt: now,
          signedPayloadHash,
          updatedByUserId: user.userId,
        },
      });
    });
    await this.auditService.log({
      actorUserId: user.userId,
      companyId: permit.organizationId,
      action: "work_permit.signing_prepared",
      entityType: "WorkPermit",
      entityId: id,
      metadata: { signedPayloadHash },
    });
    return this.get(user, id);
  }

  async activate(
    user: AuthenticatedUser,
    id: string,
    input: PermitWorkflowInput,
  ) {
    const permit = await this.findPermit(id);
    this.assertCurrentPrecheck(permit);
    await this.transition(user, id, "activate", "ACTIVE", input);
    await this.prisma.workPermit.update({
      where: { id },
      data: { startedAt: new Date() },
    });
    return this.get(user, id);
  }

  async suspend(user: AuthenticatedUser, id: string, input: PermitReasonInput) {
    return this.transition(user, id, "suspend", "SUSPENDED", input);
  }

  async resume(
    user: AuthenticatedUser,
    id: string,
    input: PermitWorkflowInput,
  ) {
    return this.transition(user, id, "resume", "ACTIVE", input);
  }

  async close(user: AuthenticatedUser, id: string, input: ClosePermitInput) {
    const permit = await this.findPermit(id);
    await this.assertAccess(user, permit, "close");
    assertWorkPermitTransition(permit.status, "CLOSED");
    const closedAt = input.closure.closedAt
      ? new Date(input.closure.closedAt)
      : new Date();
    const closure = {
      ...input.closure,
      closedAt: closedAt.toISOString(),
      notes: input.closure.notes ?? input.comment ?? null,
    };
    const closureHash = canonicalHash(closure);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.workPermitClosure.create({
        data: {
          permitId: id,
          result: closure.result,
          inspection: closure.inspection,
          notes: closure.notes,
          closedByUserId: user.userId,
          payloadHash: closureHash,
          closedAt,
        },
      });
      await transaction.workPermit.update({
        where: { id },
        data: {
          status: "CLOSED",
          closedAt,
          updatedByUserId: user.userId,
        },
      });
    });
    await this.auditService.log({
      actorUserId: user.userId,
      companyId: permit.organizationId,
      action: "work_permit.closed",
      entityType: "WorkPermit",
      entityId: id,
      metadata: { closureHash },
    });
    return this.get(user, id);
  }

  async cancel(user: AuthenticatedUser, id: string, input: PermitReasonInput) {
    const permit = await this.findPermit(id);
    if (["ARCHIVED", "CLOSED", "EXPIRED"].includes(permit.status)) {
      throw new ConflictException("Terminal work permit cannot be cancelled.");
    }
    return this.transition(user, id, "cancel", "CANCELLED", input);
  }

  private artifactDate(value: unknown) {
    if (value instanceof Date) return value;
    if (typeof value !== "string" || !value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private artifactChecks(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => {
      const check = objectValue(item);
      return {
        code: String(check.code ?? "UNKNOWN"),
        label: String(check.label ?? check.code ?? "Unknown check"),
        result: check.result === "PASS" ? "PASS" : "FAIL",
        severity: check.severity === "WARNING" ? "WARNING" : "BLOCKER",
        message: String(check.message ?? ""),
        evidenceIds: stringArray(check.evidenceIds),
      };
    });
  }

  private async buildPermitArtifact(
    user: AuthenticatedUser,
    permit: PermitWithDetails,
    generatedAt = new Date(),
  ) {
    const entry = this.payloadEntry(permit);
    const crew = Array.isArray(entry.crew)
      ? entry.crew.map(objectValue)
      : permit.brigades.flatMap((brigade) =>
          brigade.members.map((member) => ({
            employeeId: member.employeeId,
            contractorWorkerId: member.contractorWorkerId,
            roleCode: member.roleCode,
          })),
        );
    const acknowledgements = Array.isArray(
      entry.crewInstructionAcknowledgements,
    )
      ? entry.crewInstructionAcknowledgements.map(objectValue)
      : [];
    const employeeIds = [
      permit.issuerEmployeeId,
      permit.responsibleManagerEmployeeId,
      permit.workProducerEmployeeId,
      permit.admitterEmployeeId,
      permit.observerEmployeeId,
      typeof entry.targetBriefingInstructorId === "string"
        ? entry.targetBriefingInstructorId
        : null,
      typeof entry.admittedById === "string" ? entry.admittedById : null,
      ...crew.map((member) =>
        typeof member.employeeId === "string" ? member.employeeId : null,
      ),
    ].filter((id): id is string => Boolean(id));
    const workerIds = [
      permit.contractorRepresentativeId,
      ...crew.map((member) =>
        typeof member.contractorWorkerId === "string"
          ? member.contractorWorkerId
          : null,
      ),
    ].filter((id): id is string => Boolean(id));
    const closedByUserId = permit.closure?.closedByUserId ?? null;
    const [organization, employees, workers, contractor, closedByUser] =
      await Promise.all([
        this.prisma.organization.findUnique({
          where: { id: permit.organizationId },
          select: { id: true, name: true },
        }),
        employeeIds.length
          ? this.prisma.employee.findMany({
              where: {
                companyId: permit.organizationId,
                id: { in: [...new Set(employeeIds)] },
              },
              select: {
                id: true,
                fullName: true,
                employeeNumber: true,
                jobTitle: true,
              },
            })
          : [],
        workerIds.length
          ? this.prisma.contractorWorker.findMany({
              where: {
                organizationId: permit.organizationId,
                id: { in: [...new Set(workerIds)] },
              },
              select: {
                id: true,
                fullName: true,
                workerNumber: true,
                positionTitle: true,
              },
            })
          : [],
        permit.contractorOrganizationId
          ? this.prisma.contractorOrganization.findFirst({
              where: {
                id: permit.contractorOrganizationId,
                organizationId: permit.organizationId,
              },
              select: { id: true, name: true },
            })
          : null,
        closedByUserId
          ? this.prisma.user.findUnique({
              where: { id: closedByUserId },
              select: { id: true, fullName: true },
            })
          : null,
      ]);
    if (!organization) {
      throw new NotFoundException("Permit organization not found.");
    }
    const employeeById = new Map(
      employees.map((employee) => [employee.id, employee]),
    );
    const workerById = new Map(workers.map((worker) => [worker.id, worker]));
    const employeeName = (id: string | null | undefined) =>
      id ? (employeeById.get(id)?.fullName ?? id) : null;
    const workerName = (id: string | null | undefined) =>
      id ? (workerById.get(id)?.fullName ?? id) : null;
    const acknowledgementStatus = (
      employeeId: string | null,
      contractorWorkerId: string | null,
    ) => {
      const acknowledgement = acknowledgements.find(
        (item) =>
          (employeeId && item.employeeId === employeeId) ||
          (contractorWorkerId &&
            item.contractorWorkerId === contractorWorkerId),
      );
      return acknowledgement
        ? String(acknowledgement.status ?? "pending")
        : null;
    };
    const precheckRun = permit.precheckRuns[0] ?? null;
    const checks = this.artifactChecks(
      precheckRun?.checksJson ?? entry.precheckChecks,
    );
    const precheckSummary = objectValue(entry.precheckSummary);
    const blockerCount = checks.filter(
      (check) => check.result === "FAIL" && check.severity === "BLOCKER",
    ).length;
    const warningCount = checks.filter(
      (check) => check.result === "FAIL" && check.severity === "WARNING",
    ).length;
    const pdf = {
      permitCode: permit.permitCode,
      journalRegistrationNumber: permit.journalRegistrationNumber,
      permitType: permit.permitType,
      workType: permit.workType,
      status: permit.status,
      draft: permit.status === "DRAFT",
      organizationName: organization.name,
      branchName: permit.branch?.name ?? null,
      workSiteName: permit.workSite
        ? [permit.workSite.name, permit.workSite.location]
            .filter(Boolean)
            .join(" / ")
        : null,
      workDescription: String(entry.workDescription ?? permit.workDescription),
      workplace: String(entry.workplace ?? permit.workplace),
      equipmentOrObject:
        typeof entry.equipmentOrObject === "string"
          ? entry.equipmentOrObject
          : null,
      issuedAt: permit.issuedAt ?? permit.createdAt,
      effectiveFrom: this.artifactDate(entry.startAt) ?? permit.effectiveFrom,
      effectiveTo: this.artifactDate(entry.endAt) ?? permit.effectiveTo,
      legalBasis: stringArray(entry.legalBasis),
      legalBasisVersion:
        typeof entry.legalBasisVersion === "string"
          ? entry.legalBasisVersion
          : null,
      legalBasisEffectiveDate:
        typeof entry.legalBasisEffectiveDate === "string"
          ? entry.legalBasisEffectiveDate
          : null,
      responsiblePeople: [
        {
          role: "Выдающий наряд",
          name: employeeName(permit.issuerEmployeeId),
        },
        {
          role: "Ответственный руководитель",
          name: employeeName(permit.responsibleManagerEmployeeId),
        },
        {
          role: "Производитель работ",
          name: employeeName(permit.workProducerEmployeeId),
        },
        {
          role: "Допускающий",
          name: employeeName(permit.admitterEmployeeId),
        },
        {
          role: "Наблюдающий",
          name: employeeName(permit.observerEmployeeId),
        },
      ].filter((person): person is { role: string; name: string } =>
        Boolean(person.name),
      ),
      contractor:
        contractor || permit.contractorAccessAct
          ? {
              name:
                contractor?.name ??
                permit.contractorAccessAct?.contractorOrganization.name ??
                String(permit.contractorOrganizationId),
              representative:
                workerName(permit.contractorRepresentativeId) ??
                permit.contractorAccessAct?.contractorRepresentative
                  ?.fullName ??
                null,
              accessActNumber: permit.contractorAccessAct?.actNumber ?? null,
              accessActValidFrom: permit.contractorAccessAct?.validFrom ?? null,
              accessActValidTo: permit.contractorAccessAct?.validTo ?? null,
              workArea: permit.contractorAccessAct?.workArea ?? null,
            }
          : null,
      crew: crew.map((member) => {
        const employeeId =
          typeof member.employeeId === "string" ? member.employeeId : null;
        const contractorWorkerId =
          typeof member.contractorWorkerId === "string"
            ? member.contractorWorkerId
            : null;
        return {
          name:
            employeeName(employeeId) ??
            workerName(contractorWorkerId) ??
            "Не указано",
          role: String(member.roleCode ?? "EXECUTOR"),
          subjectType: employeeId ? "INTERNAL_EMPLOYEE" : "CONTRACTOR_WORKER",
          acknowledgementStatus: acknowledgementStatus(
            employeeId,
            contractorWorkerId,
          ),
        };
      }),
      hazardFactors: stringArray(entry.hazardFactors),
      safetyMeasures: String(entry.safetyMeasures ?? ""),
      workplacePreparationMeasures:
        typeof entry.workplacePreparationMeasures === "string"
          ? entry.workplacePreparationMeasures
          : null,
      ppeRequirements:
        typeof entry.ppeRequirements === "string"
          ? entry.ppeRequirements
          : null,
      isolationLockoutMeasures:
        typeof entry.isolationLockoutMeasures === "string"
          ? entry.isolationLockoutMeasures
          : null,
      fencingAndSignsMeasures:
        typeof entry.fencingAndSignsMeasures === "string"
          ? entry.fencingAndSignsMeasures
          : null,
      fireSafetyMeasures:
        typeof entry.fireSafetyMeasures === "string"
          ? entry.fireSafetyMeasures
          : null,
      airAnalysis:
        entry.airAnalysisRequired === true
          ? [
              String(entry.airAnalysisResult ?? "Результат не указан"),
              typeof entry.airAnalysisAt === "string"
                ? entry.airAnalysisAt
                : null,
              typeof entry.airAnalysisBy === "string"
                ? `исполнитель: ${entry.airAnalysisBy}`
                : null,
            ]
              .filter(Boolean)
              .join(" / ")
          : "Не требуется",
      targetBriefing: {
        text:
          typeof entry.targetBriefingText === "string"
            ? entry.targetBriefingText
            : null,
        at: this.artifactDate(entry.targetBriefingAt),
        instructor: employeeName(
          typeof entry.targetBriefingInstructorId === "string"
            ? entry.targetBriefingInstructorId
            : null,
        ),
        acknowledgements: acknowledgements.length
          ? `${acknowledgements.filter((item) => item.status === "acknowledged").length}/${acknowledgements.length} acknowledged`
          : "Не указано",
      },
      precheck:
        precheckRun || Object.keys(precheckSummary).length
          ? {
              result: String(
                precheckRun?.result ?? precheckSummary.result ?? "FAIL",
              ),
              checkedAt:
                precheckRun?.checkedAt ??
                this.artifactDate(precheckSummary.checkedAt),
              blockerCount:
                typeof precheckSummary.blockerCount === "number"
                  ? precheckSummary.blockerCount
                  : blockerCount,
              warningCount:
                typeof precheckSummary.warningCount === "number"
                  ? precheckSummary.warningCount
                  : warningCount,
              checks: checks.map((check) => ({
                code: check.code,
                result: check.result,
                severity: check.severity,
              })),
            }
          : null,
      admission: {
        admissionAt: this.artifactDate(entry.admissionAt) ?? permit.startedAt,
        admittedBy: employeeName(
          typeof entry.admittedById === "string"
            ? entry.admittedById
            : permit.admitterEmployeeId,
        ),
        acceptedByWorkProducerAt: this.artifactDate(
          entry.acceptedByWorkProducerAt,
        ),
      },
      closure: permit.closure
        ? {
            closedAt: permit.closure.closedAt,
            result: permit.closure.result,
            inspection: permit.closure.inspection,
            closedBy: closedByUser?.fullName ?? null,
            notes: permit.closure.notes,
          }
        : null,
      payloadHash: permit.currentVersion?.payloadHash ?? null,
      signedPayloadHash: permit.signedPayloadHash,
      documentVersionHash:
        permit.currentVersion?.documentVersion?.renderedHash ??
        permit.currentVersion?.payloadHash ??
        null,
      documentVersionId: permit.currentVersion?.documentVersionId ?? null,
      signatures:
        permit.documentEnvelope?.signatures.map((signature) => ({
          signerName: signature.signerName,
          signerRole: signature.signerRole,
          provider: signature.provider,
          status: signature.status,
          certificateSerial: signature.certificateSerial,
          signedAt: signature.signedAt,
          verification: signature.verification?.result ?? null,
        })) ?? [],
      generatedAt,
      generatedBy: user.fullName ?? user.email,
    };
    return {
      entry,
      pdf,
      canonicalPayloadHash: canonicalHash(
        permit.currentVersion?.payloadJson ?? {},
      ),
    };
  }

  private isFinalPermitArtifact(status: string) {
    return [
      "SIGNED",
      "ACTIVE",
      "SUSPENDED",
      "EXTENDED",
      "CLOSED",
      "EXPIRED",
      "CANCELLED",
      "ARCHIVED",
    ].includes(status);
  }

  private async renderAndSnapshotPermitPdf(
    user: AuthenticatedUser,
    permit: PermitWithDetails,
  ) {
    const artifact = await this.buildPermitArtifact(user, permit);
    const buffer = await this.pdfService.renderWorkPermit(artifact.pdf);
    const pdfHash = sha256(buffer);
    let snapshot = null;
    if (
      this.isFinalPermitArtifact(permit.status) &&
      permit.documentEnvelopeId &&
      permit.currentVersion?.documentVersionId
    ) {
      snapshot = await this.corePlatformService.createExportSnapshot(user, {
        organizationId: permit.organizationId,
        envelopeId: permit.documentEnvelopeId,
        versionId: permit.currentVersion.documentVersionId,
        format: "PDF_A_1",
        storageUri: `generated://work-permits/${permit.id}/pdf/${pdfHash}`,
        sha256: pdfHash,
        manifestJson: {
          subjectType: "WORK_PERMIT",
          subjectId: permit.id,
          permitNumber: permit.permitCode,
          journalRegistrationNumber: permit.journalRegistrationNumber,
          payloadHash: permit.currentVersion.payloadHash,
          signedPayloadHash: permit.signedPayloadHash,
          canonicalPayloadHash: artifact.canonicalPayloadHash,
          generatedAt: artifact.pdf.generatedAt.toISOString(),
          generatedByUserId: user.userId,
        },
      });
    }
    await this.auditService.log({
      actorUserId: user.userId,
      companyId: permit.organizationId,
      action: "work_permit.pdf_generated",
      entityType: "WorkPermit",
      entityId: permit.id,
      metadata: {
        pdfHash,
        exportSnapshotId: snapshot?.id ?? null,
        versionId: permit.currentVersion?.documentVersionId ?? null,
        draft: permit.status === "DRAFT",
      },
    });
    return { buffer, pdfHash, snapshot, artifact };
  }

  private async buildPermitEvidenceManifest(
    user: AuthenticatedUser,
    permit: PermitWithDetails,
  ) {
    if (!permit.documentEnvelopeId) {
      throw new NotFoundException("Permit evidence package is unavailable.");
    }
    const [genericEvidence, auditEvents, attachments] = await Promise.all([
      this.corePlatformService.buildEvidencePackage(
        user,
        permit.documentEnvelopeId,
      ),
      this.prisma.auditLog.findMany({
        where: {
          companyId: permit.organizationId,
          entityType: "WorkPermit",
          entityId: permit.id,
        },
        select: {
          id: true,
          action: true,
          actorUserId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.attachment.findMany({
        where: {
          organizationId: permit.organizationId,
          OR: [
            { ownerType: "WORK_PERMIT", ownerId: permit.id },
            ...(permit.currentVersion
              ? [
                  {
                    ownerType: "WORK_PERMIT_VERSION" as const,
                    ownerId: permit.currentVersion.id,
                  },
                ]
              : []),
          ],
        },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          sha256: true,
          ownerType: true,
          ownerId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    const artifact = await this.buildPermitArtifact(user, permit);
    const latestPrecheck = permit.precheckRuns[0] ?? null;
    const checks = this.artifactChecks(latestPrecheck?.checksJson);
    const latestPdf = genericEvidence.exportSnapshots
      .filter((snapshot) => snapshot.format === "PDF_A_1")
      .at(-1);
    const manifest = {
      permit: {
        id: permit.id,
        organizationId: permit.organizationId,
        permitNumber: permit.permitCode,
        journalRegistrationNumber: permit.journalRegistrationNumber,
        status: permit.status,
        legalBasis: artifact.pdf.legalBasis,
        legalBasisVersion: artifact.pdf.legalBasisVersion,
        legalBasisEffectiveDate: artifact.pdf.legalBasisEffectiveDate,
      },
      document: {
        currentVersionId: permit.currentVersionId,
        documentEnvelopeId: permit.documentEnvelopeId,
        documentVersionId: permit.currentVersion?.documentVersionId ?? null,
      },
      hashes: {
        payloadHash: permit.currentVersion?.payloadHash ?? null,
        signedPayloadHash: permit.signedPayloadHash,
        canonicalPayloadHash: artifact.canonicalPayloadHash,
        generatedPdfHash: latestPdf?.sha256 ?? null,
      },
      signatures: genericEvidence.signatures.map((signature) => ({
        id: signature.id,
        provider: signature.provider,
        status: signature.status,
        createdAt: signature.createdAt,
        signedAt: signature.signedAt,
        signer: {
          id: signature.signerUserId ?? signature.signerEmployeeId,
          role: signature.signerRole,
          name: signature.signerName,
        },
        certificate: signature.certificateMetadata
          ? {
              id: signature.certificateMetadata.id,
              serial: signature.certificateMetadata.serial,
              thumbprint: signature.certificateMetadata.thumbprint,
              validFrom: signature.certificateMetadata.validFrom,
              validTo: signature.certificateMetadata.validTo,
            }
          : {
              id: signature.certificateMetadataId,
              serial: signature.certificateSerial,
              thumbprint: null,
              validFrom: null,
              validTo: null,
            },
        verification: signature.verification
          ? {
              result: signature.verification.result,
              checkedAt: signature.verification.checkedAt,
              chainStatus: signature.verification.chainStatus,
              revocationStatus: signature.verification.revocationStatus,
            }
          : null,
      })),
      precheck: latestPrecheck
        ? {
            latestRunId: latestPrecheck.id,
            result: latestPrecheck.result,
            checkedAt: latestPrecheck.checkedAt,
            snapshotHash: latestPrecheck.snapshotHash,
            versionId: latestPrecheck.versionId,
            blockerCount: checks.filter(
              (check) =>
                check.result === "FAIL" && check.severity === "BLOCKER",
            ).length,
            warningCount: checks.filter(
              (check) =>
                check.result === "FAIL" && check.severity === "WARNING",
            ).length,
            rules: checks.map((check) => ({
              code: check.code,
              result: check.result,
              severity: check.severity,
              message: check.message,
              evidenceIds: check.evidenceIds,
            })),
          }
        : null,
      contractorAccessAct: permit.contractorAccessAct
        ? {
            id: permit.contractorAccessAct.id,
            actNumber: permit.contractorAccessAct.actNumber,
            status: permit.contractorAccessAct.status,
            validFrom: permit.contractorAccessAct.validFrom,
            validTo: permit.contractorAccessAct.validTo,
            contractor: {
              id: permit.contractorAccessAct.contractorOrganization.id,
              name: permit.contractorAccessAct.contractorOrganization.name,
            },
            workArea: permit.contractorAccessAct.workArea,
          }
        : null,
      closure: permit.closure
        ? {
            result: permit.closure.result,
            inspection: permit.closure.inspection,
            closedAt: permit.closure.closedAt,
            payloadHash: permit.closure.payloadHash,
          }
        : null,
      archive: permit.archiveRecord
        ? {
            id: permit.archiveRecord.id,
            status: permit.archiveRecord.status,
            archiveManifestHash: permit.archiveRecord.archiveManifestHash,
            archivedAt: permit.archiveRecord.archivedAt,
            retentionPolicyId: permit.archiveRecord.retentionPolicyId,
            retentionCode: permit.archiveRecord.retentionPolicy.retentionCode,
          }
        : null,
      exportSnapshots: genericEvidence.exportSnapshots.map((snapshot) => ({
        id: snapshot.id,
        format: snapshot.format,
        sha256: snapshot.sha256,
        storageUri: snapshot.storageUri,
        versionId: snapshot.versionId,
        generatedAt: snapshot.generatedAt,
      })),
      auditEvents,
      attachments,
      medicalPrivacy: {
        containsDiagnosis: false,
        includedFields:
          "clearance status, validity dates, evidence identifiers only",
      },
      generatedAt: new Date(),
      generatedByUserId: user.userId,
    };
    return {
      ...manifest,
      manifestHash: canonicalHash(manifest),
    };
  }

  async archive(user: AuthenticatedUser, id: string) {
    const permit = await this.findPermit(id);
    await this.assertAccess(user, permit, "archive");
    if (!["CLOSED", "EXPIRED", "CANCELLED"].includes(permit.status)) {
      throw new ConflictException(
        "Only closed, expired, or cancelled work permits can be archived.",
      );
    }
    assertWorkPermitTransition(permit.status, "ARCHIVED");
    if (
      !permit.documentEnvelopeId ||
      !permit.currentVersion?.documentVersionId
    ) {
      throw new BadRequestException("Permit document is incomplete.");
    }
    const effectiveAt =
      permit.closedAt ?? permit.effectiveTo ?? permit.updatedAt;
    const resolved =
      await this.corePlatformService.ensureRetentionPolicyResolved(user, {
        organizationId: permit.organizationId,
        documentKind: "WORK_PERMIT",
        scopeType: permit.scopeType,
        effectiveAt: effectiveAt.toISOString(),
      });
    if (!resolved) {
      throw new BadRequestException("Retention policy could not be resolved.");
    }
    await this.renderAndSnapshotPermitPdf(user, permit);
    const evidenceManifest = await this.buildPermitEvidenceManifest(
      user,
      permit,
    );
    const now = new Date();
    const archiveRecord = await this.corePlatformService.createArchiveRecord(
      user,
      {
        organizationId: permit.organizationId,
        envelopeId: permit.documentEnvelopeId,
        versionId: permit.currentVersion.documentVersionId,
        retentionPolicyId: resolved.policy.id,
        status: "ARCHIVED",
        sealedAt: effectiveAt.toISOString(),
        archivedAt: now.toISOString(),
        archiveManifestHash: evidenceManifest.manifestHash,
        storageUri: `generated://work-permits/${permit.id}/archive/${evidenceManifest.manifestHash}`,
      },
    );
    await this.prisma.$transaction(async (transaction) => {
      await transaction.documentEnvelope.update({
        where: { id: permit.documentEnvelopeId! },
        data: { status: "ARCHIVED" },
      });
      await transaction.workPermit.update({
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
      companyId: permit.organizationId,
      action: "work_permit.archived",
      entityType: "WorkPermit",
      entityId: permit.id,
      metadata: {
        archiveRecordId: archiveRecord.id,
        archiveManifestHash: evidenceManifest.manifestHash,
        pdfHash: evidenceManifest.hashes.generatedPdfHash,
      },
    });
    return this.get(user, id);
  }

  async evidence(user: AuthenticatedUser, id: string) {
    const permit = await this.findPermit(id);
    await this.assertAccess(user, permit);
    const manifest = await this.buildPermitEvidenceManifest(user, permit);
    await this.auditService.log({
      actorUserId: user.userId,
      companyId: permit.organizationId,
      action: "work_permit.evidence_generated",
      entityType: "WorkPermit",
      entityId: permit.id,
      metadata: {
        manifestHash: manifest.manifestHash,
        versionId: permit.currentVersion?.documentVersionId ?? null,
      },
    });
    return manifest;
  }

  async download(user: AuthenticatedUser, id: string) {
    const permit = await this.findPermit(id);
    await this.assertAccess(user, permit);
    const rendered = await this.renderAndSnapshotPermitPdf(user, permit);
    return rendered.buffer;
  }

  async downloadJournal(user: AuthenticatedUser, filters: PermitListFilter) {
    const organizationId = requireOrganizationScope(
      user,
      filters.organizationId ?? null,
    );
    const page = await this.list(user, {
      ...filters,
      organizationId,
      page: 1,
      pageSize: 100,
    });
    const generatedAt = new Date();
    const buffer = await this.pdfService.renderWorkPermitJournal({
      generatedAt,
      records: page.items.map((permit) => ({
        journalRegistrationNumber: permit.journal.journalRegistrationNumber,
        permitNumber: permit.journal.permitNumber,
        issuedAt: permit.issuedAt,
        initialAdmissionAt: this.artifactDate(
          permit.journal.initialAdmissionAt,
        ),
        issuer: permit.journal.issuer?.displayName ?? null,
        workDescription: permit.journal.workDescription,
        workplace: permit.journal.workplace,
        status: permit.status,
        validUntil: this.artifactDate(permit.journal.validUntil),
        closedAt: this.artifactDate(permit.journal.closedAt),
      })),
    });
    await this.auditService.log({
      actorUserId: user.userId,
      companyId: organizationId,
      action: "work_permit.journal_pdf_generated",
      entityType: "WorkPermitJournal",
      entityId: organizationId,
      metadata: {
        sha256: sha256(buffer),
        recordCount: page.items.length,
        generatedAt: generatedAt.toISOString(),
      },
    });
    return buffer;
  }

  async listPpe(user: AuthenticatedUser, organizationId?: string) {
    const resolvedOrganizationId = requireOrganizationScope(
      user,
      organizationId ?? null,
    );
    return this.prisma.ppeIssueRecord.findMany({
      where: { organizationId: resolvedOrganizationId },
      orderBy: { issuedAt: "desc" },
    });
  }

  async createPpe(user: AuthenticatedUser, input: CreatePpeIssueRecordInput) {
    const organizationId = requireOrganizationScope(
      user,
      input.organizationId ?? null,
    );
    if (input.employeeId) {
      const employee = await this.prisma.employee.findFirst({
        where: { id: input.employeeId, companyId: organizationId },
      });
      if (!employee) {
        throw new BadRequestException(
          "PPE recipient does not belong to organization.",
        );
      }
    }
    if (input.contractorWorkerId) {
      const worker = await this.prisma.contractorWorker.findFirst({
        where: {
          id: input.contractorWorkerId,
          organizationId,
        },
      });
      if (!worker) {
        throw new BadRequestException(
          "PPE recipient does not belong to organization.",
        );
      }
    }
    const source = {
      employeeId: input.employeeId ?? null,
      contractorWorkerId: input.contractorWorkerId ?? null,
      itemCode: input.itemCode,
      itemName: input.itemName,
      issuedAt: input.issuedAt,
      validUntil: input.validUntil ?? null,
      sourceDocumentId: input.sourceDocumentId ?? null,
    };
    return this.prisma.ppeIssueRecord.create({
      data: {
        organizationId,
        ...source,
        issuedAt: new Date(input.issuedAt),
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        sourceHash: canonicalHash(source),
        createdByUserId: user.userId,
      },
    });
  }

  async signingTarget(user: AuthenticatedUser, id: string) {
    const permit = await this.findPermit(id);
    await this.assertAccess(user, permit, "sign");
    const envelope = permit.documentEnvelope;
    const documentVersion = envelope?.currentVersion;
    const hash = documentVersion?.renderedHash;
    if (!envelope || !documentVersion || !hash) {
      throw new BadRequestException(
        "Work permit must be prepared for signing first.",
      );
    }
    return {
      documentType: "WORK_PERMIT" as const,
      documentId: permit.id,
      organizationId: permit.organizationId,
      envelopeId: envelope.id,
      versionId: documentVersion.id,
      documentHash: hash,
      title: permit.title,
      documentNumber: permit.permitCode,
      isReadyForSigning:
        permit.status === "SIGNING_READY" &&
        envelope.status === "SIGNING_READY" &&
        documentVersion.status === "FINAL" &&
        permit.signedPayloadHash === hash,
    };
  }

  async completeSigning(
    user: AuthenticatedUser,
    session: {
      id: string;
      organizationId: string;
      documentId: string;
      documentEnvelopeId: string | null;
      documentVersionId: string | null;
      documentHash: string;
      correlationId: string;
    },
    provider: "MOCK_PROVIDER" | "NCALAYER_PROVIDER" | "EGOV_MOBILE_QR_PROVIDER",
    input: MockSignInput | NcalayerBridgeSignature,
    context?: SigningRequestContext,
  ) {
    const permit = await this.findPermit(session.documentId);
    const actorEmployeeId = await this.assertAccess(user, permit, "sign");
    assertWorkPermitTransition(permit.status, "SIGNED");
    const target = await this.signingTarget(user, permit.id);
    if (!target.isReadyForSigning) {
      throw new ConflictException("Work permit is not ready for signing.");
    }
    if (
      target.envelopeId !== session.documentEnvelopeId ||
      target.versionId !== session.documentVersionId ||
      target.documentHash !== session.documentHash
    ) {
      throw new ConflictException(
        "Signing session no longer matches the permit.",
      );
    }
    if (provider === "EGOV_MOBILE_QR_PROVIDER") {
      throw new BadRequestException(
        "Work permit signing currently supports NCALayer and mock test mode only.",
      );
    }
    const result =
      provider === "NCALAYER_PROVIDER"
        ? this.ncalayerSigningProvider.sign({
            entityId: permit.id,
            entityType: "WORK_PERMIT",
            documentHash: session.documentHash,
            ...(input as NcalayerBridgeSignature),
          })
        : this.mockSigningProvider.sign({
            entityId: permit.id,
            entityType: "WORK_PERMIT",
            documentHash: session.documentHash,
            ...(input as MockSignInput),
          });
    const signatureHash = canonicalHash(result.payload);
    const signature = await this.corePlatformService.createSignature(user, {
      envelopeId: target.envelopeId,
      versionId: target.versionId,
      companyId: permit.organizationId,
      organizationId: permit.organizationId,
      briefingRecordId: null,
      signerUserId: user.userId,
      signerEmployeeId: actorEmployeeId,
      signerRole: user.role,
      provider,
      signerName: result.signerName,
      signerIinMasked: result.signerIinMasked,
      certificateSerial: result.certificateSerial,
      certificateMetadataId: null,
      documentHash: result.documentHash,
      signatureHash,
      signedAt: result.signedAt.toISOString(),
      status: "SIGNED",
      payload: {
        subjectType: "WORK_PERMIT",
        subjectId: permit.id,
        signingSessionId: session.id,
        correlationId: session.correlationId,
        requestContext: {
          ipAddress: context?.ipAddress ?? null,
          userAgent: context?.userAgent ?? null,
        },
        providerPayload: result.payload,
      },
    });
    const signedAt = result.signedAt;
    const issuerDecision = permit.approvals.find(
      (approval) => approval.stepNo === 3,
    );
    await this.prisma.$transaction(async (transaction) => {
      await transaction.workPermitVersion.update({
        where: { id: permit.currentVersion!.id },
        data: { status: "SIGNED", signedAt },
      });
      await transaction.workPermitApproval.update({
        where: { permitId_stepNo: { permitId: permit.id, stepNo: 3 } },
        data: {
          status: "SIGNED",
          decidedAt: signedAt,
          decidedByUserId: user.userId,
          metadataJson: {
            ...objectValue(issuerDecision?.metadataJson),
            signatureId: signature.id,
            verification: "PASS",
          },
        },
      });
      await transaction.workPermit.update({
        where: { id: permit.id },
        data: {
          status: "SIGNED",
          signedAt,
          updatedByUserId: user.userId,
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
        signedPayloadHash: session.documentHash,
      },
    });
    return signature;
  }
}
