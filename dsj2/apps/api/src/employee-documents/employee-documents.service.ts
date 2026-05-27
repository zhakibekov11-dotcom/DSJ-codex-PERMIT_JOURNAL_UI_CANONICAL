import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { decryptSensitiveValue } from "@dsj/database";
import type {
  AnnulEmployeeDocumentInput,
  CreateEmployeeDocumentInput,
  EmployeeDocumentFilters,
  PrepareEmployeeDocumentForSigningInput,
  ReplaceEmployeeDocumentInput,
  SignEmployeeDocumentInput,
  VerifyEmployeeDocumentInput,
} from "@dsj/types";
import { resolveSigningRuntimeConfig } from "@dsj/types";
import { hashDocumentPayload, legacyDocumentTypeFromComplianceCategory } from "@dsj/utils";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { requireEmployeeScope } from "../common/utils/employee-scope";
import {
  assertCompanyAccess,
  requireCompanyScope,
} from "../common/utils/tenant-scope";
import { CorePlatformService } from "../core-platform/core-platform.service";
import { PrismaService } from "../database/prisma.service";
import { EmployeeComplianceService } from "../employees/employee-compliance.service";
import { PdfService } from "../pdf/pdf.service";
import { MockSigningProvider } from "../signatures/providers/mock-signing.provider";
import { NcalayerSigningProvider } from "../signatures/providers/ncalayer-signing.provider";
import { normalizeIin } from "../signatures/signing.utils";

const employeeDocumentInclude = Prisma.validator<Prisma.EmployeeDocumentInclude>()({
  employee: true,
  trainingAssignment: {
    include: {
      trainingProgram: true,
    },
  },
  safetyCertificate: true,
  documentTypeDefinition: true,
  verifiedByUser: true,
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
      _count: {
        select: {
          signatures: true,
        },
      },
    },
  },
});

type RawEmployeeDocument = Prisma.EmployeeDocumentGetPayload<{
  include: typeof employeeDocumentInclude;
}>;

type RequestContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class EmployeeDocumentsService {
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

  private isMockPayload(input: SignEmployeeDocumentInput | undefined): input is Exclude<
    SignEmployeeDocumentInput,
    { cms: string }
  > {
    return Boolean(input && typeof input === "object" && !("cms" in input));
  }

  private isNcalayerPayload(input: SignEmployeeDocumentInput | undefined): input is Extract<
    NonNullable<SignEmployeeDocumentInput>,
    { cms: string }
  > {
    return Boolean(input && typeof input === "object" && "cms" in input);
  }

  private assertSignerMatchesEmployee(expectedIinEncrypted: string, signerIin: string) {
    const expected = normalizeIin(decryptSensitiveValue(expectedIinEncrypted));
    const actual = normalizeIin(signerIin);

    if (expected !== actual) {
      throw new BadRequestException("Signer IIN does not match the employee record.");
    }
  }

  private getEffectiveStatus(document: {
    status: RawEmployeeDocument["status"];
    expiryDate: Date | null;
  }) {
    if (document.status === "DRAFT") {
      return "DRAFT" as const;
    }

    if (document.expiryDate) {
      const now = Date.now();
      const expiryTime = document.expiryDate.getTime();
      const thirtyDaysAhead = now + 1000 * 60 * 60 * 24 * 30;

      if (expiryTime < now) {
        return "EXPIRED" as const;
      }

      if (expiryTime <= thirtyDaysAhead) {
        return "EXPIRING" as const;
      }
    }

    return "ACTIVE" as const;
  }

  private toCanonicalStatus(document: RawEmployeeDocument) {
    const envelope = document.documentEnvelope;

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

  private isImmutableSigned(document: RawEmployeeDocument) {
    return (
      document.documentEnvelope?.status === "SIGNED" ||
      document.documentEnvelope?.currentVersion?.status === "SIGNED"
    );
  }

  private isTerminalCanonicalState(document: RawEmployeeDocument) {
    return (
      document.documentEnvelope?.status === "ANNULLED" ||
      document.documentEnvelope?.status === "SUPERSEDED" ||
      document.documentEnvelope?.status === "ARCHIVED"
    );
  }

  private shouldCountForAdmission(document: RawEmployeeDocument) {
    return !this.isTerminalCanonicalState(document);
  }

  private hasEvidenceTrail(document: {
    documentEnvelope?: {
      signatures?: Array<unknown>;
      archiveRecords?: Array<unknown>;
    } | null;
  }) {
    return Boolean(
      document.documentEnvelope &&
        ((document.documentEnvelope.signatures?.length ?? 0) > 0 ||
          (document.documentEnvelope.archiveRecords?.length ?? 0) > 0),
    );
  }

  private buildAllowedActions(document: RawEmployeeDocument) {
    const envelope = document.documentEnvelope;
    const currentVersion = envelope?.currentVersion;
    const isSigned = this.isImmutableSigned(document);
    const isTerminal = this.isTerminalCanonicalState(document);
    const isReadyForSigning =
      envelope?.status === "SIGNING_READY" && currentVersion?.status === "FINAL";

    return {
      canPrepareSign: Boolean(!isSigned && !isTerminal),
      canSign: Boolean(isReadyForSigning),
      canAnnul: Boolean(envelope && (isSigned || isReadyForSigning) && !isTerminal),
      canReplace: Boolean(isSigned && !isTerminal),
      canDownloadEvidence: this.hasEvidenceTrail(document),
    };
  }

  private retentionSource(retentionPolicy: {
    retentionCode: string;
    legalBasis: string;
  } | null) {
    if (!retentionPolicy) {
      return "configured" as const;
    }

    return retentionPolicy.retentionCode === "EMPLOYEE_DOCUMENT_5Y" ||
      retentionPolicy.legalBasis.startsWith("P0 baseline:")
      ? "baseline" as const
      : "configured" as const;
  }

  private buildCanonicalPayload(document: {
    employeeId: string;
    documentNumber: string | null;
    title: string;
    issuerName: string;
    issueDate: Date;
    expiryDate: Date | null;
    documentType: RawEmployeeDocument["documentType"];
    documentTypeDefinitionId: string | null;
    fileName: string | null;
    fileUrl: string | null;
  }, extra?: Prisma.JsonObject) {
    return {
      employeeId: document.employeeId,
      documentNumber: document.documentNumber,
      title: document.title,
      issuerName: document.issuerName,
      issueDate: document.issueDate.toISOString(),
      expiryDate: document.expiryDate?.toISOString() ?? null,
      documentType: document.documentType,
      documentTypeDefinitionId: document.documentTypeDefinitionId,
      fileName: document.fileName,
      fileUrl: document.fileUrl,
      ...(extra ?? {}),
    } as Prisma.JsonObject;
  }

  private mapDocument(document: RawEmployeeDocument) {
    const status = this.getEffectiveStatus(document);
    const latestSignature = document.documentEnvelope?.signatures[0] ?? null;
    const latestArchiveRecord = document.documentEnvelope?.archiveRecords[0] ?? null;
    const evidenceAvailable = this.hasEvidenceTrail(document);

    return {
      id: document.id,
      companyId: document.companyId,
      employeeId: document.employeeId,
      trainingAssignmentId: document.trainingAssignmentId,
      documentTypeDefinitionId: document.documentTypeDefinitionId,
      documentEnvelopeId: document.documentEnvelopeId,
      title: document.title,
      documentNumber: document.documentNumber,
      documentType: document.documentType,
      issueDate: document.issueDate,
      expiryDate: document.expiryDate,
      status,
      issuerName: document.issuerName,
      verificationStatus: document.verificationStatus,
      verifiedAt: document.verifiedAt,
      verificationNotes: document.verificationNotes,
      fileName: document.fileName,
      fileUrl: document.fileUrl,
      canonicalStatus: this.toCanonicalStatus(document),
      documentEnvelopeStatus: document.documentEnvelope?.status ?? null,
      documentVersionId: document.documentEnvelope?.currentVersionId ?? null,
      documentVersionStatus: document.documentEnvelope?.currentVersion?.status ?? null,
      currentVersionNo: document.documentEnvelope?.currentVersion?.versionNo ?? null,
      signingDigest: document.documentEnvelope?.currentVersion?.renderedHash ?? null,
      isSigned: this.isImmutableSigned(document),
      signedAt: this.toIsoString(document.documentEnvelope?.currentVersion?.signedAt ?? null),
      annulledAt: this.toIsoString(document.documentEnvelope?.currentVersion?.annulledAt ?? null),
      evidenceAvailable,
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
      allowedActions: this.buildAllowedActions(document),
      documentTypeDefinition: document.documentTypeDefinition
        ? {
            id: document.documentTypeDefinition.id,
            code: document.documentTypeDefinition.code,
            name: document.documentTypeDefinition.name,
            category: document.documentTypeDefinition.category,
            requiresExpiry: document.documentTypeDefinition.requiresExpiry,
            requiresVerification: document.documentTypeDefinition.requiresVerification,
          }
        : null,
      verifiedByUser: document.verifiedByUser
        ? {
            id: document.verifiedByUser.id,
            fullName: document.verifiedByUser.fullName,
          }
        : null,
      employee: {
        id: document.employee.id,
        fullName: document.employee.fullName,
        employeeNumber: document.employee.employeeNumber,
        jobTitle: document.employee.jobTitle,
      },
      trainingAssignment: document.trainingAssignment
        ? {
            id: document.trainingAssignment.id,
            trainingProgram: {
              id: document.trainingAssignment.trainingProgram.id,
              title: document.trainingAssignment.trainingProgram.title,
            },
          }
        : null,
      linkedSafetyCertificate: document.safetyCertificate
        ? {
            id: document.safetyCertificate.id,
            certificateNumber: document.safetyCertificate.certificateNumber,
          }
        : null,
    };
  }

  private async findRawById(id: string) {
    const document = await this.prisma.employeeDocument.findUnique({
      where: { id },
      include: employeeDocumentInclude,
    });

    if (!document) {
      throw new NotFoundException("Employee document not found.");
    }

    return document;
  }

  private async ensureEmployee(companyId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        companyId,
      },
    });

    if (!employee) {
      throw new NotFoundException("Employee not found.");
    }

    return employee;
  }

  private async ensureDocumentTypeDefinition(
    companyId: string,
    documentTypeDefinitionId?: string | null,
  ) {
    if (!documentTypeDefinitionId) {
      return null;
    }

    const documentTypeDefinition = await this.prisma.complianceDocumentType.findFirst({
      where: {
        id: documentTypeDefinitionId,
        organizationId: companyId,
      },
    });

    if (!documentTypeDefinition) {
      throw new NotFoundException("Compliance document type is not available in this organization.");
    }

    return documentTypeDefinition;
  }

  private async ensureOrganizationRecord(companyId: string) {
    const existing = await this.prisma.organization.findUnique({
      where: { id: companyId },
    });

    if (existing) {
      return existing;
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException("Organization not found.");
    }

    return this.prisma.organization.create({
      data: {
        id: company.id,
        legacyCompanyId: company.id,
        code: company.bin ? `BIN-${company.bin}` : `LEGACY-${company.id.slice(0, 8).toUpperCase()}`,
        name: company.name,
        bin: company.bin,
        timezone: company.timezone,
        isActive: company.isActive,
      },
    });
  }

  private async ensureAccess(user: AuthenticatedUser, document: RawEmployeeDocument) {
    if (user.role === "EMPLOYEE_SIGNER") {
      const employee = await requireEmployeeScope(this.prisma, user);

      if (employee.id !== document.employeeId) {
        throw new NotFoundException("Employee document not found.");
      }

      return;
    }

    assertCompanyAccess(user, document.companyId);
  }

  private async ensureCanonicalEnvelope(document: RawEmployeeDocument, user: AuthenticatedUser) {
    if (document.documentEnvelope) {
      return document.documentEnvelope;
    }

    const employee = await this.ensureEmployee(document.companyId, document.employeeId);
    const canonicalDocumentNumber =
      document.documentNumber ??
      `ED-${employee.employeeNumber}-${document.id.slice(-6).toUpperCase()}`;

    const envelope = await this.prisma.$transaction(async (transaction) => {
      const createdEnvelope = await transaction.documentEnvelope.create({
        data: {
          organizationId: document.companyId,
          documentKind: "EMPLOYEE_DOCUMENT",
          scopeType: employee.departmentId ? "DEPARTMENT" : "ORGANIZATION",
          departmentId: employee.departmentId ?? null,
          businessObjectType: "EmployeeDocument",
          businessObjectId: document.id,
          documentNumber: canonicalDocumentNumber,
          title: document.title,
          status: "DRAFT",
          createdByUserId: user.userId,
        },
      });

      const version = await transaction.documentVersion.create({
        data: {
          envelopeId: createdEnvelope.id,
          versionNo: 1,
          status: "DRAFT",
          payloadJson: this.buildCanonicalPayload({
            employeeId: document.employeeId,
            documentNumber: canonicalDocumentNumber,
            title: document.title,
            issuerName: document.issuerName,
            issueDate: document.issueDate,
            expiryDate: document.expiryDate,
            documentType: document.documentType,
            documentTypeDefinitionId: document.documentTypeDefinitionId,
            fileName: document.fileName,
            fileUrl: document.fileUrl,
          }),
          createdByUserId: user.userId,
        },
      });

      await transaction.documentEnvelope.update({
        where: { id: createdEnvelope.id },
        data: {
          currentVersionId: version.id,
        },
      });

      await transaction.employeeDocument.update({
        where: { id: document.id },
        data: {
          documentNumber: canonicalDocumentNumber,
          documentEnvelopeId: createdEnvelope.id,
        },
      });

      return createdEnvelope;
    });

    return envelope;
  }

  private async synchronizeEnvelopeMetadata(document: RawEmployeeDocument) {
    if (!document.documentEnvelopeId) {
      return;
    }

    const updates: Prisma.DocumentEnvelopeUpdateInput = {};

    if (document.documentEnvelope?.title !== document.title) {
      updates.title = document.title;
    }

    if (
      document.documentNumber &&
      document.documentEnvelope?.documentNumber !== document.documentNumber
    ) {
      updates.documentNumber = document.documentNumber;
    }

    if (Object.keys(updates).length === 0) {
      return;
    }

    await this.prisma.documentEnvelope.update({
      where: { id: document.documentEnvelopeId },
      data: updates,
    });
  }

  private resolveMockFallback(document: RawEmployeeDocument) {
    return {
      signerName: document.employee.fullName,
      signerIin: normalizeIin(decryptSensitiveValue(document.employee.iinEncrypted)),
      certificateSerial: `MOCKCERT-EMPDOC-${document.id.slice(-6).toUpperCase()}`,
    };
  }

  private async ensureCertificateMetadata(
    organizationId: string,
    input: Extract<NonNullable<SignEmployeeDocumentInput>, { cms: string }>,
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
    input: SignEmployeeDocumentInput | undefined,
    payload: Prisma.InputJsonValue,
  ) {
    if (this.isNcalayerPayload(input)) {
      return hashDocumentPayload(input.cms);
    }

    return hashDocumentPayload(JSON.stringify(payload));
  }

  private resolveSigningResult(
    document: RawEmployeeDocument,
    input: SignEmployeeDocumentInput | undefined,
  ) {
    const config = this.requireSigningRuntimeConfig();
    const documentHash = document.documentEnvelope?.currentVersion?.renderedHash ?? null;

    if (!documentHash) {
      throw new BadRequestException("Document digest is missing. Prepare the document for signing first.");
    }

    if (config.provider === "NCALAYER") {
      if (!this.isNcalayerPayload(input)) {
        throw new BadRequestException("NCALayer signing requires a bridge payload.");
      }

      const result = this.ncalayerSigningProvider.sign({
        entityId: document.id,
        entityType: "EMPLOYEE_DOCUMENT",
        documentHash,
        ...input,
      });

      this.assertSignerMatchesEmployee(document.employee.iinEncrypted, result.signerIin);
      return result;
    }

    const mockInput =
      input && this.isMockPayload(input) ? input : this.resolveMockFallback(document);
    const result = this.mockSigningProvider.sign({
      entityId: document.id,
      entityType: "EMPLOYEE_DOCUMENT",
      documentHash,
      ...mockInput,
    });

    this.assertSignerMatchesEmployee(document.employee.iinEncrypted, result.signerIin);
    return result;
  }

  private async createDocumentRecord(args: {
    user: AuthenticatedUser;
    companyId: string;
    employeeId: string;
    documentTypeDefinitionId?: string | null;
    title: string;
    documentNumber?: string | null;
    documentType: CreateEmployeeDocumentInput["documentType"];
    issueDate: string;
    expiryDate?: string | null;
    issuerName: string;
    status: CreateEmployeeDocumentInput["status"];
    fileName?: string | null;
    fileUrl?: string | null;
    replacementOf?: RawEmployeeDocument | null;
    replacementReason?: string | null;
  }) {
    const [employee, documentTypeDefinition] = await Promise.all([
      this.ensureEmployee(args.companyId, args.employeeId),
      this.ensureDocumentTypeDefinition(args.companyId, args.documentTypeDefinitionId ?? null),
    ]);
    await this.ensureOrganizationRecord(args.companyId);

    const issueDate = new Date(args.issueDate);
    const expiryDate = args.expiryDate
      ? new Date(args.expiryDate)
      : documentTypeDefinition?.defaultValidityDays
        ? new Date(
            issueDate.getTime() + documentTypeDefinition.defaultValidityDays * 24 * 60 * 60 * 1000,
          )
        : null;

    if (documentTypeDefinition?.requiresExpiry && !expiryDate) {
      throw new BadRequestException("The selected compliance document type requires an expiry date.");
    }

    const legacyDocumentType = documentTypeDefinition
      ? legacyDocumentTypeFromComplianceCategory(documentTypeDefinition.category)
      : args.documentType;

    const createdDocument = await this.prisma.$transaction(async (transaction) => {
      const document = await transaction.employeeDocument.create({
        data: {
          companyId: args.companyId,
          employeeId: args.employeeId,
          title: args.title,
          documentNumber: args.documentNumber ?? null,
          documentTypeDefinitionId: documentTypeDefinition?.id ?? null,
          documentType: legacyDocumentType,
          issueDate,
          expiryDate,
          issuerName: args.issuerName,
          status: args.status,
          verificationStatus: "PENDING",
          fileName: args.fileName ?? null,
          fileUrl: args.fileUrl ?? null,
        },
      });

      const canonicalDocumentNumber =
        document.documentNumber ??
        `ED-${employee.employeeNumber}-${document.id.slice(-6).toUpperCase()}`;

      const envelope = await transaction.documentEnvelope.create({
        data: {
          organizationId: args.companyId,
          documentKind: "EMPLOYEE_DOCUMENT",
          scopeType: employee.departmentId ? "DEPARTMENT" : "ORGANIZATION",
          departmentId: employee.departmentId ?? null,
          businessObjectType: "EmployeeDocument",
          businessObjectId: document.id,
          documentNumber: canonicalDocumentNumber,
          title: document.title,
          status: "DRAFT",
          createdByUserId: args.user.userId,
        },
      });

      const version = await transaction.documentVersion.create({
        data: {
          envelopeId: envelope.id,
          versionNo: 1,
          status: "DRAFT",
          payloadJson: this.buildCanonicalPayload(
            {
              employeeId: document.employeeId,
              documentNumber: canonicalDocumentNumber,
              title: document.title,
              issuerName: document.issuerName,
              issueDate: document.issueDate,
              expiryDate: document.expiryDate,
              documentType: document.documentType,
              documentTypeDefinitionId: document.documentTypeDefinitionId,
              fileName: document.fileName,
              fileUrl: document.fileUrl,
            },
            args.replacementOf
              ? {
                  replacementOfDocumentId: args.replacementOf.id,
                  replacementOfEnvelopeId: args.replacementOf.documentEnvelopeId,
                  replacementReason: args.replacementReason ?? null,
                }
              : undefined,
          ),
          createdByUserId: args.user.userId,
        },
      });

      await transaction.documentEnvelope.update({
        where: { id: envelope.id },
        data: {
          currentVersionId: version.id,
        },
      });

      await transaction.employeeDocument.update({
        where: { id: document.id },
        data: {
          documentNumber: canonicalDocumentNumber,
          documentEnvelopeId: envelope.id,
        },
      });

      if (args.replacementOf?.documentEnvelopeId) {
        await transaction.documentEnvelope.update({
          where: { id: args.replacementOf.documentEnvelopeId },
          data: {
            status: "SUPERSEDED",
          },
        });
      }

      return document.id;
    });

    await this.auditService.log({
      actorUserId: args.user.userId,
      companyId: args.companyId,
      action: args.replacementOf ? "document.replaced" : "document.created",
      entityType: "EmployeeDocument",
      entityId: createdDocument,
      metadata: {
        employeeId: args.employeeId,
        documentTypeDefinitionId: documentTypeDefinition?.id ?? null,
        replacementOfDocumentId: args.replacementOf?.id ?? null,
        replacementReason: args.replacementReason ?? null,
      },
    });

    if (args.replacementOf) {
      await this.auditService.log({
        actorUserId: args.user.userId,
        companyId: args.companyId,
        action: "document.superseded",
        entityType: "EmployeeDocument",
        entityId: args.replacementOf.id,
        metadata: {
          replacedByDocumentId: createdDocument,
          replacementReason: args.replacementReason ?? null,
        },
      });
    }

    await this.employeeComplianceService.recalculate(args.user, args.employeeId);

    return this.findOne(args.user, createdDocument);
  }

  async list(user: AuthenticatedUser, filters: EmployeeDocumentFilters = {}) {
    const companyId = requireCompanyScope(user, filters.companyId ?? null);
    const documents = await this.prisma.employeeDocument.findMany({
      where: {
        companyId,
        employeeId: filters.employeeId ?? undefined,
        status: filters.status ?? undefined,
        documentType: filters.documentType ?? undefined,
        OR: filters.search
          ? [
              {
                title: {
                  contains: filters.search,
                },
              },
              {
                documentNumber: {
                  contains: filters.search,
                },
              },
              {
                employee: {
                  is: {
                    fullName: {
                      contains: filters.search,
                    },
                  },
                },
              },
            ]
          : undefined,
      },
      include: employeeDocumentInclude,
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
    });

    return documents.map((document) => this.mapDocument(document));
  }

  async listMy(user: AuthenticatedUser) {
    const employee = await requireEmployeeScope(this.prisma, user);
    const documents = await this.prisma.employeeDocument.findMany({
      where: {
        employeeId: employee.id,
      },
      include: employeeDocumentInclude,
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
    });

    return documents.map((document) => this.mapDocument(document));
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const document = await this.findRawById(id);
    await this.ensureAccess(user, document);
    return this.mapDocument(document);
  }

  async create(user: AuthenticatedUser, input: CreateEmployeeDocumentInput) {
    const companyId = requireCompanyScope(user, input.companyId ?? null);

    return this.createDocumentRecord({
      user,
      companyId,
      employeeId: input.employeeId,
      documentTypeDefinitionId: input.documentTypeDefinitionId ?? null,
      title: input.title,
      documentNumber: input.documentNumber ?? null,
      documentType: input.documentType,
      issueDate: input.issueDate,
      expiryDate: input.expiryDate ?? null,
      issuerName: input.issuerName,
      status: input.status,
      fileName: input.fileName ?? null,
      fileUrl: input.fileUrl ?? null,
      replacementOf: null,
      replacementReason: null,
    });
  }

  async prepareForSigning(
    user: AuthenticatedUser,
    id: string,
    _input: PrepareEmployeeDocumentForSigningInput = {},
  ) {
    const existing = await this.findRawById(id);
    assertCompanyAccess(user, existing.companyId);

    if (this.isImmutableSigned(existing)) {
      throw new BadRequestException(
        "Signed employee documents are immutable. Use replace or annul instead of editing the signed revision.",
      );
    }

    if (this.isTerminalCanonicalState(existing)) {
      throw new BadRequestException("Terminal employee documents cannot be prepared for signing.");
    }

    await this.ensureOrganizationRecord(existing.companyId);
    await this.ensureCanonicalEnvelope(existing, user);

    const withEnvelope = await this.findRawById(id);
    await this.synchronizeEnvelopeMetadata(withEnvelope);

    const document = await this.findRawById(id);
    const envelope = document.documentEnvelope;

    if (!envelope) {
      throw new BadRequestException("Canonical document envelope is not available.");
    }

    const payloadJson = this.buildCanonicalPayload({
      employeeId: document.employeeId,
      documentNumber: envelope.documentNumber,
      title: document.title,
      issuerName: document.issuerName,
      issueDate: document.issueDate,
      expiryDate: document.expiryDate,
      documentType: document.documentType,
      documentTypeDefinitionId: document.documentTypeDefinitionId,
      fileName: document.fileName,
      fileUrl: document.fileUrl,
    });
    const renderedHash = hashDocumentPayload(JSON.stringify(payloadJson));
    const currentVersion = envelope.currentVersion;

    if (
      !(
        envelope.status === "SIGNING_READY" &&
        currentVersion?.status === "FINAL" &&
        currentVersion.renderedHash === renderedHash
      )
    ) {
      await this.corePlatformService.createDocumentVersion(user, {
        envelopeId: envelope.id,
        payloadJson,
        renderedHash,
        changeReason: "Prepared employee document for signing.",
        status: "FINAL",
      });

      await this.auditService.log({
        actorUserId: user.userId,
        companyId: document.companyId,
        action: "document.ready_for_signing",
        entityType: "EmployeeDocument",
        entityId: document.id,
        metadata: {
          envelopeId: envelope.id,
        },
      });
    }

    const preparedDocument = await this.findOne(user, id);
    const signingConfig = this.getSigningRuntimeConfig();

    if (!preparedDocument.signingDigest) {
      throw new BadRequestException("Signing digest is not available after preparation.");
    }

    if (!preparedDocument.documentEnvelopeId || !preparedDocument.documentVersionId) {
      throw new BadRequestException("Canonical envelope identifiers are not available after preparation.");
    }

    if (!preparedDocument.currentVersionNo) {
      throw new BadRequestException("Canonical version number is not available after preparation.");
    }

    return {
      document: preparedDocument,
      envelopeId: preparedDocument.documentEnvelopeId,
      versionId: preparedDocument.documentVersionId,
      versionNo: preparedDocument.currentVersionNo,
      digest: preparedDocument.signingDigest,
      allowedActions: preparedDocument.allowedActions,
      contract: {
        mode: "SELF_SERVICE" as const,
        requiresExternalSignature: true,
        documentHash: preparedDocument.signingDigest,
        provider: signingConfig.isConfigured ? signingConfig.provider : null,
        signRole: "EMPLOYEE_SIGNER" as const,
        bridgeContext: {
          employeeDocumentId: preparedDocument.id,
          documentNumber: preparedDocument.documentNumber ?? null,
        },
      },
    };
  }

  async sign(
    user: AuthenticatedUser,
    id: string,
    input?: SignEmployeeDocumentInput,
    context?: RequestContext,
  ) {
    const document = await this.findRawById(id);
    await this.ensureAccess(user, document);

    if (user.role !== "EMPLOYEE_SIGNER") {
      throw new BadRequestException("Employee document signing is only available in self-service.");
    }

    const envelope = document.documentEnvelope;
    const currentVersion = envelope?.currentVersion;

    if (!envelope || !currentVersion) {
      throw new BadRequestException("Employee document is not prepared in the canonical document flow.");
    }

    if (!this.buildAllowedActions(document).canSign) {
      throw new BadRequestException("Employee document must be prepared for signing first.");
    }

    const signingResult = this.resolveSigningResult(document, input);
    const certificateMetadata = this.isNcalayerPayload(input)
      ? await this.ensureCertificateMetadata(document.companyId, input)
      : null;
    const signaturePayload = {
      subjectType: "EMPLOYEE_DOCUMENT",
      subjectId: document.id,
      source: "EMPLOYEE_SELF_SERVICE",
      signingContext: {
        employeeDocumentId: document.id,
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
      companyId: document.companyId,
      organizationId: document.companyId,
      briefingRecordId: null,
      signerUserId: user.userId,
      signerEmployeeId: document.employeeId,
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

    if (document.status === "DRAFT") {
      await this.prisma.employeeDocument.update({
        where: { id: document.id },
        data: {
          status: "ACTIVE",
        },
      });
    }

    const resolvedRetention = await this.corePlatformService.ensureRetentionPolicyResolved(user, {
      organizationId: document.companyId,
      documentKind: "EMPLOYEE_DOCUMENT",
      scopeType: envelope.scopeType,
      effectiveAt: signingResult.signedAt.toISOString(),
    });

    if (!resolvedRetention) {
      throw new BadRequestException("Retention policy could not be resolved for the employee document.");
    }

    const archiveRecord = await this.corePlatformService.createArchiveRecord(user, {
      organizationId: document.companyId,
      envelopeId: envelope.id,
      versionId: currentVersion.id,
      retentionPolicyId: resolvedRetention.policy.id,
      status: "SEALED",
      sealedAt: signingResult.signedAt.toISOString(),
      archiveManifestHash: signature.signatureHash ?? signature.documentHash,
      storageUri: document.fileUrl ?? null,
    });

    const evidencePackage = await this.corePlatformService.buildEvidencePackage(user, envelope.id);

    await this.prisma.signatureVerification.update({
      where: { signatureId: signature.id },
      data: {
        checkedAt: new Date(),
        evidenceJson: {
          subjectType: "EMPLOYEE_DOCUMENT",
          subjectId: document.id,
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

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: document.companyId,
      action: "document.signed",
      entityType: "EmployeeDocument",
      entityId: document.id,
      metadata: {
        envelopeId: envelope.id,
        signatureId: signature.id,
        archiveRecordId: archiveRecord.id,
        archiveRetentionCode: resolvedRetention.policy.retentionCode,
        archiveRetentionSource: resolvedRetention.source,
        evidenceSignatureCount: evidencePackage.signatures.length,
        evidenceArchiveRecordCount: evidencePackage.archiveRecords.length,
      },
    });

    await this.employeeComplianceService.recalculate(user, document.employeeId);

    return this.findOne(user, id);
  }

  async annul(user: AuthenticatedUser, id: string, input: AnnulEmployeeDocumentInput) {
    const document = await this.findRawById(id);
    assertCompanyAccess(user, document.companyId);

    const envelope = document.documentEnvelope;
    const currentVersion = envelope?.currentVersion;

    if (!envelope || !currentVersion) {
      throw new BadRequestException("Canonical employee document revision is not available.");
    }

    if (!this.buildAllowedActions(document).canAnnul) {
      throw new BadRequestException("Only prepared or signed employee documents can be annulled.");
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
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: document.companyId,
      action: "document.annulled",
      entityType: "EmployeeDocument",
      entityId: document.id,
      metadata: {
        envelopeId: envelope.id,
        reason: input.reason ?? null,
      },
    });

    await this.employeeComplianceService.recalculate(user, document.employeeId);

    return this.findOne(user, id);
  }

  async replace(user: AuthenticatedUser, id: string, input: ReplaceEmployeeDocumentInput) {
    const sourceDocument = await this.findRawById(id);
    assertCompanyAccess(user, sourceDocument.companyId);

    if (!sourceDocument.documentEnvelopeId) {
      throw new BadRequestException("Signed employee document must be linked to a canonical envelope.");
    }

    if (!this.buildAllowedActions(sourceDocument).canReplace) {
      throw new BadRequestException("Only signed employee documents can be replaced.");
    }

    return this.createDocumentRecord({
      user,
      companyId: sourceDocument.companyId,
      employeeId: sourceDocument.employeeId,
      documentTypeDefinitionId:
        input.documentTypeDefinitionId ?? sourceDocument.documentTypeDefinitionId ?? null,
      title: input.title,
      documentNumber: input.documentNumber ?? null,
      documentType: input.documentType,
      issueDate: input.issueDate,
      expiryDate: input.expiryDate ?? null,
      issuerName: input.issuerName,
      status: input.status,
      fileName: input.fileName ?? null,
      fileUrl: input.fileUrl ?? null,
      replacementOf: sourceDocument,
      replacementReason: input.reason ?? null,
    });
  }

  async verify(
    user: AuthenticatedUser,
    id: string,
    input: VerifyEmployeeDocumentInput,
  ) {
    const document = await this.findRawById(id);
    assertCompanyAccess(user, document.companyId);

    await this.prisma.employeeDocument.update({
      where: { id: document.id },
      data: {
        verificationStatus: input.verificationStatus,
        verificationNotes: input.verificationNotes ?? null,
        verifiedAt: input.verificationStatus === "PENDING" ? null : new Date(),
        verifiedByUserId: input.verificationStatus === "PENDING" ? null : user.userId,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: document.companyId,
      action: "document.verified",
      entityType: "EmployeeDocument",
      entityId: document.id,
      metadata: {
        verificationStatus: input.verificationStatus,
      },
    });

    await this.employeeComplianceService.recalculate(user, document.employeeId);

    return this.findOne(user, id);
  }

  async download(user: AuthenticatedUser, id: string) {
    const document = await this.findRawById(id);
    await this.ensureAccess(user, document);

    return this.pdfService.renderEmployeeDocument({
      title: document.title,
      documentType: document.documentType,
      issueDate: document.issueDate,
      expiryDate: document.expiryDate,
      status: this.shouldCountForAdmission(document) ? this.getEffectiveStatus(document) : "DRAFT",
      issuerName: document.issuerName,
      employee: {
        fullName: document.employee.fullName,
        employeeNumber: document.employee.employeeNumber,
        jobTitle: document.employee.jobTitle,
      },
      trainingTitle: document.trainingAssignment?.trainingProgram.title ?? null,
    });
  }
}
