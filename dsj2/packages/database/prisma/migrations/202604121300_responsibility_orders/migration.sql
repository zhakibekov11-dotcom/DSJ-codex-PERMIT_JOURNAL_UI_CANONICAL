-- AlterEnum
ALTER TYPE "DocumentKind" ADD VALUE IF NOT EXISTS 'ORDER';

-- CreateEnum
CREATE TYPE "ResponsibilityOrderStatus" AS ENUM (
  'DRAFT',
  'SIGNING_READY',
  'SIGNED',
  'ACTIVE',
  'ANNULLED',
  'SUPERSEDED',
  'EXPIRED'
);

-- CreateEnum
CREATE TYPE "ResponsibilityType" AS ENUM (
  'OCCUPATIONAL_SAFETY_RESPONSIBLE',
  'FIRE_SAFETY_RESPONSIBLE',
  'DEPARTMENT_RESPONSIBLE',
  'OBJECT_RESPONSIBLE',
  'INSTRUCTOR_APPOINTMENT',
  'BRIEFING_AUTHORIZED_PERSON',
  'PERMIT_ISSUER_AUTHORIZED_PERSON',
  'RESPONSIBLE_WORK_MANAGER'
);

-- CreateTable
CREATE TABLE "ResponsibilityOrder" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "responsibilityType" "ResponsibilityType" NOT NULL,
  "title" TEXT NOT NULL,
  "basis" TEXT NOT NULL,
  "notes" TEXT,
  "scopeType" "ScopeType" NOT NULL,
  "branchId" TEXT,
  "departmentId" TEXT,
  "workSiteId" TEXT,
  "status" "ResponsibilityOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "documentEnvelopeId" TEXT,
  "currentVersionId" TEXT,
  "currentVersionNo" INTEGER,
  "signedAt" TIMESTAMP(3),
  "archiveRecordId" TEXT,
  "retentionPolicyId" TEXT,
  "replacesOrderId" TEXT,
  "annulReason" TEXT,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ResponsibilityOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponsibilityAppointment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "responsibilityType" "ResponsibilityType" NOT NULL,
  "scopeType" "ScopeType" NOT NULL,
  "branchId" TEXT,
  "departmentId" TEXT,
  "workSiteId" TEXT,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "zoneOfResponsibility" TEXT,
  "roleNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ResponsibilityAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResponsibilityOrder_organizationId_number_key"
  ON "ResponsibilityOrder"("organizationId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ResponsibilityOrder_documentEnvelopeId_key"
  ON "ResponsibilityOrder"("documentEnvelopeId");

-- CreateIndex
CREATE INDEX "ResponsibilityOrder_organizationId_status_date_idx"
  ON "ResponsibilityOrder"("organizationId", "status", "date");

-- CreateIndex
CREATE INDEX "ResponsibilityOrder_organizationId_responsibilityType_status_idx"
  ON "ResponsibilityOrder"("organizationId", "responsibilityType", "status");

-- CreateIndex
CREATE INDEX "ResponsibilityOrder_organizationId_departmentId_status_idx"
  ON "ResponsibilityOrder"("organizationId", "departmentId", "status");

-- CreateIndex
CREATE INDEX "ResponsibilityOrder_organizationId_branchId_workSiteId_idx"
  ON "ResponsibilityOrder"("organizationId", "branchId", "workSiteId");

-- CreateIndex
CREATE INDEX "ResponsibilityOrder_replacesOrderId_idx"
  ON "ResponsibilityOrder"("replacesOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ResponsibilityAppointment_orderId_employeeId_key"
  ON "ResponsibilityAppointment"("orderId", "employeeId");

-- CreateIndex
CREATE INDEX "ResponsibilityAppointment_organizationId_orderId_idx"
  ON "ResponsibilityAppointment"("organizationId", "orderId");

-- CreateIndex
CREATE INDEX "ResponsibilityAppointment_organizationId_employeeId_effectiveFrom_idx"
  ON "ResponsibilityAppointment"("organizationId", "employeeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "ResponsibilityAppointment_organizationId_responsibilityType_scopeType_branchId_departmentId_workSiteId_effectiveFrom_idx"
  ON "ResponsibilityAppointment"(
    "organizationId",
    "responsibilityType",
    "scopeType",
    "branchId",
    "departmentId",
    "workSiteId",
    "effectiveFrom"
  );

-- AddForeignKey
ALTER TABLE "ResponsibilityOrder"
ADD CONSTRAINT "ResponsibilityOrder_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsibilityOrder"
ADD CONSTRAINT "ResponsibilityOrder_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsibilityOrder"
ADD CONSTRAINT "ResponsibilityOrder_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsibilityOrder"
ADD CONSTRAINT "ResponsibilityOrder_workSiteId_fkey"
FOREIGN KEY ("workSiteId") REFERENCES "WorkSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsibilityOrder"
ADD CONSTRAINT "ResponsibilityOrder_documentEnvelopeId_fkey"
FOREIGN KEY ("documentEnvelopeId") REFERENCES "DocumentEnvelope"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsibilityOrder"
ADD CONSTRAINT "ResponsibilityOrder_currentVersionId_fkey"
FOREIGN KEY ("currentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsibilityOrder"
ADD CONSTRAINT "ResponsibilityOrder_archiveRecordId_fkey"
FOREIGN KEY ("archiveRecordId") REFERENCES "ArchiveRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsibilityOrder"
ADD CONSTRAINT "ResponsibilityOrder_retentionPolicyId_fkey"
FOREIGN KEY ("retentionPolicyId") REFERENCES "RetentionPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsibilityOrder"
ADD CONSTRAINT "ResponsibilityOrder_replacesOrderId_fkey"
FOREIGN KEY ("replacesOrderId") REFERENCES "ResponsibilityOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsibilityOrder"
ADD CONSTRAINT "ResponsibilityOrder_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsibilityOrder"
ADD CONSTRAINT "ResponsibilityOrder_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsibilityAppointment"
ADD CONSTRAINT "ResponsibilityAppointment_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsibilityAppointment"
ADD CONSTRAINT "ResponsibilityAppointment_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "ResponsibilityOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsibilityAppointment"
ADD CONSTRAINT "ResponsibilityAppointment_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsibilityAppointment"
ADD CONSTRAINT "ResponsibilityAppointment_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsibilityAppointment"
ADD CONSTRAINT "ResponsibilityAppointment_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsibilityAppointment"
ADD CONSTRAINT "ResponsibilityAppointment_workSiteId_fkey"
FOREIGN KEY ("workSiteId") REFERENCES "WorkSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
