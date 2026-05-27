-- AlterEnum
ALTER TYPE "DocumentKind" ADD VALUE IF NOT EXISTS 'PROTOCOL';

-- CreateEnum
CREATE TYPE "ProtocolStatus" AS ENUM (
  'DRAFT',
  'SIGNING_READY',
  'SIGNED',
  'ANNULLED',
  'SUPERSEDED',
  'EXPIRED'
);

-- CreateEnum
CREATE TYPE "ProtocolCommissionRole" AS ENUM ('CHAIRMAN', 'MEMBER');

-- AlterTable
ALTER TABLE "AdmissionEvaluation"
ADD COLUMN "protocolId" TEXT;

-- CreateTable
CREATE TABLE "Protocol" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "protocolType" TEXT NOT NULL,
  "basis" TEXT NOT NULL,
  "scopeType" "ScopeType" NOT NULL,
  "branchId" TEXT,
  "departmentId" TEXT,
  "workSiteId" TEXT,
  "status" "ProtocolStatus" NOT NULL DEFAULT 'DRAFT',
  "decision" TEXT NOT NULL,
  "notes" TEXT,
  "documentEnvelopeId" TEXT,
  "currentVersionId" TEXT,
  "currentVersionNo" INTEGER,
  "signedAt" TIMESTAMP(3),
  "archiveRecordId" TEXT,
  "retentionPolicyId" TEXT,
  "replacesProtocolId" TEXT,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Protocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolEmployee" (
  "id" TEXT NOT NULL,
  "protocolId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "fullName" TEXT NOT NULL,
  "employeeNumber" TEXT,
  "jobTitle" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProtocolEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolCommissionMember" (
  "id" TEXT NOT NULL,
  "protocolId" TEXT NOT NULL,
  "role" "ProtocolCommissionRole" NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "fullName" TEXT NOT NULL,
  "jobTitle" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProtocolCommissionMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Protocol_organizationId_number_key"
  ON "Protocol"("organizationId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Protocol_documentEnvelopeId_key"
  ON "Protocol"("documentEnvelopeId");

-- CreateIndex
CREATE INDEX "Protocol_organizationId_status_date_idx"
  ON "Protocol"("organizationId", "status", "date");

-- CreateIndex
CREATE INDEX "Protocol_organizationId_departmentId_status_idx"
  ON "Protocol"("organizationId", "departmentId", "status");

-- CreateIndex
CREATE INDEX "Protocol_organizationId_branchId_workSiteId_idx"
  ON "Protocol"("organizationId", "branchId", "workSiteId");

-- CreateIndex
CREATE INDEX "Protocol_replacesProtocolId_idx"
  ON "Protocol"("replacesProtocolId");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolEmployee_protocolId_employeeId_key"
  ON "ProtocolEmployee"("protocolId", "employeeId");

-- CreateIndex
CREATE INDEX "ProtocolEmployee_protocolId_sortOrder_idx"
  ON "ProtocolEmployee"("protocolId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProtocolEmployee_employeeId_protocolId_idx"
  ON "ProtocolEmployee"("employeeId", "protocolId");

-- CreateIndex
CREATE INDEX "ProtocolCommissionMember_protocolId_role_sortOrder_idx"
  ON "ProtocolCommissionMember"("protocolId", "role", "sortOrder");

-- AddForeignKey
ALTER TABLE "AdmissionEvaluation"
ADD CONSTRAINT "AdmissionEvaluation_protocolId_fkey"
FOREIGN KEY ("protocolId") REFERENCES "Protocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protocol"
ADD CONSTRAINT "Protocol_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protocol"
ADD CONSTRAINT "Protocol_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protocol"
ADD CONSTRAINT "Protocol_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protocol"
ADD CONSTRAINT "Protocol_workSiteId_fkey"
FOREIGN KEY ("workSiteId") REFERENCES "WorkSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protocol"
ADD CONSTRAINT "Protocol_documentEnvelopeId_fkey"
FOREIGN KEY ("documentEnvelopeId") REFERENCES "DocumentEnvelope"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protocol"
ADD CONSTRAINT "Protocol_currentVersionId_fkey"
FOREIGN KEY ("currentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protocol"
ADD CONSTRAINT "Protocol_archiveRecordId_fkey"
FOREIGN KEY ("archiveRecordId") REFERENCES "ArchiveRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protocol"
ADD CONSTRAINT "Protocol_retentionPolicyId_fkey"
FOREIGN KEY ("retentionPolicyId") REFERENCES "RetentionPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protocol"
ADD CONSTRAINT "Protocol_replacesProtocolId_fkey"
FOREIGN KEY ("replacesProtocolId") REFERENCES "Protocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protocol"
ADD CONSTRAINT "Protocol_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protocol"
ADD CONSTRAINT "Protocol_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolEmployee"
ADD CONSTRAINT "ProtocolEmployee_protocolId_fkey"
FOREIGN KEY ("protocolId") REFERENCES "Protocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolEmployee"
ADD CONSTRAINT "ProtocolEmployee_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolCommissionMember"
ADD CONSTRAINT "ProtocolCommissionMember_protocolId_fkey"
FOREIGN KEY ("protocolId") REFERENCES "Protocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;
