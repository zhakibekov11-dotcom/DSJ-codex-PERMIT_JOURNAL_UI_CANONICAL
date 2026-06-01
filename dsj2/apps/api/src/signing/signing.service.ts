import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import type {
  CancelSigningSessionInput,
  CreateSigningSessionInput,
  EgovMobileQrCallbackInput,
  MockSignInput,
  NcalayerBridgeSignature,
  SigningDocumentType,
} from "@dsj/types";
import { hashSensitiveValue, maskIin } from "@dsj/database";
import { hashDocumentPayload } from "@dsj/utils";
import { AuditService } from "../audit/audit.service";
import { assertOrganizationAccess } from "../common/utils/tenant-scope";
import { parseBoolean } from "../common/utils/security-preflight";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { CorePlatformService } from "../core-platform/core-platform.service";
import { PrismaService } from "../database/prisma.service";
import { ProtocolsService } from "../protocols/protocols.service";
import { ResponsibilityOrdersService } from "../responsibility-orders/responsibility-orders.service";
import { EmployeeDocumentsService } from "../employee-documents/employee-documents.service";
import { SigningProviderRegistry } from "./signing-provider.registry";
import type {
  CompleteSigningSessionInput,
  ResolvedSigningTarget,
  SigningRequestContext,
} from "./signing.types";

const TERMINAL_SESSION_STATUSES = new Set([
  "COMPLETED",
  "EXPIRED",
  "FAILED",
  "CANCELLED",
]);

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function jsonObject(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function signatureFormatForProvider(provider: CompleteSigningSessionInput["provider"]) {
  switch (provider) {
    case "NCALAYER_PROVIDER":
      return "CMS";
    case "EGOV_MOBILE_QR_PROVIDER":
      return "EGOV_MOBILE_QR_CALLBACK_JSON";
    case "MOCK_PROVIDER":
      return "MOCK_JSON";
  }
}

@Injectable()
export class SigningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly corePlatformService: CorePlatformService,
    private readonly providerRegistry: SigningProviderRegistry,
    private readonly protocolsService: ProtocolsService,
    private readonly responsibilityOrdersService: ResponsibilityOrdersService,
    private readonly employeeDocumentsService: EmployeeDocumentsService,
  ) {}

  private terminal(status: string) {
    return TERMINAL_SESSION_STATUSES.has(status);
  }

  private getTtlSeconds() {
    return parsePositiveInt(
      this.configService.get<string>("SIGNING_SESSION_TTL_SECONDS"),
      300,
    );
  }

  private async findProtocolTarget(
    user: AuthenticatedUser,
    documentId: string,
  ): Promise<ResolvedSigningTarget> {
    const protocol = await this.prisma.protocol.findUnique({
      where: { id: documentId },
      include: {
        documentEnvelope: {
          include: {
            currentVersion: true,
          },
        },
      },
    });

    if (!protocol) {
      throw new NotFoundException("Protocol not found.");
    }

    assertOrganizationAccess(user, protocol.organizationId);

    const envelope = protocol.documentEnvelope;
    const currentVersion = envelope?.currentVersion;
    const documentHash = currentVersion?.renderedHash ?? null;

    if (!envelope || !currentVersion || !documentHash) {
      throw new BadRequestException("Protocol must be prepared for signing first.");
    }

    return {
      documentType: "PROTOCOL",
      documentId: protocol.id,
      organizationId: protocol.organizationId,
      envelopeId: envelope.id,
      versionId: currentVersion.id,
      documentHash,
      title: `Protocol ${protocol.number}`,
      documentNumber: protocol.number,
      isReadyForSigning:
        protocol.status === "SIGNING_READY" &&
        envelope.status === "SIGNING_READY" &&
        currentVersion.status === "FINAL",
    };
  }

  private async findResponsibilityOrderTarget(
    user: AuthenticatedUser,
    documentId: string,
  ): Promise<ResolvedSigningTarget> {
    const order = await this.prisma.responsibilityOrder.findUnique({
      where: { id: documentId },
      include: {
        documentEnvelope: {
          include: {
            currentVersion: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException("Responsibility order not found.");
    }

    assertOrganizationAccess(user, order.organizationId);

    const envelope = order.documentEnvelope;
    const currentVersion = envelope?.currentVersion;
    const documentHash = currentVersion?.renderedHash ?? null;

    if (!envelope || !currentVersion || !documentHash) {
      throw new BadRequestException("Responsibility order must be prepared for signing first.");
    }

    return {
      documentType: "RESPONSIBILITY_ORDER",
      documentId: order.id,
      organizationId: order.organizationId,
      envelopeId: envelope.id,
      versionId: currentVersion.id,
      documentHash,
      title: order.title,
      documentNumber: order.number,
      isReadyForSigning:
        order.status === "SIGNING_READY" &&
        envelope.status === "SIGNING_READY" &&
        currentVersion.status === "FINAL",
    };
  }

  private async findEmployeeDocumentTarget(
    user: AuthenticatedUser,
    documentId: string,
  ): Promise<ResolvedSigningTarget> {
    const document = await this.prisma.employeeDocument.findUnique({
      where: { id: documentId },
      include: {
        documentEnvelope: {
          include: {
            currentVersion: true,
          },
        },
        employee: true,
      },
    });

    if (!document) {
      throw new NotFoundException("Employee document not found.");
    }

    assertOrganizationAccess(user, document.companyId);

    if (user.role === "EMPLOYEE_SIGNER" && document.employee.userId !== user.userId) {
      throw new ForbiddenException("Employee document does not belong to the current signer.");
    }

    const envelope = document.documentEnvelope;
    const currentVersion = envelope?.currentVersion;
    const documentHash = currentVersion?.renderedHash ?? null;

    if (!envelope || !currentVersion || !documentHash) {
      throw new BadRequestException("Employee document must be prepared for signing first.");
    }

    return {
      documentType: "EMPLOYEE_DOCUMENT",
      documentId: document.id,
      organizationId: document.companyId,
      envelopeId: envelope.id,
      versionId: currentVersion.id,
      documentHash,
      title: document.title,
      documentNumber: document.documentNumber,
      isReadyForSigning:
        envelope.status === "SIGNING_READY" && currentVersion.status === "FINAL",
    };
  }

  async resolveTarget(
    user: AuthenticatedUser,
    documentType: SigningDocumentType,
    documentId: string,
  ) {
    switch (documentType) {
      case "PROTOCOL":
        return this.findProtocolTarget(user, documentId);
      case "RESPONSIBILITY_ORDER":
        return this.findResponsibilityOrderTarget(user, documentId);
      case "EMPLOYEE_DOCUMENT":
        return this.findEmployeeDocumentTarget(user, documentId);
      default:
        throw new BadRequestException(
          `${documentType} is not wired into generic signing sessions yet.`,
        );
    }
  }

  async createSession(
    user: AuthenticatedUser,
    input: CreateSigningSessionInput,
    idempotencyKey?: string | null,
  ) {
    const provider = this.providerRegistry.normalizeProvider(input.provider);
    this.providerRegistry.assertProviderEnabled(provider);
    const target = await this.resolveTarget(user, input.documentType, input.documentId);

    if (!target.isReadyForSigning) {
      throw new ConflictException("Document is not ready for signing.");
    }

    if (idempotencyKey) {
      const existing = await this.prisma.signingSession.findUnique({
        where: {
          organizationId_idempotencyKey: {
            organizationId: target.organizationId,
            idempotencyKey,
          },
        },
        include: {
          evidence: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          signatures: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { verification: true },
          },
        },
      });

      if (existing) {
        return this.mapSession(existing);
      }
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.getTtlSeconds() * 1000);
    const id = randomUUID();
    const correlationId = randomUUID();
    const providerSession = this.providerRegistry.createProviderSession({
      provider,
      target,
      sessionId: id,
      correlationId,
      expiresAt,
    });

    const session = await this.prisma.signingSession.create({
      data: {
        id,
        organizationId: target.organizationId,
        documentType: target.documentType,
        documentId: target.documentId,
        documentEnvelopeId: target.envelopeId,
        documentVersionId: target.versionId,
        signerUserId: input.signerUserId ?? user.userId,
        provider,
        status: providerSession.status,
        providerSessionId: providerSession.providerSessionId,
        documentHash: target.documentHash,
        hashAlgorithm: this.configService.get<string>("SIGNATURE_HASH_ALGORITHM") ?? "SHA-256",
        idempotencyKey: idempotencyKey ?? null,
        providerPublicJson: providerSession.providerPublicJson,
        expiresAt,
        correlationId,
      },
      include: {
        evidence: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        signatures: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { verification: true },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        companyId: target.organizationId,
        actorUserId: user.userId,
        action: "signing.session.created",
        entityType: "SigningSession",
        entityId: session.id,
        metadata: {
          provider,
          documentType: target.documentType,
          documentId: target.documentId,
          correlationId,
        },
      },
    });

    return this.mapSession(session);
  }

  async getSession(user: AuthenticatedUser, id: string) {
    const session = await this.prisma.signingSession.findUnique({
      where: { id },
      include: {
        evidence: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        signatures: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { verification: true },
        },
      },
    });

    if (!session) {
      throw new NotFoundException("Signing session not found.");
    }

    assertOrganizationAccess(user, session.organizationId);
    return this.mapSession(session);
  }

  async cancelSession(user: AuthenticatedUser, id: string, input: CancelSigningSessionInput) {
    const session = await this.prisma.signingSession.findUnique({ where: { id } });

    if (!session) {
      throw new NotFoundException("Signing session not found.");
    }

    assertOrganizationAccess(user, session.organizationId);

    if (this.terminal(session.status)) {
      throw new ConflictException("Terminal signing sessions cannot be cancelled.");
    }

    const updated = await this.prisma.signingSession.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        failureReason: input.reason ?? null,
      },
      include: {
        evidence: { orderBy: { createdAt: "desc" }, take: 1 },
        signatures: { orderBy: { createdAt: "desc" }, take: 1, include: { verification: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        companyId: session.organizationId,
        actorUserId: user.userId,
        action: "signing.session.cancelled",
        entityType: "SigningSession",
        entityId: id,
        metadata: {
          reason: input.reason ?? null,
          correlationId: session.correlationId,
        },
      },
    });

    return this.mapSession(updated);
  }

  async submitMock(
    user: AuthenticatedUser,
    id: string,
    payload: MockSignInput,
    context?: SigningRequestContext,
  ) {
    return this.completeSession(user, id, {
      provider: "MOCK_PROVIDER",
      payload,
      context,
    });
  }

  async submitNcalayer(
    user: AuthenticatedUser,
    id: string,
    payload: NcalayerBridgeSignature,
    context?: SigningRequestContext,
  ) {
    return this.completeSession(user, id, {
      provider: "NCALAYER_PROVIDER",
      payload,
      context,
    });
  }

  private async completeSession(
    user: AuthenticatedUser,
    id: string,
    input: CompleteSigningSessionInput,
  ) {
    const session = await this.prisma.signingSession.findUnique({ where: { id } });

    if (!session) {
      throw new NotFoundException("Signing session not found.");
    }

    assertOrganizationAccess(user, session.organizationId);

    if (session.provider !== input.provider) {
      throw new BadRequestException("Signing session provider does not match submit endpoint.");
    }

    if (this.terminal(session.status)) {
      if (session.status === "COMPLETED") {
        return this.getSession(user, id);
      }

      throw new ConflictException("Terminal signing sessions cannot accept signatures.");
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      const expired = await this.prisma.signingSession.update({
        where: { id },
        data: {
          status: "EXPIRED",
          failureReason: "Signing session expired before submit.",
        },
        include: {
          evidence: { orderBy: { createdAt: "desc" }, take: 1 },
          signatures: { orderBy: { createdAt: "desc" }, take: 1, include: { verification: true } },
        },
      });
      return this.mapSession(expired);
    }

    try {
      await this.prisma.signingSession.update({
        where: { id },
        data: { status: "VERIFYING" },
      });

      await this.signDomainDocument(user, session, input);
      const signature = await this.findCompletedSignature(session, user.userId);

      if (!signature) {
        throw new BadRequestException("Signature was not persisted by the domain signing flow.");
      }

      await this.prisma.signature.update({
        where: { id: signature.id },
        data: { signingSessionId: session.id },
      });

      const signerIin =
        "payload" in input && "signerIin" in input.payload ? input.payload.signerIin : null;
      const redactedProviderResponse = this.buildRedactedProviderResponse(input, signature);

      const evidence = await this.prisma.signatureEvidence.create({
        data: {
          organizationId: session.organizationId,
          signingSessionId: session.id,
          signatureId: signature.id,
          documentType: session.documentType,
          documentId: session.documentId,
          documentEnvelopeId: session.documentEnvelopeId,
          documentVersionId: session.documentVersionId,
          provider: session.provider,
          documentHash: session.documentHash,
          hashAlgorithm: session.hashAlgorithm,
          signatureFormat: signatureFormatForProvider(input.provider),
          signaturePayloadLocation: "Signature.payload",
          signaturePayloadHash: signature.signatureHash,
          certificateSubject:
            input.provider === "NCALAYER_PROVIDER" ? input.payload.certificateSubject : null,
          certificateIssuer:
            input.provider === "NCALAYER_PROVIDER" ? input.payload.certificateIssuer : null,
          certificateSerial: signature.certificateSerial,
          signedAt: signature.signedAt,
          verifiedAt: signature.verifiedAt,
          verificationStatus: signature.verification?.result ?? "PASS",
          redactedProviderResponse: redactedProviderResponse as Prisma.InputJsonValue,
          correlationId: session.correlationId,
        },
      });

      await this.prisma.signingSession.update({
        where: { id: session.id },
        data: {
          status: "COMPLETED",
          completedAt: signature.signedAt ?? new Date(),
          signerIinMasked: signerIin ? maskIin(signerIin) : session.signerIinMasked,
          signerIinHash: signerIin ? hashSensitiveValue(signerIin) : session.signerIinHash,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          companyId: session.organizationId,
          actorUserId: user.userId,
          action: "signing.session.completed",
          entityType: "SigningSession",
          entityId: session.id,
          metadata: {
            signatureId: signature.id,
            evidenceId: evidence.id,
            correlationId: session.correlationId,
          },
        },
      });

      return this.getSession(user, id);
    } catch (error) {
      await this.prisma.signingSession.update({
        where: { id },
        data: {
          status: "FAILED",
          failureReason: error instanceof Error ? error.message : "Signing failed.",
        },
      });
      throw error;
    }
  }

  private async signDomainDocument(
    user: AuthenticatedUser,
    session: {
      id: string;
      organizationId: string;
      documentType: SigningDocumentType;
      documentId: string;
      documentEnvelopeId: string | null;
      documentVersionId: string | null;
      documentHash: string;
      correlationId: string;
    },
    input: CompleteSigningSessionInput,
  ) {
    const payload = input.payload;

    switch (session.documentType) {
      case "PROTOCOL":
        if (input.provider === "MOCK_PROVIDER" || input.provider === "EGOV_MOBILE_QR_PROVIDER") {
          await this.signProtocolDirect(user, session, input.provider, payload as MockSignInput, input.context);
          return;
        }

        await this.protocolsService.sign(user, session.documentId, payload, input.context);
        return;
      case "RESPONSIBILITY_ORDER":
        await this.responsibilityOrdersService.sign(
          user,
          session.documentId,
          payload,
          input.context,
        );
        return;
      case "EMPLOYEE_DOCUMENT":
        await this.employeeDocumentsService.sign(user, session.documentId, payload, input.context);
        return;
      default:
        throw new BadRequestException(
          `${session.documentType} submit is not wired into generic signing sessions yet.`,
        );
    }
  }

  private async signProtocolDirect(
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
    provider: "MOCK_PROVIDER" | "EGOV_MOBILE_QR_PROVIDER",
    payload: MockSignInput,
    context?: SigningRequestContext,
  ) {
    const protocol = await this.prisma.protocol.findUnique({
      where: { id: session.documentId },
      include: {
        documentEnvelope: {
          include: {
            currentVersion: true,
          },
        },
      },
    });

    if (!protocol) {
      throw new NotFoundException("Protocol not found.");
    }

    assertOrganizationAccess(user, protocol.organizationId);

    const envelope = protocol.documentEnvelope;
    const currentVersion = envelope?.currentVersion;

    if (
      !envelope ||
      !currentVersion ||
      envelope.id !== session.documentEnvelopeId ||
      currentVersion.id !== session.documentVersionId ||
      currentVersion.renderedHash !== session.documentHash
    ) {
      throw new BadRequestException("Signing session no longer matches the protocol revision.");
    }

    if (
      protocol.status !== "SIGNING_READY" ||
      envelope.status !== "SIGNING_READY" ||
      currentVersion.status !== "FINAL"
    ) {
      throw new ConflictException("Protocol must be prepared for signing first.");
    }

    const signedAt = new Date();
    const signerIinMasked = maskIin(payload.signerIin);
    const providerPayload = {
      provider,
      signerName: payload.signerName,
      signerIinMasked,
      certificateSerial: payload.certificateSerial,
      signedAt: signedAt.toISOString(),
      documentHash: session.documentHash,
      correlationId: session.correlationId,
    } as Prisma.JsonObject;
    const signaturePayload = {
      subjectType: "PROTOCOL",
      subjectId: protocol.id,
      source: "GENERIC_SIGNING_SESSION",
      signingContext: {
        signingSessionId: session.id,
        protocolId: protocol.id,
        documentNumber: envelope.documentNumber,
        versionId: currentVersion.id,
      },
      requestContext: {
        ipAddress: context?.ipAddress ?? null,
        userAgent: context?.userAgent ?? null,
      },
      providerPayload,
    } as Prisma.JsonObject;
    const signatureHash = hashDocumentPayload(JSON.stringify(providerPayload));

    const signature = await this.corePlatformService.createSignature(user, {
      envelopeId: envelope.id,
      versionId: currentVersion.id,
      companyId: protocol.organizationId,
      organizationId: protocol.organizationId,
      briefingRecordId: null,
      signerUserId: user.userId,
      signerEmployeeId: null,
      signerRole: user.role,
      provider,
      signerName: payload.signerName,
      signerIinMasked,
      certificateSerial: payload.certificateSerial,
      certificateMetadataId: null,
      documentHash: session.documentHash,
      signatureHash,
      signedAt: signedAt.toISOString(),
      status: "SIGNED",
      payload: signaturePayload as never,
    });

    const resolvedRetention = await this.corePlatformService.ensureRetentionPolicyResolved(user, {
      organizationId: protocol.organizationId,
      documentKind: "PROTOCOL",
      scopeType: envelope.scopeType,
      effectiveAt: signedAt.toISOString(),
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
      sealedAt: signedAt.toISOString(),
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

    await this.prisma.protocol.update({
      where: { id: protocol.id },
      data: {
        status: "SIGNED",
        signedAt,
        archiveRecordId: archiveRecord.id,
        retentionPolicyId: resolvedRetention.policy.id,
        currentVersionId: currentVersion.id,
        currentVersionNo: currentVersion.versionNo,
        updatedByUserId: user.userId,
      },
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
        signingSessionId: session.id,
        archiveRetentionCode: resolvedRetention.policy.retentionCode,
        archiveRetentionSource: resolvedRetention.source,
        evidenceSignatureCount: evidencePackage.signatures.length,
        evidenceArchiveRecordCount: evidencePackage.archiveRecords.length,
      },
    });
  }

  private async findCompletedSignature(
    session: {
      documentEnvelopeId: string | null;
      documentVersionId: string | null;
      documentHash: string;
    },
    signerUserId: string,
  ) {
    return this.prisma.signature.findFirst({
      where: {
        documentEnvelopeId: session.documentEnvelopeId,
        documentVersionId: session.documentVersionId,
        documentHash: session.documentHash,
        signerUserId,
      },
      orderBy: { createdAt: "desc" },
      include: { verification: true },
    });
  }

  private buildRedactedProviderResponse(
    input: CompleteSigningSessionInput,
    signature: {
      provider: string;
      certificateSerial: string;
      documentHash: string;
      signatureHash: string | null;
    },
  ) {
    if (input.provider === "NCALAYER_PROVIDER") {
      return {
        provider: input.provider,
        bridgeVersion: input.payload.bridgeVersion ?? null,
        bridgeUrl: input.payload.bridgeUrl ?? null,
        signingDigest: input.payload.signingDigest,
        certificateSerial: input.payload.certificateSerial,
        certificateThumbprint: input.payload.certificateThumbprint,
        certificateSubject: input.payload.certificateSubject,
        certificateIssuer: input.payload.certificateIssuer,
        signedAt: input.payload.signedAt,
        cmsStoredIn: "Signature.payload.providerPayload.cms",
      };
    }

    return {
      provider: input.provider,
      persistedSignatureProvider: signature.provider,
      certificateSerial: signature.certificateSerial,
      documentHash: signature.documentHash,
      signatureHash: signature.signatureHash,
    };
  }

  async acceptEgovCallback(input: EgovMobileQrCallbackInput, secret?: string | null) {
    const expectedSecret = this.configService.get<string>("EGOV_MOBILE_QR_CALLBACK_SECRET");
    const hasExpectedSecret = Boolean(expectedSecret?.trim());
    const isProduction = this.configService.get<string>("NODE_ENV") === "production";
    const allowUnsignedLocalSimulation =
      !isProduction &&
      parseBoolean(
        this.configService.get<string>("EGOV_MOBILE_QR_ALLOW_LOCAL_CALLBACK_SIMULATION"),
        false,
      );

    if (!hasExpectedSecret && !allowUnsignedLocalSimulation) {
      const event = await this.prisma.providerCallbackEvent.create({
        data: {
          provider: "EGOV_MOBILE_QR_PROVIDER",
          providerSessionId: input.providerSessionId ?? null,
          validationStatus: "REJECTED",
          processingStatus: "FAILED",
          redactedPayloadJson: this.redactCallbackPayload(input),
          error: "Callback secret is not configured.",
          correlationId: randomUUID(),
        },
      });

      throw new ServiceUnavailableException({
        code: "SIGNING_CALLBACK_SECRET_REQUIRED",
        message: "Callback authentication is not configured.",
        correlationId: event.correlationId,
      });
    }

    if (hasExpectedSecret && secret !== expectedSecret) {
      const event = await this.prisma.providerCallbackEvent.create({
        data: {
          provider: "EGOV_MOBILE_QR_PROVIDER",
          providerSessionId: input.providerSessionId ?? null,
          validationStatus: "REJECTED",
          processingStatus: "FAILED",
          redactedPayloadJson: this.redactCallbackPayload(input),
          error: "Invalid callback secret.",
          correlationId: randomUUID(),
        },
      });

      throw new UnauthorizedException({
        code: "SIGNING_CALLBACK_UNAUTHORIZED",
        message: "Callback authentication failed.",
        correlationId: event.correlationId,
      });
    }

    const session = await this.findSessionForCallback(input);
    const event = await this.prisma.providerCallbackEvent.create({
      data: {
        organizationId: session?.organizationId ?? null,
        signingSessionId: session?.id ?? null,
        provider: "EGOV_MOBILE_QR_PROVIDER",
        providerSessionId: input.providerSessionId ?? null,
        validationStatus: hasExpectedSecret ? "AUTHENTICATED" : "RECEIVED",
        processingStatus: session ? "PENDING" : "IGNORED",
        redactedPayloadJson: this.redactCallbackPayload(input),
        error: session ? null : "No matching signing session.",
        correlationId: session?.correlationId ?? randomUUID(),
      },
    });

    if (
      session &&
      input.status === "SIGNED" &&
      input.signerName &&
      input.signerIin &&
      input.certificateSerial
    ) {
      try {
        const callbackUser = await this.resolveSessionUser(session.signerUserId);
        await this.completeSession(callbackUser, session.id, {
          provider: "EGOV_MOBILE_QR_PROVIDER",
          payload: {
            signerName: input.signerName,
            signerIin: input.signerIin,
            certificateSerial: input.certificateSerial,
          },
        });

        await this.prisma.providerCallbackEvent.update({
          where: { id: event.id },
          data: { processingStatus: "PROCESSED", processedAt: new Date() },
        });
      } catch (error) {
        await this.prisma.providerCallbackEvent.update({
          where: { id: event.id },
          data: {
            processingStatus: "FAILED",
            processedAt: new Date(),
            error: error instanceof Error ? error.message : "Callback reconciliation failed.",
          },
        });
      }
    } else if (session && input.status && input.status !== "SIGNED") {
      await this.prisma.signingSession.update({
        where: { id: session.id },
        data: {
          status:
            input.status === "CANCELLED"
              ? "CANCELLED"
              : input.status === "EXPIRED"
                ? "EXPIRED"
                : "FAILED",
          failureReason: input.errorMessage ?? input.errorCode ?? `eGov callback ${input.status}`,
        },
      });

      await this.prisma.providerCallbackEvent.update({
        where: { id: event.id },
        data: { processingStatus: "PROCESSED", processedAt: new Date() },
      });
    }

    return {
      accepted: true,
      correlationId: event.correlationId,
    };
  }

  private async resolveSessionUser(userId: string | null): Promise<AuthenticatedUser> {
    if (!userId) {
      throw new BadRequestException("Signing session has no signer user.");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new BadRequestException("Signing session signer is not available.");
    }

    return {
      userId: user.id,
      companyId: user.companyId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };
  }

  private async findSessionForCallback(input: EgovMobileQrCallbackInput) {
    if (input.sessionId) {
      return this.prisma.signingSession.findUnique({
        where: { id: input.sessionId },
      });
    }

    if (input.providerSessionId) {
      return this.prisma.signingSession.findFirst({
        where: {
          provider: "EGOV_MOBILE_QR_PROVIDER",
          providerSessionId: input.providerSessionId,
        },
      });
    }

    return null;
  }

  private redactCallbackPayload(input: EgovMobileQrCallbackInput) {
    return {
      providerSessionId: input.providerSessionId ?? null,
      sessionId: input.sessionId ?? null,
      status: input.status ?? null,
      signerName: input.signerName ?? null,
      signerIinMasked: input.signerIin ? maskIin(input.signerIin) : null,
      certificateSerial: input.certificateSerial ?? null,
      signedAt: input.signedAt ?? null,
      hasSignaturePayload: Boolean(input.signaturePayload),
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
    };
  }

  async expireOverdueSessions(limit = 100) {
    const sessions = await this.prisma.signingSession.findMany({
      where: {
        status: {
          in: ["CREATED", "QR_GENERATED", "WAITING_FOR_USER", "CALLBACK_RECEIVED", "VERIFYING"],
        },
        expiresAt: {
          lte: new Date(),
        },
      },
      take: limit,
      orderBy: { expiresAt: "asc" },
    });

    for (const session of sessions) {
      await this.prisma.signingSession.updateMany({
        where: {
          id: session.id,
          status: session.status,
        },
        data: {
          status: "EXPIRED",
          failureReason: "Signing session expired.",
        },
      });
    }

    return sessions.length;
  }

  async listDocumentSignatures(
    user: AuthenticatedUser,
    documentType: SigningDocumentType,
    documentId: string,
  ) {
    const target = await this.resolveTarget(user, documentType, documentId);
    const signatures = await this.prisma.signature.findMany({
      where: {
        documentEnvelopeId: target.envelopeId,
      },
      orderBy: [{ signedAt: "desc" }, { createdAt: "desc" }],
      include: {
        verification: true,
        evidence: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    return {
      documentType,
      documentId,
      signatures: signatures.map((signature) => ({
        id: signature.id,
        provider: signature.provider,
        signerName: signature.signerName,
        signerRole: signature.signerRole,
        certificateSerial: signature.certificateSerial,
        documentHash: signature.documentHash,
        signatureHash: signature.signatureHash,
        signedAt: signature.signedAt?.toISOString() ?? null,
        verifiedAt: signature.verifiedAt?.toISOString() ?? null,
        verificationStatus: signature.verification?.result ?? null,
        evidenceId: signature.evidence[0]?.id ?? null,
      })),
    };
  }

  async getDocumentSigningState(
    user: AuthenticatedUser,
    documentType: SigningDocumentType,
    documentId: string,
  ) {
    const target = await this.resolveTarget(user, documentType, documentId);
    const activeSession = await this.prisma.signingSession.findFirst({
      where: {
        organizationId: target.organizationId,
        documentType,
        documentId,
        status: {
          in: ["CREATED", "QR_GENERATED", "WAITING_FOR_USER", "CALLBACK_RECEIVED", "VERIFYING"],
        },
      },
      orderBy: { createdAt: "desc" },
    });
    const signed = await this.prisma.signature.count({
      where: {
        documentEnvelopeId: target.envelopeId,
        status: {
          in: ["SIGNED", "VERIFIED"],
        },
      },
    });

    return {
      documentType,
      documentId,
      state: signed > 0
        ? "SIGNED"
        : activeSession
          ? "SIGNING_IN_PROGRESS"
          : target.isReadyForSigning
            ? "READY_FOR_SIGNING"
            : "DRAFT",
      documentHash: target.documentHash,
      requiredSigners: [
        {
          userId: user.userId,
          employeeId: null,
          name: user.fullName,
          role: user.role,
          signed: signed > 0,
        },
      ],
    };
  }

  private mapSession(session: {
    id: string;
    provider: string;
    status: string;
    documentType: string;
    documentId: string;
    documentHash: string;
    hashAlgorithm: string;
    providerPublicJson: Prisma.JsonValue | null;
    expiresAt: Date;
    completedAt: Date | null;
    cancelledAt: Date | null;
    failureReason: string | null;
    correlationId: string;
    evidence?: Array<{
      id: string;
      verificationStatus: string;
    }>;
    signatures?: Array<{
      id: string;
      verification?: { result: string } | null;
    }>;
  }) {
    const providerPublic = jsonObject(session.providerPublicJson);
    const evidence = session.evidence?.[0] ?? null;
    const signature = session.signatures?.[0] ?? null;

    return {
      id: session.id,
      provider: session.provider,
      status: session.status,
      documentType: session.documentType,
      documentId: session.documentId,
      documentHash: session.documentHash,
      hashAlgorithm: session.hashAlgorithm,
      expiresAt: session.expiresAt.toISOString(),
      completedAt: session.completedAt?.toISOString() ?? null,
      cancelledAt: session.cancelledAt?.toISOString() ?? null,
      failureReason: session.failureReason,
      qrUrl: typeof providerPublic.qrUrl === "string" ? providerPublic.qrUrl : null,
      deeplink: typeof providerPublic.deeplink === "string" ? providerPublic.deeplink : null,
      pollAfterMs:
        typeof providerPublic.pollAfterMs === "number" ? providerPublic.pollAfterMs : 2000,
      correlationId: session.correlationId,
      verification: {
        status: evidence?.verificationStatus ?? signature?.verification?.result ?? null,
        signatureId: signature?.id ?? null,
        evidenceId: evidence?.id ?? null,
      },
    };
  }
}
