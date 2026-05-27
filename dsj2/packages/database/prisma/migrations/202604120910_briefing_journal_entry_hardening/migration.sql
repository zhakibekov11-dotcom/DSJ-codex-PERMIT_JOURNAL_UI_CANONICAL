-- Ensure legacy companies have organization rows for the canonical stack.
INSERT INTO "Organization" (
  "id",
  "legacyCompanyId",
  "code",
  "name",
  "bin",
  "timezone",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  c."id",
  c."id",
  CASE
    WHEN c."bin" IS NOT NULL AND c."bin" <> '' THEN CONCAT('BIN-', c."bin")
    ELSE CONCAT('LEGACY-', UPPER(SUBSTRING(c."id" FROM 1 FOR 8)))
  END,
  c."name",
  c."bin",
  c."timezone",
  c."isActive",
  c."createdAt",
  c."updatedAt"
FROM "Company" c
WHERE NOT EXISTS (
  SELECT 1
  FROM "Organization" o
  WHERE o."id" = c."id" OR o."legacyCompanyId" = c."id"
)
ON CONFLICT ("id") DO UPDATE SET
  "legacyCompanyId" = EXCLUDED."legacyCompanyId",
  "code" = EXCLUDED."code",
  "name" = EXCLUDED."name",
  "bin" = EXCLUDED."bin",
  "timezone" = EXCLUDED."timezone",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Harden the canonical briefing journal entry table with legal snapshot fields.
ALTER TABLE "BriefingJournalEntry"
ADD COLUMN IF NOT EXISTS "organizationId" TEXT,
ADD COLUMN IF NOT EXISTS "registrationNo" TEXT,
ADD COLUMN IF NOT EXISTS "journalKind" "BriefingJournalKind",
ADD COLUMN IF NOT EXISTS "departmentId" TEXT,
ADD COLUMN IF NOT EXISTS "workSiteId" TEXT,
ADD COLUMN IF NOT EXISTS "briefingTime" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "program" TEXT,
ADD COLUMN IF NOT EXISTS "basis" TEXT,
ADD COLUMN IF NOT EXISTS "unscheduledReason" TEXT,
ADD COLUMN IF NOT EXISTS "finalSignedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "archiveRecordId" TEXT,
ADD COLUMN IF NOT EXISTS "retentionPolicyId" TEXT,
ADD COLUMN IF NOT EXISTS "replacesEntryId" TEXT,
ADD COLUMN IF NOT EXISTS "annulReason" TEXT,
ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT,
ADD COLUMN IF NOT EXISTS "updatedByUserId" TEXT;

UPDATE "BriefingJournalEntry" e
SET "organizationId" = j."organizationId"
FROM "BriefingJournal" j
WHERE e."journalId" = j."id"
  AND e."organizationId" IS NULL;

UPDATE "BriefingJournalEntry"
SET "journalKind" = CASE
  WHEN "briefingType"::TEXT = 'INTRODUCTORY' THEN 'INTRODUCTORY'::"BriefingJournalKind"
  ELSE 'WORKPLACE'::"BriefingJournalKind"
END
WHERE "journalKind" IS NULL;

UPDATE "BriefingJournalEntry"
SET
  "finalSignedAt" = COALESCE("finalSignedAt", "signedAt"),
  "createdByUserId" = COALESCE("createdByUserId", "instructorUserId"),
  "updatedByUserId" = COALESCE("updatedByUserId", "instructorUserId")
WHERE "finalSignedAt" IS NULL
   OR "createdByUserId" IS NULL
   OR "updatedByUserId" IS NULL;

ALTER TABLE "BriefingJournalEntry"
ALTER COLUMN "organizationId" SET NOT NULL,
ALTER COLUMN "journalKind" SET NOT NULL;

-- Organization-level canonical journals used by the briefing entry lifecycle.
INSERT INTO "BriefingJournal" (
  "id",
  "organizationId",
  "journalCode",
  "title",
  "scopeType",
  "status",
  "createdAt",
  "updatedAt"
)
SELECT
  CONCAT('bj-intro-', SUBSTRING(MD5(o."id") FROM 1 FOR 18)),
  o."id",
  'BRIEFING_INTRODUCTORY',
  'Introductory briefing journal',
  'ORGANIZATION',
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization" o
ON CONFLICT ("organizationId", "journalCode") DO UPDATE SET
  "title" = EXCLUDED."title",
  "status" = 'ACTIVE',
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "BriefingJournal" (
  "id",
  "organizationId",
  "journalCode",
  "title",
  "scopeType",
  "status",
  "createdAt",
  "updatedAt"
)
SELECT
  CONCAT('bj-work-', SUBSTRING(MD5(o."id") FROM 1 FOR 18)),
  o."id",
  'BRIEFING_WORKPLACE',
  'Workplace briefing journal',
  'ORGANIZATION',
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization" o
ON CONFLICT ("organizationId", "journalCode") DO UPDATE SET
  "title" = EXCLUDED."title",
  "status" = 'ACTIVE',
  "updatedAt" = CURRENT_TIMESTAMP;

-- Backfill legacy BriefingRecord rows into the canonical legal-entry table.
WITH legacy_source AS (
  SELECT
    br.*,
    o."id" AS "organizationId",
    CASE
      WHEN br."briefingType"::TEXT = 'INTRODUCTORY' THEN 'INTRODUCTORY'::"BriefingJournalKind"
      ELSE 'WORKPLACE'::"BriefingJournalKind"
    END AS "journalKind",
    CASE
      WHEN br."briefingType"::TEXT = 'INTRODUCTORY' THEN 'BRIEFING_INTRODUCTORY'
      ELSE 'BRIEFING_WORKPLACE'
    END AS "journalCode"
  FROM "BriefingRecord" br
  JOIN "Organization" o
    ON o."id" = br."companyId" OR o."legacyCompanyId" = br."companyId"
),
numbered_source AS (
  SELECT
    ls.*,
    bj."id" AS "journalId",
    ROW_NUMBER() OVER (PARTITION BY bj."id" ORDER BY ls."createdAt", ls."id")
      + COALESCE(
          (
            SELECT MAX(e."entryNo")
            FROM "BriefingJournalEntry" e
            WHERE e."journalId" = bj."id"
          ),
          0
        ) AS "resolvedEntryNo"
  FROM legacy_source ls
  JOIN "BriefingJournal" bj
    ON bj."organizationId" = ls."organizationId"
   AND bj."journalCode" = ls."journalCode"
  WHERE NOT EXISTS (
    SELECT 1
    FROM "BriefingJournalEntry" existing
    WHERE existing."id" = ls."id"
       OR (
         existing."organizationId" = ls."organizationId"
         AND existing."registrationNo" IS NOT DISTINCT FROM ls."documentNumber"
       )
  )
)
INSERT INTO "BriefingJournalEntry" (
  "id",
  "organizationId",
  "journalId",
  "entryNo",
  "registrationNo",
  "journalKind",
  "employeeId",
  "instructorUserId",
  "departmentId",
  "workSiteId",
  "briefingType",
  "status",
  "employeeStatus",
  "briefingDate",
  "briefingTime",
  "topic",
  "program",
  "basis",
  "unscheduledReason",
  "notes",
  "openedAt",
  "acknowledgedAt",
  "signedAt",
  "archivedAt",
  "finalSignedAt",
  "documentHash",
  "documentEnvelopeId",
  "archiveRecordId",
  "retentionPolicyId",
  "replacesEntryId",
  "annulReason",
  "createdByUserId",
  "updatedByUserId",
  "createdAt",
  "updatedAt"
)
SELECT
  ns."id",
  ns."organizationId",
  ns."journalId",
  ns."resolvedEntryNo"::INTEGER,
  ns."documentNumber",
  ns."journalKind",
  ns."employeeId",
  ns."instructorUserId",
  ns."departmentId",
  NULL,
  ns."briefingType",
  CASE
    WHEN ns."status"::TEXT = 'READY_FOR_SIGNING' THEN 'SIGNING_READY'
    WHEN ns."status"::TEXT = 'SIGNED' THEN 'SIGNED'
    WHEN ns."status"::TEXT = 'ARCHIVED' THEN 'ARCHIVED'
    ELSE 'DRAFT'
  END::"BriefingJournalEntryStatus",
  ns."employeeStatus",
  ns."briefingDate",
  NULL,
  ns."topic",
  ns."materialContent",
  NULL,
  NULL,
  ns."notes",
  ns."openedAt",
  ns."acknowledgedAt",
  ns."signedAt",
  ns."archivedAt",
  ns."signedAt",
  ns."documentHash",
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  ns."instructorUserId",
  ns."instructorUserId",
  ns."createdAt",
  ns."updatedAt"
FROM numbered_source ns;

-- Link legacy signatures to the canonical entry when the entry was backfilled from BriefingRecord.
ALTER TABLE "Signature"
ADD COLUMN IF NOT EXISTS "briefingJournalEntryId" TEXT;

UPDATE "Signature" s
SET "briefingJournalEntryId" = s."briefingRecordId"
WHERE s."briefingRecordId" IS NOT NULL
  AND s."briefingJournalEntryId" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "BriefingJournalEntry" e
    WHERE e."id" = s."briefingRecordId"
  );

-- Let admission evaluations point to the exact briefing entry that affected the decision.
ALTER TABLE "AdmissionEvaluation"
ADD COLUMN IF NOT EXISTS "briefingJournalEntryId" TEXT;

-- Registry and lifecycle indexes.
CREATE UNIQUE INDEX IF NOT EXISTS "BriefingJournalEntry_organizationId_registrationNo_key"
  ON "BriefingJournalEntry"("organizationId", "registrationNo");

CREATE INDEX IF NOT EXISTS "BriefingJournalEntry_organizationId_status_briefingDate_idx"
  ON "BriefingJournalEntry"("organizationId", "status", "briefingDate");

CREATE INDEX IF NOT EXISTS "BriefingJournalEntry_organizationId_employeeId_briefingDate_idx"
  ON "BriefingJournalEntry"("organizationId", "employeeId", "briefingDate");

CREATE INDEX IF NOT EXISTS "BriefingJournalEntry_organizationId_instructorUserId_briefingDate_idx"
  ON "BriefingJournalEntry"("organizationId", "instructorUserId", "briefingDate");

CREATE INDEX IF NOT EXISTS "BriefingJournalEntry_organizationId_journalKind_briefingType_briefingDate_idx"
  ON "BriefingJournalEntry"("organizationId", "journalKind", "briefingType", "briefingDate");

CREATE INDEX IF NOT EXISTS "BriefingJournalEntry_organizationId_departmentId_briefingDate_idx"
  ON "BriefingJournalEntry"("organizationId", "departmentId", "briefingDate");

CREATE INDEX IF NOT EXISTS "BriefingJournalEntry_replacesEntryId_idx"
  ON "BriefingJournalEntry"("replacesEntryId");

CREATE INDEX IF NOT EXISTS "Signature_briefingJournalEntryId_idx"
  ON "Signature"("briefingJournalEntryId");

-- Foreign-key constraints for canonical signature/admission linkage.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Signature_briefingJournalEntryId_fkey'
  ) THEN
    ALTER TABLE "Signature"
    ADD CONSTRAINT "Signature_briefingJournalEntryId_fkey"
    FOREIGN KEY ("briefingJournalEntryId") REFERENCES "BriefingJournalEntry"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AdmissionEvaluation_briefingJournalEntryId_fkey'
  ) THEN
    ALTER TABLE "AdmissionEvaluation"
    ADD CONSTRAINT "AdmissionEvaluation_briefingJournalEntryId_fkey"
    FOREIGN KEY ("briefingJournalEntryId") REFERENCES "BriefingJournalEntry"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Baseline 10-year retention for signed electronic briefing journal entries.
INSERT INTO "RetentionPolicy" (
  "id",
  "organizationId",
  "retentionCode",
  "documentKind",
  "scopeType",
  "retentionValue",
  "retentionUnit",
  "archiveFormat",
  "legalBasis",
  "holdAllowed",
  "destructionApprovalRequired",
  "effectiveFrom",
  "effectiveTo",
  "description",
  "createdAt",
  "updatedAt"
)
SELECT
  CONCAT('rp-journal-10y-', SUBSTRING(MD5(o."id") FROM 1 FOR 18)),
  o."id",
  'JOURNAL_10Y',
  'BRIEFING_JOURNAL_ENTRY',
  'ORGANIZATION',
  10,
  'YEARS',
  'PDF_A_1',
  'P1 baseline: electronic briefing journals retained for 10 years.',
  true,
  false,
  CURRENT_TIMESTAMP,
  NULL,
  'Electronic briefing journal entry retention policy.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization" o
WHERE NOT EXISTS (
  SELECT 1
  FROM "RetentionPolicy" rp
  WHERE rp."organizationId" = o."id"
    AND rp."retentionCode" = 'JOURNAL_10Y'
);

-- Instruction document type mapping used by centralized compliance evidence.
WITH instruction_types AS (
  SELECT *
  FROM (VALUES
    ('BRIEFING_INTRODUCTORY', 'Introductory briefing'),
    ('BRIEFING_WORKPLACE_PRIMARY', 'Primary workplace briefing'),
    ('BRIEFING_WORKPLACE_REPEATED', 'Repeated workplace briefing'),
    ('BRIEFING_WORKPLACE_UNSCHEDULED', 'Unscheduled workplace briefing'),
    ('BRIEFING_WORKPLACE_TARGETED', 'Targeted workplace briefing')
  ) AS t("code", "name")
)
INSERT INTO "ComplianceDocumentType" (
  "id",
  "organizationId",
  "code",
  "name",
  "category",
  "description",
  "defaultValidityDays",
  "requiresExpiry",
  "requiresVerification",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  CONCAT('cdt-', LOWER(REPLACE(t."code", '_', '-')), '-', SUBSTRING(MD5(o."id") FROM 1 FOR 10)),
  o."id",
  t."code",
  t."name",
  'INSTRUCTION',
  'System briefing journal evidence type.',
  NULL,
  false,
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization" o
CROSS JOIN instruction_types t
ON CONFLICT ("organizationId", "code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "category" = 'INSTRUCTION',
  "requiresExpiry" = false,
  "requiresVerification" = true,
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;
