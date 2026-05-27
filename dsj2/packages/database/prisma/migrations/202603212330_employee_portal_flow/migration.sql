-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "EmployeeInstructionStatus" AS ENUM ('ASSIGNED', 'OPENED', 'ACKNOWLEDGED', 'SIGNED', 'OVERDUE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "Employee"
ADD COLUMN "userId" TEXT;

ALTER TABLE "BriefingRecord"
ADD COLUMN "completionDueAt" TIMESTAMP(3),
ADD COLUMN "materialContent" TEXT,
ADD COLUMN "materialFileName" TEXT,
ADD COLUMN "materialFileUrl" TEXT,
ADD COLUMN "employeeStatus" "EmployeeInstructionStatus" NOT NULL DEFAULT 'ASSIGNED',
ADD COLUMN "openedAt" TIMESTAMP(3),
ADD COLUMN "acknowledgedAt" TIMESTAMP(3);

ALTER TABLE "Signature"
ADD COLUMN "ipAddress" TEXT,
ADD COLUMN "userAgent" TEXT;

-- Data backfill
UPDATE "BriefingRecord"
SET
  "employeeStatus" = 'SIGNED',
  "openedAt" = COALESCE("openedAt", "signedAt"),
  "acknowledgedAt" = COALESCE("acknowledgedAt", "signedAt")
WHERE "status" = 'SIGNED';

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Employee_userId_key" ON "Employee"("userId");
CREATE INDEX IF NOT EXISTS "BriefingRecord_companyId_employeeStatus_completionDueAt_idx"
  ON "BriefingRecord"("companyId", "employeeStatus", "completionDueAt");

-- AddForeignKey
ALTER TABLE "Employee"
ADD CONSTRAINT "Employee_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
