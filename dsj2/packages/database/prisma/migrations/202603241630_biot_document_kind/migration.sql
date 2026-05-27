CREATE TYPE "BiotDocumentKind" AS ENUM ('WORKER_CARD', 'ITR_CERTIFICATE');

ALTER TABLE "CardGenerationRequest"
ADD COLUMN "biotDocumentKind" "BiotDocumentKind" NOT NULL DEFAULT 'WORKER_CARD';
