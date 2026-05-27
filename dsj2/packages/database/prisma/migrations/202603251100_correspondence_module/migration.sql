-- CreateEnum
CREATE TYPE "CorrespondenceKind" AS ENUM ('LETTER', 'COMMERCIAL_PROPOSAL');

-- CreateEnum
CREATE TYPE "CorrespondenceStatus" AS ENUM ('DRAFT', 'READY_TO_SEND', 'PARTIALLY_SENT', 'SENT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CorrespondenceRecipientStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "Correspondence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "registryNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "CorrespondenceKind" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "CorrespondenceStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Correspondence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrespondenceRecipient" (
    "id" TEXT NOT NULL,
    "correspondenceId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactPosition" TEXT,
    "status" "CorrespondenceRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CorrespondenceRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Correspondence_companyId_registryNumber_key" ON "Correspondence"("companyId", "registryNumber");

-- CreateIndex
CREATE INDEX "Correspondence_companyId_kind_createdAt_idx" ON "Correspondence"("companyId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "Correspondence_companyId_status_updatedAt_idx" ON "Correspondence"("companyId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "CorrespondenceRecipient_correspondenceId_createdAt_idx" ON "CorrespondenceRecipient"("correspondenceId", "createdAt");

-- CreateIndex
CREATE INDEX "CorrespondenceRecipient_status_sentAt_idx" ON "CorrespondenceRecipient"("status", "sentAt");

-- AddForeignKey
ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrespondenceRecipient" ADD CONSTRAINT "CorrespondenceRecipient_correspondenceId_fkey" FOREIGN KEY ("correspondenceId") REFERENCES "Correspondence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
