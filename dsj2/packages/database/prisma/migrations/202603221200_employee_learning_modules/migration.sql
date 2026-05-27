-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "DocumentType" AS ENUM (
    'CERTIFICATE',
    'PROTOCOL',
    'STATEMENT',
    'COMPLETION_CONFIRMATION',
    'SAFETY_CERTIFICATE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRING', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "SafetyCertificateStatus" AS ENUM ('ACTIVE', 'EXPIRING_SOON', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "TrainingAssignmentStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ExamAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE "EmployeeDocument" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "trainingAssignmentId" TEXT,
  "title" TEXT NOT NULL,
  "documentType" "DocumentType" NOT NULL,
  "issueDate" TIMESTAMP(3) NOT NULL,
  "expiryDate" TIMESTAMP(3),
  "issuerName" TEXT NOT NULL,
  "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "fileName" TEXT,
  "fileUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SafetyCertificate" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "trainingAssignmentId" TEXT,
  "documentId" TEXT,
  "certificateNumber" TEXT NOT NULL,
  "issueDate" TIMESTAMP(3) NOT NULL,
  "expiryDate" TIMESTAMP(3) NOT NULL,
  "issuerName" TEXT NOT NULL,
  "status" "SafetyCertificateStatus" NOT NULL DEFAULT 'ACTIVE',
  "fileName" TEXT,
  "fileUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SafetyCertificate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainingProgram" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "materialContent" TEXT,
  "materialFileName" TEXT,
  "materialFileUrl" TEXT,
  "videoUrl" TEXT,
  "issuerName" TEXT,
  "requiresExam" BOOLEAN NOT NULL DEFAULT false,
  "createsDocument" BOOLEAN NOT NULL DEFAULT false,
  "createsSafetyCertificate" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrainingProgram_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainingAssignment" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "trainingProgramId" TEXT NOT NULL,
  "assignedByUserId" TEXT,
  "dueAt" TIMESTAMP(3),
  "status" "TrainingAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
  "progressPercent" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "examPassedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrainingAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Exam" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "trainingProgramId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "passingScore" INTEGER NOT NULL,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExamQuestion" (
  "id" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExamQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExamOption" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "isCorrect" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExamOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExamAttempt" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "trainingAssignmentId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "status" "ExamAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "score" INTEGER,
  "passed" BOOLEAN,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedAt" TIMESTAMP(3),
  "answers" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExamAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeDocument_companyId_employeeId_issueDate_idx"
  ON "EmployeeDocument"("companyId", "employeeId", "issueDate");
CREATE INDEX "EmployeeDocument_companyId_status_expiryDate_idx"
  ON "EmployeeDocument"("companyId", "status", "expiryDate");

CREATE UNIQUE INDEX "SafetyCertificate_documentId_key" ON "SafetyCertificate"("documentId");
CREATE UNIQUE INDEX "SafetyCertificate_companyId_certificateNumber_key"
  ON "SafetyCertificate"("companyId", "certificateNumber");
CREATE INDEX "SafetyCertificate_companyId_employeeId_expiryDate_idx"
  ON "SafetyCertificate"("companyId", "employeeId", "expiryDate");
CREATE INDEX "SafetyCertificate_companyId_status_expiryDate_idx"
  ON "SafetyCertificate"("companyId", "status", "expiryDate");

CREATE UNIQUE INDEX "TrainingProgram_companyId_title_key" ON "TrainingProgram"("companyId", "title");
CREATE INDEX "TrainingProgram_companyId_isActive_idx" ON "TrainingProgram"("companyId", "isActive");

CREATE UNIQUE INDEX "TrainingAssignment_employeeId_trainingProgramId_key"
  ON "TrainingAssignment"("employeeId", "trainingProgramId");
CREATE INDEX "TrainingAssignment_companyId_status_dueAt_idx"
  ON "TrainingAssignment"("companyId", "status", "dueAt");

CREATE UNIQUE INDEX "Exam_trainingProgramId_key" ON "Exam"("trainingProgramId");
CREATE INDEX "Exam_companyId_isActive_idx" ON "Exam"("companyId", "isActive");

CREATE INDEX "ExamQuestion_examId_sortOrder_idx" ON "ExamQuestion"("examId", "sortOrder");
CREATE INDEX "ExamOption_questionId_sortOrder_idx" ON "ExamOption"("questionId", "sortOrder");
CREATE INDEX "ExamAttempt_companyId_employeeId_startedAt_idx"
  ON "ExamAttempt"("companyId", "employeeId", "startedAt");
CREATE INDEX "ExamAttempt_trainingAssignmentId_createdAt_idx"
  ON "ExamAttempt"("trainingAssignmentId", "createdAt");

-- AddForeignKey
ALTER TABLE "EmployeeDocument"
ADD CONSTRAINT "EmployeeDocument_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeDocument"
ADD CONSTRAINT "EmployeeDocument_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeDocument"
ADD CONSTRAINT "EmployeeDocument_trainingAssignmentId_fkey"
FOREIGN KEY ("trainingAssignmentId") REFERENCES "TrainingAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SafetyCertificate"
ADD CONSTRAINT "SafetyCertificate_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SafetyCertificate"
ADD CONSTRAINT "SafetyCertificate_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SafetyCertificate"
ADD CONSTRAINT "SafetyCertificate_trainingAssignmentId_fkey"
FOREIGN KEY ("trainingAssignmentId") REFERENCES "TrainingAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SafetyCertificate"
ADD CONSTRAINT "SafetyCertificate_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "EmployeeDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TrainingProgram"
ADD CONSTRAINT "TrainingProgram_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainingAssignment"
ADD CONSTRAINT "TrainingAssignment_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainingAssignment"
ADD CONSTRAINT "TrainingAssignment_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainingAssignment"
ADD CONSTRAINT "TrainingAssignment_trainingProgramId_fkey"
FOREIGN KEY ("trainingProgramId") REFERENCES "TrainingProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainingAssignment"
ADD CONSTRAINT "TrainingAssignment_assignedByUserId_fkey"
FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Exam"
ADD CONSTRAINT "Exam_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Exam"
ADD CONSTRAINT "Exam_trainingProgramId_fkey"
FOREIGN KEY ("trainingProgramId") REFERENCES "TrainingProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExamQuestion"
ADD CONSTRAINT "ExamQuestion_examId_fkey"
FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExamOption"
ADD CONSTRAINT "ExamOption_questionId_fkey"
FOREIGN KEY ("questionId") REFERENCES "ExamQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExamAttempt"
ADD CONSTRAINT "ExamAttempt_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExamAttempt"
ADD CONSTRAINT "ExamAttempt_examId_fkey"
FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExamAttempt"
ADD CONSTRAINT "ExamAttempt_trainingAssignmentId_fkey"
FOREIGN KEY ("trainingAssignmentId") REFERENCES "TrainingAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExamAttempt"
ADD CONSTRAINT "ExamAttempt_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
