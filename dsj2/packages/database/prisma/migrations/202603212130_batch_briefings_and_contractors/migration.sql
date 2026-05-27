-- CreateEnum
CREATE TYPE "EmployeeKind" AS ENUM ('INTERNAL', 'CONTRACTOR');

-- AlterEnum
ALTER TYPE "ReminderType" ADD VALUE IF NOT EXISTS 'SIGNING_LINK_INVITE';

-- CreateTable
CREATE TABLE "ContractorCompany" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bin" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractorCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BriefingBatch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "participantCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BriefingBatch_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Employee"
ADD COLUMN "contractorCompanyId" TEXT,
ADD COLUMN "employeeKind" "EmployeeKind" NOT NULL DEFAULT 'INTERNAL';

-- AlterTable
ALTER TABLE "BriefingRecord"
ADD COLUMN "briefingBatchId" TEXT,
ADD COLUMN "inviteToken" TEXT,
ADD COLUMN "inviteTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN "inviteSentAt" TIMESTAMP(3),
ADD COLUMN "registrationCompletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "ContractorCompany_companyId_name_key" ON "ContractorCompany"("companyId", "name");

-- CreateIndex
CREATE INDEX "ContractorCompany_companyId_isActive_idx" ON "ContractorCompany"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "BriefingBatch_companyId_batchNumber_key" ON "BriefingBatch"("companyId", "batchNumber");

-- CreateIndex
CREATE INDEX "BriefingBatch_companyId_createdAt_idx" ON "BriefingBatch"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BriefingRecord_inviteToken_key" ON "BriefingRecord"("inviteToken");

-- CreateIndex
CREATE INDEX "BriefingRecord_briefingBatchId_idx" ON "BriefingRecord"("briefingBatchId");

-- AddForeignKey
ALTER TABLE "ContractorCompany" ADD CONSTRAINT "ContractorCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_contractorCompanyId_fkey" FOREIGN KEY ("contractorCompanyId") REFERENCES "ContractorCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefingBatch" ADD CONSTRAINT "BriefingBatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefingRecord" ADD CONSTRAINT "BriefingRecord_briefingBatchId_fkey" FOREIGN KEY ("briefingBatchId") REFERENCES "BriefingBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
