-- Add hashed public invite lookup while retaining the legacy plaintext column
-- for a staged backfill and rollback-safe rollout.
ALTER TABLE "BriefingRecord"
ADD COLUMN "inviteTokenHash" TEXT;

CREATE UNIQUE INDEX "BriefingRecord_inviteTokenHash_key"
ON "BriefingRecord"("inviteTokenHash");
