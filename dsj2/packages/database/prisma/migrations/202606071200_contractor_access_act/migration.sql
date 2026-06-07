ALTER TYPE "DocumentKind" ADD VALUE IF NOT EXISTS 'CONTRACTOR_ACCESS_ACT';

DO $$ BEGIN
  CREATE TYPE "ContractorAccessActStatus" AS ENUM (
    'DRAFT', 'ACTIVE', 'CLOSED', 'CANCELLED', 'ARCHIVED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ContractorAccessAct" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "actNumber" TEXT NOT NULL,
  "status" "ContractorAccessActStatus" NOT NULL DEFAULT 'DRAFT',
  "scopeType" "ScopeType" NOT NULL,
  "branchId" TEXT,
  "departmentId" TEXT,
  "workSiteId" TEXT,
  "contractorOrganizationId" TEXT NOT NULL,
  "contractorRepresentativeId" TEXT,
  "hostRepresentativeEmployeeId" TEXT,
  "hostUnitChiefEmployeeId" TEXT,
  "workName" TEXT NOT NULL,
  "workDescription" TEXT,
  "workArea" TEXT NOT NULL,
  "workAreaBoundaries" TEXT,
  "workAreaCoordinates" JSONB,
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validTo" TIMESTAMP(3) NOT NULL,
  "safetyMeasures" JSONB NOT NULL,
  "specialConditions" TEXT,
  "legalBasis" TEXT NOT NULL,
  "legalBasisVersion" TEXT NOT NULL,
  "legalBasisEffectiveDate" TIMESTAMP(3) NOT NULL,
  "documentEnvelopeId" TEXT,
  "currentVersionId" TEXT,
  "signedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "cancellationReason" TEXT,
  "archivedAt" TIMESTAMP(3),
  "archiveRecordId" TEXT,
  "retentionPolicyId" TEXT,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContractorAccessAct_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WorkPermit"
  ADD COLUMN IF NOT EXISTS "contractorAccessActId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "ContractorAccessAct_organizationId_actNumber_key"
  ON "ContractorAccessAct"("organizationId", "actNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "ContractorAccessAct_documentEnvelopeId_key"
  ON "ContractorAccessAct"("documentEnvelopeId");
CREATE INDEX IF NOT EXISTS "ContractorAccessAct_organizationId_status_validFrom_idx"
  ON "ContractorAccessAct"("organizationId", "status", "validFrom");
CREATE INDEX IF NOT EXISTS "ContractorAccessAct_organizationId_contractorOrganizationId_idx"
  ON "ContractorAccessAct"("organizationId", "contractorOrganizationId");
CREATE INDEX IF NOT EXISTS "ContractorAccessAct_organizationId_scopeType_branchId_departmentId_workSiteId_idx"
  ON "ContractorAccessAct"("organizationId", "scopeType", "branchId", "departmentId", "workSiteId");
CREATE INDEX IF NOT EXISTS "WorkPermit_organizationId_contractorAccessActId_idx"
  ON "WorkPermit"("organizationId", "contractorAccessActId");

DO $$ BEGIN
  ALTER TABLE "ContractorAccessAct" ADD CONSTRAINT "ContractorAccessAct_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ContractorAccessAct" ADD CONSTRAINT "ContractorAccessAct_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ContractorAccessAct" ADD CONSTRAINT "ContractorAccessAct_workSiteId_fkey"
    FOREIGN KEY ("workSiteId") REFERENCES "WorkSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ContractorAccessAct" ADD CONSTRAINT "ContractorAccessAct_contractorOrganizationId_fkey"
    FOREIGN KEY ("contractorOrganizationId") REFERENCES "ContractorOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ContractorAccessAct" ADD CONSTRAINT "ContractorAccessAct_contractorRepresentativeId_fkey"
    FOREIGN KEY ("contractorRepresentativeId") REFERENCES "ContractorWorker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ContractorAccessAct" ADD CONSTRAINT "ContractorAccessAct_hostRepresentativeEmployeeId_fkey"
    FOREIGN KEY ("hostRepresentativeEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ContractorAccessAct" ADD CONSTRAINT "ContractorAccessAct_hostUnitChiefEmployeeId_fkey"
    FOREIGN KEY ("hostUnitChiefEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ContractorAccessAct" ADD CONSTRAINT "ContractorAccessAct_documentEnvelopeId_fkey"
    FOREIGN KEY ("documentEnvelopeId") REFERENCES "DocumentEnvelope"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ContractorAccessAct" ADD CONSTRAINT "ContractorAccessAct_currentVersionId_fkey"
    FOREIGN KEY ("currentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ContractorAccessAct" ADD CONSTRAINT "ContractorAccessAct_archiveRecordId_fkey"
    FOREIGN KEY ("archiveRecordId") REFERENCES "ArchiveRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ContractorAccessAct" ADD CONSTRAINT "ContractorAccessAct_retentionPolicyId_fkey"
    FOREIGN KEY ("retentionPolicyId") REFERENCES "RetentionPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "WorkPermit" ADD CONSTRAINT "WorkPermit_contractorAccessActId_fkey"
    FOREIGN KEY ("contractorAccessActId") REFERENCES "ContractorAccessAct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
