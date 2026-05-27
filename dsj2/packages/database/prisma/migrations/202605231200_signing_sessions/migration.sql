ALTER TYPE "SignatureProvider" ADD VALUE IF NOT EXISTS 'MOCK_PROVIDER';
ALTER TYPE "SignatureProvider" ADD VALUE IF NOT EXISTS 'NCALAYER_PROVIDER';
ALTER TYPE "SignatureProvider" ADD VALUE IF NOT EXISTS 'EGOV_MOBILE_QR_PROVIDER';
ALTER TYPE "SignatureProvider" ADD VALUE IF NOT EXISTS 'SMART_BRIDGE_PROVIDER';
ALTER TYPE "SignatureProvider" ADD VALUE IF NOT EXISTS 'DIGITAL_ID_PROVIDER';

CREATE TYPE "SigningSessionStatus" AS ENUM (
  'CREATED',
  'QR_GENERATED',
  'WAITING_FOR_USER',
  'CALLBACK_RECEIVED',
  'SIGNATURE_RECEIVED',
  'VERIFYING',
  'COMPLETED',
  'EXPIRED',
  'FAILED',
  'CANCELLED'
);

CREATE TYPE "SigningDocumentType" AS ENUM (
  'BRIEFING_RECORD',
  'BRIEFING_JOURNAL_ENTRY',
  'EMPLOYEE_DOCUMENT',
  'PROTOCOL',
  'RESPONSIBILITY_ORDER',
  'WORK_PERMIT'
);

CREATE TYPE "SigningCallbackValidationStatus" AS ENUM (
  'RECEIVED',
  'AUTHENTICATED',
  'REJECTED'
);

CREATE TYPE "SigningCallbackProcessingStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'PROCESSED',
  'FAILED',
  'IGNORED'
);

CREATE TYPE "SignatureEvidenceVerificationStatus" AS ENUM (
  'PENDING',
  'PASS',
  'FAIL',
  'INDETERMINATE'
);

ALTER TABLE "Signature" ADD COLUMN "signingSessionId" TEXT;

CREATE TABLE "SigningSession" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "documentType" "SigningDocumentType" NOT NULL,
  "documentId" TEXT NOT NULL,
  "documentEnvelopeId" TEXT,
  "documentVersionId" TEXT,
  "signerUserId" TEXT,
  "signerEmployeeId" TEXT,
  "signerIinMasked" TEXT,
  "signerIinHash" TEXT,
  "provider" "SignatureProvider" NOT NULL,
  "status" "SigningSessionStatus" NOT NULL DEFAULT 'CREATED',
  "providerSessionId" TEXT,
  "documentHash" TEXT NOT NULL,
  "hashAlgorithm" TEXT NOT NULL DEFAULT 'SHA-256',
  "idempotencyKey" TEXT,
  "providerPublicJson" JSONB,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "correlationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SigningSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SigningProviderConfig" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "provider" "SignatureProvider" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "environment" TEXT NOT NULL DEFAULT 'local',
  "publicConfigJson" JSONB,
  "secretRef" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SigningProviderConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SignatureEvidence" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "signingSessionId" TEXT NOT NULL,
  "signatureId" TEXT,
  "documentType" "SigningDocumentType" NOT NULL,
  "documentId" TEXT NOT NULL,
  "documentEnvelopeId" TEXT,
  "documentVersionId" TEXT,
  "provider" "SignatureProvider" NOT NULL,
  "documentHash" TEXT NOT NULL,
  "hashAlgorithm" TEXT NOT NULL DEFAULT 'SHA-256',
  "signatureFormat" TEXT NOT NULL,
  "signaturePayloadLocation" TEXT,
  "signaturePayloadHash" TEXT,
  "certificateSubject" TEXT,
  "certificateIssuer" TEXT,
  "certificateSerial" TEXT,
  "signedAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "verificationStatus" "SignatureEvidenceVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "redactedProviderResponse" JSONB,
  "storageKey" TEXT,
  "correlationId" TEXT NOT NULL,
  "supersedesEvidenceId" TEXT,
  "immutableCreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SignatureEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderCallbackEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "signingSessionId" TEXT,
  "provider" "SignatureProvider" NOT NULL,
  "providerSessionId" TEXT,
  "validationStatus" "SigningCallbackValidationStatus" NOT NULL DEFAULT 'RECEIVED',
  "processingStatus" "SigningCallbackProcessingStatus" NOT NULL DEFAULT 'PENDING',
  "redactedPayloadJson" JSONB,
  "rawPayloadStorageKey" TEXT,
  "error" TEXT,
  "correlationId" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProviderCallbackEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SigningSession_organizationId_idempotencyKey_key" ON "SigningSession"("organizationId", "idempotencyKey");
CREATE INDEX "SigningSession_organizationId_documentType_documentId_idx" ON "SigningSession"("organizationId", "documentType", "documentId");
CREATE INDEX "SigningSession_provider_providerSessionId_idx" ON "SigningSession"("provider", "providerSessionId");
CREATE INDEX "SigningSession_status_expiresAt_idx" ON "SigningSession"("status", "expiresAt");
CREATE INDEX "SigningSession_correlationId_idx" ON "SigningSession"("correlationId");

CREATE UNIQUE INDEX "SigningProviderConfig_organizationId_provider_key" ON "SigningProviderConfig"("organizationId", "provider");
CREATE INDEX "SigningProviderConfig_provider_enabled_idx" ON "SigningProviderConfig"("provider", "enabled");

CREATE INDEX "Signature_signingSessionId_idx" ON "Signature"("signingSessionId");
CREATE INDEX "SignatureEvidence_signingSessionId_idx" ON "SignatureEvidence"("signingSessionId");
CREATE INDEX "SignatureEvidence_signatureId_idx" ON "SignatureEvidence"("signatureId");
CREATE INDEX "SignatureEvidence_organizationId_documentType_documentId_idx" ON "SignatureEvidence"("organizationId", "documentType", "documentId");
CREATE INDEX "SignatureEvidence_correlationId_idx" ON "SignatureEvidence"("correlationId");

CREATE INDEX "ProviderCallbackEvent_provider_providerSessionId_createdAt_idx" ON "ProviderCallbackEvent"("provider", "providerSessionId", "createdAt");
CREATE INDEX "ProviderCallbackEvent_signingSessionId_processingStatus_idx" ON "ProviderCallbackEvent"("signingSessionId", "processingStatus");
CREATE INDEX "ProviderCallbackEvent_correlationId_idx" ON "ProviderCallbackEvent"("correlationId");

ALTER TABLE "Signature"
  ADD CONSTRAINT "Signature_signingSessionId_fkey"
  FOREIGN KEY ("signingSessionId") REFERENCES "SigningSession"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SigningSession"
  ADD CONSTRAINT "SigningSession_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SigningSession_documentEnvelopeId_fkey"
  FOREIGN KEY ("documentEnvelopeId") REFERENCES "DocumentEnvelope"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "SigningSession_documentVersionId_fkey"
  FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "SigningSession_signerUserId_fkey"
  FOREIGN KEY ("signerUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "SigningSession_signerEmployeeId_fkey"
  FOREIGN KEY ("signerEmployeeId") REFERENCES "Employee"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SigningProviderConfig"
  ADD CONSTRAINT "SigningProviderConfig_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SignatureEvidence"
  ADD CONSTRAINT "SignatureEvidence_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SignatureEvidence_signingSessionId_fkey"
  FOREIGN KEY ("signingSessionId") REFERENCES "SigningSession"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SignatureEvidence_signatureId_fkey"
  FOREIGN KEY ("signatureId") REFERENCES "Signature"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "SignatureEvidence_documentEnvelopeId_fkey"
  FOREIGN KEY ("documentEnvelopeId") REFERENCES "DocumentEnvelope"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "SignatureEvidence_documentVersionId_fkey"
  FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "SignatureEvidence_supersedesEvidenceId_fkey"
  FOREIGN KEY ("supersedesEvidenceId") REFERENCES "SignatureEvidence"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProviderCallbackEvent"
  ADD CONSTRAINT "ProviderCallbackEvent_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ProviderCallbackEvent_signingSessionId_fkey"
  FOREIGN KEY ("signingSessionId") REFERENCES "SigningSession"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
