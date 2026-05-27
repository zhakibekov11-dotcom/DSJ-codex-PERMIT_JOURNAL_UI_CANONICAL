ALTER TABLE "CardGenerationRequest"
ADD COLUMN "includeCard" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "includeProtocol" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "includeWitness" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "CardGenerationRequestItem"
ADD COLUMN "fullNameKz" TEXT,
ADD COLUMN "witnessCertificateNumber" TEXT,
ADD COLUMN "witnessRegistrationNumber" TEXT;
