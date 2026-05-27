CREATE TYPE "ComplianceDocumentTypeCategory" AS ENUM (
  'DOCUMENT',
  'TRAINING',
  'INSTRUCTION'
);

CREATE TYPE "EmployeeDocumentVerificationStatus" AS ENUM (
  'PENDING',
  'VERIFIED',
  'REJECTED'
);

CREATE TABLE "ComplianceDocumentType" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" "ComplianceDocumentTypeCategory" NOT NULL,
  "description" TEXT,
  "defaultValidityDays" INTEGER,
  "requiresExpiry" BOOLEAN NOT NULL DEFAULT true,
  "requiresVerification" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceDocumentType_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Employee"
ADD COLUMN "positionId" TEXT;

ALTER TABLE "EmployeeDocument"
ADD COLUMN "documentNumber" TEXT,
ADD COLUMN "documentTypeDefinitionId" TEXT,
ADD COLUMN "documentEnvelopeId" TEXT,
ADD COLUMN "verificationStatus" "EmployeeDocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "verifiedAt" TIMESTAMP(3),
ADD COLUMN "verifiedByUserId" TEXT,
ADD COLUMN "verificationNotes" TEXT;

CREATE UNIQUE INDEX "ComplianceDocumentType_organizationId_code_key"
  ON "ComplianceDocumentType"("organizationId", "code");

CREATE INDEX "ComplianceDocumentType_organizationId_category_isActive_idx"
  ON "ComplianceDocumentType"("organizationId", "category", "isActive");

CREATE INDEX "Employee_positionId_idx"
  ON "Employee"("positionId");

CREATE UNIQUE INDEX "EmployeeDocument_documentEnvelopeId_key"
  ON "EmployeeDocument"("documentEnvelopeId");

CREATE INDEX "EmployeeDocument_companyId_documentTypeDefinitionId_idx"
  ON "EmployeeDocument"("companyId", "documentTypeDefinitionId");

CREATE INDEX "EmployeeDocument_companyId_verificationStatus_expiryDate_idx"
  ON "EmployeeDocument"("companyId", "verificationStatus", "expiryDate");

ALTER TABLE "ComplianceDocumentType"
ADD CONSTRAINT "ComplianceDocumentType_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Employee"
ADD CONSTRAINT "Employee_positionId_fkey"
FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmployeeDocument"
ADD CONSTRAINT "EmployeeDocument_documentTypeDefinitionId_fkey"
FOREIGN KEY ("documentTypeDefinitionId") REFERENCES "ComplianceDocumentType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmployeeDocument"
ADD CONSTRAINT "EmployeeDocument_documentEnvelopeId_fkey"
FOREIGN KEY ("documentEnvelopeId") REFERENCES "DocumentEnvelope"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmployeeDocument"
ADD CONSTRAINT "EmployeeDocument_verifiedByUserId_fkey"
FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
