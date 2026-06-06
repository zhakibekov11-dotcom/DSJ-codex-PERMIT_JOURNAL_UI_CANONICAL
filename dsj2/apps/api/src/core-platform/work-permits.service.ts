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
          status: "pending" as const,
          acknowledgedAt: null,
        })),
        ...input.crew.contractorWorkerIds.map((contractorWorkerId) => ({
          employeeId: null,
          contractorWorkerId,
          status: "pending" as const,
          acknowledgedAt: null,
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
        throw new BadRequestException("Work permit endAt must be after startAt.");
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
          contractorRepresentativeId: input.contractorRepresentativeId ?? null,
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
          ? (current.workplacePreparationMeasures as
              | string
              | null
              | undefined)
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
          contractorRepresentativeId: merged.contractorRepresentativeId ?? null,
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
    const source = { sourceType, ...record, ...overrides };
    return {
      id: String(record.id),
      sourceType,
      sourceStatus: String(record.status ?? "ACTIVE"),
      sourceHash: canonicalHash(source),
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
    };
  }

  private validUntil(
    record: { expiryDate?: Date | null; validUntil?: Date | null },
    at: Date,
  ) {
    const expires = record.expiryDate ?? record.validUntil ?? null;
    return !expires || expires.getTime() >= at.getTime();
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

    const activePeople =
      employees.length === participantEmployeeIds.length &&
      employees.every(
        (employee) => employee.status === "active" && !employee.isArchived,
      ) &&
      workers.length === participantWorkerIds.length &&
      workers.every(
        (worker) => worker.status === "active" && !worker.isArchived,
      );
    const contractorWorkersInScope =
      participantWorkerIds.length === 0 ||
      Boolean(
        permit.contractorOrganizationId &&
          contractor &&
          workers.length === participantWorkerIds.length &&
          workers.every(
            (worker) =>
              worker.contractorOrganizationId ===
              permit.contractorOrganizationId,
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
      ...employeeDocuments
        .filter(
          (record) =>
            medicalIds.includes(record.id) &&
            record.status === "ACTIVE" &&
            record.verificationStatus === "VERIFIED" &&
            this.validUntil(record, validAt),
        )
        .map((record) =>
          this.snapshotEvidence("EMPLOYEE_MEDICAL_DOCUMENT", record),
        ),
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
    const requiresContractor =
      permit.permitType === "CONTRACTOR_ACCESS" ||
      permit.workType === "CONTRACTOR_SITE_ACCESS";
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
    const checks = [
      {
        code: "ACTIVE_PARTICIPANTS",
        label: "Active permit participants",
        passed:
          activePeople && crewEmployeeIds.length + crewWorkerIds.length > 0,
        evidence: [...participantEmployeeIds, ...participantWorkerIds],
      },
      {
        code: "ACTIVE_WORK_SITE",
        label: "Active work site",
        passed: !permit.workSiteId || Boolean(workSite),
        evidence: permit.workSiteId ? [permit.workSiteId] : [],
      },
      {
        code: "TRAINING",
        label: "Completed training and exams",
        passed:
          crewEmployeeIds.length === 0 ||
          crewEmployeeIds.every((employeeId) =>
            trainings.some(
              (record) =>
                record.employeeId === employeeId &&
                record.status === "COMPLETED" &&
                (!record.trainingProgram.requiresExam ||
                  record.examAttempts.length > 0),
            ),
          ),
        evidence: trainingEvidence.map((item) => item.id),
      },
      {
        code: "BRIEFING",
        label: "Signed briefing",
        passed:
          crewEmployeeIds.length === 0 ||
          crewEmployeeIds.every((employeeId) =>
            briefings.some(
              (record) =>
                record.employeeId === employeeId && record.status === "SIGNED",
            ),
          ),
        evidence: briefingEvidence.map((item) => item.id),
      },
      {
        code: "CERTIFICATES",
        label: "Valid certificates and qualifications",
        passed:
          certificateIds.length > 0 &&
          certificateEvidence.length === certificateIds.length,
        evidence: certificateEvidence.map((item) => item.id),
      },
      {
        code: "MEDICAL_CLEARANCE",
        label: "Valid medical clearance",
        passed:
          medicalIds.length > 0 && medicalEvidence.length === medicalIds.length,
        evidence: medicalEvidence.map((item) => item.id),
      },
      {
        code: "PPE_ISSUED",
        label: "PPE issue registry",
        passed:
          ppeIds.length > 0 &&
          ppeEvidence.length === ppeIds.length &&
          crewEmployeeIds.length + crewWorkerIds.length <= ppeEvidence.length,
        evidence: ppeEvidence.map((item) => item.id),
      },
      {
        code: "REQUIRED_DOCUMENTS",
        label: "Required source documents",
        passed:
          requiredIds.length > 0 &&
          requiredEvidence.length === requiredIds.length,
        evidence: requiredEvidence.map((item) => item.id),
      },
      {
        code: "CONTRACTOR_SCOPE",
        label: "Contractor and representative",
        passed:
          !requiresContractor ||
          Boolean(
            permit.contractorOrganizationId &&
            permit.contractorRepresentativeId &&
            contractor,
          ),
        evidence: [
          permit.contractorOrganizationId,
          permit.contractorRepresentativeId,
        ].filter((value): value is string => Boolean(value)),
      },
      {
        code: "CONTRACTOR_WORKERS",
        label: "Contractor workers match selected contractor",
        passed: contractorWorkersInScope,
        evidence: participantWorkerIds,
      },
      {
        code: "CONTRACTOR_ACCESS_ACT",
        label: "Active contractor access act",
        passed:
          permit.workType !== "CONTRACTOR_SITE_ACCESS" ||
          contractorAccessActCoversPermit,
        evidence: [
          permit.contractorAccessActId,
          contractorAccessAct?.actNumber,
        ].filter((value): value is string => Boolean(value)),
      },
    ].map((check) => ({
      code: check.code,
      label: check.label,
      result: check.passed ? ("PASS" as const) : ("FAIL" as const),
      severity: "BLOCKER" as const,
      message: check.passed
        ? `${check.label}: passed.`
        : `${check.label}: missing, expired, inactive, or tenant-invalid evidence.`,
      evidence: check.evidence,
    }));
    const result = checks.every((check) => check.result === "PASS")
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
      trainingCheckSnapshot: snapshot(trainingEvidence, "TRAINING"),
      briefingCheckSnapshot: snapshot(briefingEvidence, "BRIEFING"),
      certificateCheckSnapshot: snapshot(certificateEvidence, "CERTIFICATES"),
      medicalCheckSnapshot: {
        ...snapshot(medicalEvidence, "MEDICAL_CLEARANCE"),
        containsDiagnosis: false as const,
      },
      ppeIssuedSnapshot: snapshot(ppeEvidence, "PPE_ISSUED"),
      requiredDocumentSnapshot: snapshot(
        requiredEvidence,
        "REQUIRED_DOCUMENTS",
      ),
      contractorAccessActSnapshot: {
        checkedAt: checkedAt.toISOString(),
        result:
          checks.find((check) => check.code === "CONTRACTOR_ACCESS_ACT")
            ?.result ?? ("FAIL" as const),
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
    const nextEntry = {
      ...entry,
      status: result === "PASS" ? "draft" : "missing_documents",
      precheckSummary: {
        result,
        checkedAt: checkedAt.toISOString(),
        failedRules: checks
          .filter((check) => check.result === "FAIL")
          .map((check) => check.code),
      },
      precheckChecks: checks,
      ...snapshots,
      documentVersionHash: undefined,
      signedPayloadHash: undefined,
      updatedAt: checkedAt.toISOString(),
    };
    const payload = this.payloadWithEntry(permit, nextEntry);
    const snapshotHash = canonicalHash({ checks, snapshots });

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
    const summary = objectValue(this.payloadEntry(permit).precheckSummary);
    if (summary.result !== "PASS") {
      throw new BadRequestException(
        "A successful precheck is required before submit.",
      );
    }
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

  async archive(user: AuthenticatedUser, id: string) {
    const permit = await this.findPermit(id);
    await this.assertAccess(user, permit, "archive");
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
        archiveManifestHash:
          permit.signedPayloadHash ?? permit.currentVersion.payloadHash,
        storageUri: null,
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
    return this.get(user, id);
  }

  async evidence(user: AuthenticatedUser, id: string) {
    const permit = await this.findPermit(id);
    await this.assertAccess(user, permit);
    if (!permit.documentEnvelopeId) {
      throw new NotFoundException("Permit evidence package is unavailable.");
    }
    return this.corePlatformService.buildEvidencePackage(
      user,
      permit.documentEnvelopeId,
    );
  }

  async download(user: AuthenticatedUser, id: string) {
    const permit = await this.get(user, id);
    return this.pdfService.renderWorkPermit({
      permitCode: permit.permitCode,
      journalRegistrationNumber: permit.journalRegistrationNumber,
      permitType: permit.permitType,
      workType: permit.workType,
      status: permit.status,
      workDescription: permit.workDescription,
      workplace: permit.workplace,
      effectiveFrom: permit.effectiveFrom,
      effectiveTo: permit.effectiveTo,
      closedAt: permit.closedAt,
      payloadHash: permit.currentVersion?.payloadHash ?? null,
      signedPayloadHash: permit.signedPayloadHash,
      approvals: permit.approvals.map((approval) => ({
        stepNo: approval.stepNo,
        role: approval.role,
        status: approval.status,
        decidedAt: approval.decidedAt,
      })),
      signatures:
        permit.documentEnvelope?.signatures.map((signature) => ({
          signerName: signature.signerName,
          certificateSerial: signature.certificateSerial,
          signedAt: signature.signedAt,
          verification: signature.verification?.result ?? null,
        })) ?? [],
    });
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
