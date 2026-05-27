CREATE TYPE "CompanyDocumentCategory" AS ENUM (
  'LOCAL_ACT',
  'ORDER',
  'INSTRUCTION',
  'JOURNAL',
  'TRAINING_CERTIFICATION'
);

CREATE TYPE "CompanyDocumentStatus" AS ENUM (
  'DRAFT',
  'ACTIVE',
  'ARCHIVED'
);

CREATE TABLE "CompanyDocument" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "category" "CompanyDocumentCategory" NOT NULL,
  "documentName" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "body" TEXT NOT NULL,
  "issueDate" TIMESTAMP(3),
  "status" "CompanyDocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompanyDocument_companyId_category_updatedAt_idx"
  ON "CompanyDocument"("companyId", "category", "updatedAt");

CREATE INDEX "CompanyDocument_companyId_status_updatedAt_idx"
  ON "CompanyDocument"("companyId", "status", "updatedAt");

ALTER TABLE "CompanyDocument"
ADD CONSTRAINT "CompanyDocument_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompanyDocument"
ADD CONSTRAINT "CompanyDocument_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
