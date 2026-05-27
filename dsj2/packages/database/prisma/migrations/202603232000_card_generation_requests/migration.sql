-- CreateEnum
CREATE TYPE "CardRequestMode" AS ENUM ('EMPLOYEE', 'REQUEST');

-- CreateEnum
CREATE TYPE "CardRequestType" AS ENUM ('BIOT', 'PTM', 'PB', 'PS');

-- CreateTable
CREATE TABLE "CardGenerationRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "certificateType" "CardRequestType" NOT NULL,
    "requestMode" "CardRequestMode" NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "seriesNumber" TEXT NOT NULL,
    "trainingSubject" TEXT NOT NULL,
    "requestCompanyRu" TEXT,
    "requestCompanyKz" TEXT,
    "itemsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardGenerationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardGenerationRequestItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "employeeId" TEXT,
    "trainingAssignmentId" TEXT,
    "fullName" TEXT NOT NULL,
    "issuedTo" TEXT,
    "positionRu" TEXT,
    "positionKz" TEXT,
    "workplaceRu" TEXT,
    "workplaceKz" TEXT,
    "certificateNumber" TEXT NOT NULL,
    "protocolNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardGenerationRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardGenerationRequest_companyId_createdAt_idx" ON "CardGenerationRequest"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "CardGenerationRequest_companyId_certificateType_issueDate_idx" ON "CardGenerationRequest"("companyId", "certificateType", "issueDate");

-- CreateIndex
CREATE INDEX "CardGenerationRequestItem_requestId_createdAt_idx" ON "CardGenerationRequestItem"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "CardGenerationRequestItem_employeeId_idx" ON "CardGenerationRequestItem"("employeeId");

-- CreateIndex
CREATE INDEX "CardGenerationRequestItem_trainingAssignmentId_idx" ON "CardGenerationRequestItem"("trainingAssignmentId");

-- AddForeignKey
ALTER TABLE "CardGenerationRequest" ADD CONSTRAINT "CardGenerationRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardGenerationRequest" ADD CONSTRAINT "CardGenerationRequest_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardGenerationRequestItem" ADD CONSTRAINT "CardGenerationRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CardGenerationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardGenerationRequestItem" ADD CONSTRAINT "CardGenerationRequestItem_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardGenerationRequestItem" ADD CONSTRAINT "CardGenerationRequestItem_trainingAssignmentId_fkey" FOREIGN KEY ("trainingAssignmentId") REFERENCES "TrainingAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
