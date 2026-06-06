DO $$ BEGIN
  CREATE TYPE "PermitType" AS ENUM (
    'HIGH_RISK_WORK', 'CONTRACTOR_ACCESS', 'SELF_WORK_ADMISSION',
    'AFTER_BRIEFING_ADMISSION', 'AFTER_TRAINING_ADMISSION',
    'MEDICAL_BASED_ADMISSION', 'PPE_BASED_ADMISSION'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PermitWorkType" AS ENUM (
    'GENERAL_HIGH_RISK', 'HEIGHT_WORK', 'HOT_WORK', 'GAS_HAZARDOUS_WORK',
    'ELECTRICAL_WORK', 'EARTH_WORK', 'CONFINED_SPACE', 'LIFTING_WORK',
    'CONTRACTOR_SITE_ACCESS'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "WorkPermitStatus" AS ENUM (
    'DRAFT', 'SUBMITTED', 'MISSING_DOCUMENTS', 'IN_APPROVAL', 'APPROVED',
    'SIGNING_READY', 'SIGNED', 'ACTIVE', 'CLOSED', 'SUSPENDED', 'EXTENDED',
    'REJECTED', 'CANCELLED', 'EXPIRED', 'ANNULLED', 'ARCHIVED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE "WorkPermitStatus" ADD VALUE IF NOT EXISTS 'MISSING_DOCUMENTS';
ALTER TYPE "WorkPermitStatus" ADD VALUE IF NOT EXISTS 'EXTENDED';
ALTER TYPE "WorkPermitStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "WorkPermitStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

DO $$ BEGIN
  CREATE TYPE "WorkPermitVersionStatus" AS ENUM ('DRAFT', 'FINAL', 'SIGNED', 'VOIDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "BrigadeMemberStatus" AS ENUM ('ASSIGNED', 'READY', 'SIGNED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "WorkPermitApprovalRole" AS ENUM (
    'WORK_PRODUCER', 'RESPONSIBLE_MANAGER', 'PERMIT_ISSUER', 'ADMITTER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "WorkPermitApprovalStatus" AS ENUM (
    'PENDING', 'CONFIRMED', 'APPROVED', 'SIGNED', 'ACTIVATED', 'REJECTED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "WorkPermitPrecheckResult" AS ENUM ('PASS', 'FAIL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PpeIssueStatus" AS ENUM ('ACTIVE', 'RETURNED', 'EXPIRED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "WorkPermit" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "permitCode" TEXT NOT NULL,
  "journalRegistrationNumber" TEXT NOT NULL,
  "permitType" "PermitType" NOT NULL,
  "workType" "PermitWorkType" NOT NULL,
  "title" TEXT NOT NULL,
  "workDescription" TEXT NOT NULL,
  "workplace" TEXT NOT NULL,
  "scopeType" "ScopeType" NOT NULL,
  "branchId" TEXT,
  "departmentId" TEXT,
  "workSiteId" TEXT,
  "contractorOrganizationId" TEXT,
  "contractorRepresentativeId" TEXT,
  "issuerEmployeeId" TEXT,
  "responsibleManagerEmployeeId" TEXT,
  "workProducerEmployeeId" TEXT,
  "admitterEmployeeId" TEXT,
  "observerEmployeeId" TEXT,
  "status" "WorkPermitStatus" NOT NULL DEFAULT 'DRAFT',
  "documentEnvelopeId" TEXT,
  "currentVersionId" TEXT,
  "issuedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "signedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "effectiveFrom" TIMESTAMP(3),
  "effectiveTo" TIMESTAMP(3),
  "signedPayloadHash" TEXT,
  "rejectionReason" TEXT,
  "suspensionReason" TEXT,
  "cancellationReason" TEXT,
  "archiveRecordId" TEXT,
  "retentionPolicyId" TEXT,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkPermit_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WorkPermit"
  ADD COLUMN IF NOT EXISTS "journalRegistrationNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "workType" "PermitWorkType",
  ADD COLUMN IF NOT EXISTS "workDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "workplace" TEXT,
  ADD COLUMN IF NOT EXISTS "contractorOrganizationId" TEXT,
  ADD COLUMN IF NOT EXISTS "contractorRepresentativeId" TEXT,
  ADD COLUMN IF NOT EXISTS "issuerEmployeeId" TEXT,
  ADD COLUMN IF NOT EXISTS "responsibleManagerEmployeeId" TEXT,
  ADD COLUMN IF NOT EXISTS "workProducerEmployeeId" TEXT,
  ADD COLUMN IF NOT EXISTS "admitterEmployeeId" TEXT,
  ADD COLUMN IF NOT EXISTS "observerEmployeeId" TEXT,
  ADD COLUMN IF NOT EXISTS "documentEnvelopeId" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "signedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "signedPayloadHash" TEXT,
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "suspensionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT,
  ADD COLUMN IF NOT EXISTS "archiveRecordId" TEXT,
  ADD COLUMN IF NOT EXISTS "retentionPolicyId" TEXT,
  ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedByUserId" TEXT;

DO $$
DECLARE permit_type_name TEXT;
BEGIN
  SELECT udt_name INTO permit_type_name
  FROM information_schema.columns
  WHERE table_schema = current_schema()
    AND table_name = 'WorkPermit'
    AND column_name = 'permitType';

  IF permit_type_name = 'WorkPermitType' THEN
    UPDATE "WorkPermit"
    SET "workType" = CASE "permitType"::TEXT
      WHEN 'HOT_WORK' THEN 'HOT_WORK'::"PermitWorkType"
      WHEN 'CONFINED_SPACE' THEN 'CONFINED_SPACE'::"PermitWorkType"
      WHEN 'ELECTRICAL' THEN 'ELECTRICAL_WORK'::"PermitWorkType"
      WHEN 'LIFTING' THEN 'LIFTING_WORK'::"PermitWorkType"
      ELSE 'GENERAL_HIGH_RISK'::"PermitWorkType"
    END
    WHERE "workType" IS NULL;

    ALTER TABLE "WorkPermit"
      ALTER COLUMN "permitType" TYPE "PermitType"
      USING 'HIGH_RISK_WORK'::"PermitType";
  END IF;
END $$;

UPDATE "WorkPermit"
SET
  "journalRegistrationNumber" = COALESCE("journalRegistrationNumber", "permitCode"),
  "workType" = COALESCE("workType", 'GENERAL_HIGH_RISK'::"PermitWorkType"),
  "workDescription" = COALESCE("workDescription", "title"),
  "workplace" = COALESCE("workplace", "title")
WHERE "journalRegistrationNumber" IS NULL
   OR "workType" IS NULL
   OR "workDescription" IS NULL
   OR "workplace" IS NULL;

ALTER TABLE "WorkPermit"
  ALTER COLUMN "journalRegistrationNumber" SET NOT NULL,
  ALTER COLUMN "workType" SET NOT NULL,
  ALTER COLUMN "workDescription" SET NOT NULL,
  ALTER COLUMN "workplace" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "WorkPermitVersion" (
  "id" TEXT NOT NULL,
  "permitId" TEXT NOT NULL,
  "versionNo" INTEGER NOT NULL,
  "status" "WorkPermitVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "payloadJson" JSONB NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "signedPayloadHash" TEXT,
  "documentEnvelopeId" TEXT,
  "documentVersionId" TEXT,
  "createdByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "signedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkPermitVersion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WorkPermitVersion"
  ADD COLUMN IF NOT EXISTS "payloadHash" TEXT,
  ADD COLUMN IF NOT EXISTS "signedPayloadHash" TEXT,
  ADD COLUMN IF NOT EXISTS "documentVersionId" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "signedAt" TIMESTAMP(3);

UPDATE "WorkPermitVersion"
SET "payloadHash" = COALESCE("payloadHash", MD5("payloadJson"::TEXT))
WHERE "payloadHash" IS NULL;

ALTER TABLE "WorkPermitVersion" ALTER COLUMN "payloadHash" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "Brigade" (
  "id" TEXT NOT NULL,
  "permitId" TEXT NOT NULL,
  "brigadeCode" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "leaderEmployeeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Brigade_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BrigadeMember" (
  "id" TEXT NOT NULL,
  "brigadeId" TEXT NOT NULL,
  "employeeId" TEXT,
  "contractorWorkerId" TEXT,
  "roleCode" TEXT NOT NULL,
  "status" "BrigadeMemberStatus" NOT NULL DEFAULT 'ASSIGNED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BrigadeMember_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BrigadeMember_subject_check"
    CHECK (("employeeId" IS NOT NULL) <> ("contractorWorkerId" IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS "WorkPermitApproval" (
  "id" TEXT NOT NULL,
  "permitId" TEXT NOT NULL,
  "stepNo" INTEGER NOT NULL,
  "role" "WorkPermitApprovalRole" NOT NULL,
  "status" "WorkPermitApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "assignedEmployeeId" TEXT,
  "decidedByUserId" TEXT,
  "comment" TEXT,
  "rejectionReason" TEXT,
  "metadataJson" JSONB,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkPermitApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkPermitPrecheckRun" (
  "id" TEXT NOT NULL,
  "permitId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "result" "WorkPermitPrecheckResult" NOT NULL,
  "checksJson" JSONB NOT NULL,
  "snapshotsJson" JSONB NOT NULL,
  "snapshotHash" TEXT NOT NULL,
  "checkedByUserId" TEXT,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkPermitPrecheckRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkPermitClosure" (
  "id" TEXT NOT NULL,
  "permitId" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  "inspection" TEXT NOT NULL,
  "notes" TEXT,
  "closedByUserId" TEXT,
  "payloadHash" TEXT NOT NULL,
  "closedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkPermitClosure_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PpeIssueRecord" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeId" TEXT,
  "contractorWorkerId" TEXT,
  "itemCode" TEXT NOT NULL,
  "itemName" TEXT NOT NULL,
  "status" "PpeIssueStatus" NOT NULL DEFAULT 'ACTIVE',
  "issuedAt" TIMESTAMP(3) NOT NULL,
  "validUntil" TIMESTAMP(3),
  "sourceDocumentId" TEXT,
  "sourceHash" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PpeIssueRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PpeIssueRecord_subject_check"
    CHECK (("employeeId" IS NOT NULL) <> ("contractorWorkerId" IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkPermit_organizationId_permitCode_key"
  ON "WorkPermit"("organizationId", "permitCode");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkPermit_organizationId_journalRegistrationNumber_key"
  ON "WorkPermit"("organizationId", "journalRegistrationNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkPermit_documentEnvelopeId_key"
  ON "WorkPermit"("documentEnvelopeId");
CREATE INDEX IF NOT EXISTS "WorkPermit_organizationId_status_effectiveFrom_idx"
  ON "WorkPermit"("organizationId", "status", "effectiveFrom");
CREATE INDEX IF NOT EXISTS "WorkPermit_organizationId_permitType_workType_idx"
  ON "WorkPermit"("organizationId", "permitType", "workType");
CREATE INDEX IF NOT EXISTS "WorkPermit_organizationId_contractorOrganizationId_idx"
  ON "WorkPermit"("organizationId", "contractorOrganizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkPermitVersion_permitId_versionNo_key"
  ON "WorkPermitVersion"("permitId", "versionNo");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkPermitVersion_documentVersionId_key"
  ON "WorkPermitVersion"("documentVersionId");
CREATE INDEX IF NOT EXISTS "WorkPermitVersion_permitId_status_idx"
  ON "WorkPermitVersion"("permitId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "Brigade_permitId_brigadeCode_key"
  ON "Brigade"("permitId", "brigadeCode");
CREATE UNIQUE INDEX IF NOT EXISTS "BrigadeMember_brigadeId_employeeId_key"
  ON "BrigadeMember"("brigadeId", "employeeId");
CREATE UNIQUE INDEX IF NOT EXISTS "BrigadeMember_brigadeId_contractorWorkerId_key"
  ON "BrigadeMember"("brigadeId", "contractorWorkerId");
CREATE INDEX IF NOT EXISTS "BrigadeMember_brigadeId_status_idx"
  ON "BrigadeMember"("brigadeId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkPermitApproval_permitId_stepNo_key"
  ON "WorkPermitApproval"("permitId", "stepNo");
CREATE INDEX IF NOT EXISTS "WorkPermitApproval_permitId_status_idx"
  ON "WorkPermitApproval"("permitId", "status");
CREATE INDEX IF NOT EXISTS "WorkPermitApproval_assignedEmployeeId_status_idx"
  ON "WorkPermitApproval"("assignedEmployeeId", "status");
CREATE INDEX IF NOT EXISTS "WorkPermitPrecheckRun_permitId_checkedAt_idx"
  ON "WorkPermitPrecheckRun"("permitId", "checkedAt");
CREATE INDEX IF NOT EXISTS "WorkPermitPrecheckRun_versionId_idx"
  ON "WorkPermitPrecheckRun"("versionId");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkPermitClosure_permitId_key"
  ON "WorkPermitClosure"("permitId");
CREATE INDEX IF NOT EXISTS "PpeIssueRecord_organizationId_employeeId_status_validUntil_idx"
  ON "PpeIssueRecord"("organizationId", "employeeId", "status", "validUntil");
CREATE INDEX IF NOT EXISTS "PpeIssueRecord_organizationId_contractorWorkerId_status_validUntil_idx"
  ON "PpeIssueRecord"("organizationId", "contractorWorkerId", "status", "validUntil");

DO $$ BEGIN
  ALTER TABLE "WorkPermit" ADD CONSTRAINT "WorkPermit_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "WorkPermit" ADD CONSTRAINT "WorkPermit_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "WorkPermit" ADD CONSTRAINT "WorkPermit_workSiteId_fkey"
    FOREIGN KEY ("workSiteId") REFERENCES "WorkSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "WorkPermit" ADD CONSTRAINT "WorkPermit_documentEnvelopeId_fkey"
    FOREIGN KEY ("documentEnvelopeId") REFERENCES "DocumentEnvelope"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "WorkPermit" ADD CONSTRAINT "WorkPermit_currentVersionId_fkey"
    FOREIGN KEY ("currentVersionId") REFERENCES "WorkPermitVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "WorkPermit" ADD CONSTRAINT "WorkPermit_archiveRecordId_fkey"
    FOREIGN KEY ("archiveRecordId") REFERENCES "ArchiveRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "WorkPermit" ADD CONSTRAINT "WorkPermit_retentionPolicyId_fkey"
    FOREIGN KEY ("retentionPolicyId") REFERENCES "RetentionPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "WorkPermitVersion" ADD CONSTRAINT "WorkPermitVersion_permitId_fkey"
    FOREIGN KEY ("permitId") REFERENCES "WorkPermit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "WorkPermitVersion" ADD CONSTRAINT "WorkPermitVersion_documentEnvelopeId_fkey"
    FOREIGN KEY ("documentEnvelopeId") REFERENCES "DocumentEnvelope"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "WorkPermitVersion" ADD CONSTRAINT "WorkPermitVersion_documentVersionId_fkey"
    FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Brigade" ADD CONSTRAINT "Brigade_permitId_fkey"
    FOREIGN KEY ("permitId") REFERENCES "WorkPermit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "BrigadeMember" ADD CONSTRAINT "BrigadeMember_brigadeId_fkey"
    FOREIGN KEY ("brigadeId") REFERENCES "Brigade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "BrigadeMember" ADD CONSTRAINT "BrigadeMember_contractorWorkerId_fkey"
    FOREIGN KEY ("contractorWorkerId") REFERENCES "ContractorWorker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "WorkPermitApproval" ADD CONSTRAINT "WorkPermitApproval_permitId_fkey"
    FOREIGN KEY ("permitId") REFERENCES "WorkPermit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "WorkPermitPrecheckRun" ADD CONSTRAINT "WorkPermitPrecheckRun_permitId_fkey"
    FOREIGN KEY ("permitId") REFERENCES "WorkPermit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "WorkPermitClosure" ADD CONSTRAINT "WorkPermitClosure_permitId_fkey"
    FOREIGN KEY ("permitId") REFERENCES "WorkPermit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PpeIssueRecord" ADD CONSTRAINT "PpeIssueRecord_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
