-- Create the journal-kind enum used by canonical briefing entries.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BriefingJournalKind') THEN
    CREATE TYPE "BriefingJournalKind" AS ENUM ('INTRODUCTORY', 'WORKPLACE');
  END IF;
END $$;

-- Keep legacy values, add canonical lifecycle states for the legal read model.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BriefingJournalEntryStatus') THEN
    CREATE TYPE "BriefingJournalEntryStatus" AS ENUM (
      'DRAFT',
      'OPENED',
      'ACKNOWLEDGED',
      'SIGNING_READY',
      'PARTIALLY_SIGNED',
      'SIGNED',
      'SUPERSEDED',
      'ANNULLED',
      'ARCHIVED'
    );
  END IF;
END $$;

ALTER TYPE "BriefingJournalEntryStatus" ADD VALUE IF NOT EXISTS 'SIGNING_READY';
ALTER TYPE "BriefingJournalEntryStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_SIGNED';
ALTER TYPE "BriefingJournalEntryStatus" ADD VALUE IF NOT EXISTS 'SUPERSEDED';

-- These enum values belong to the existing canonical document/archive stack.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentKind') THEN
    EXECUTE 'ALTER TYPE "DocumentKind" ADD VALUE IF NOT EXISTS ''BRIEFING_JOURNAL_ENTRY''';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttachmentOwnerType') THEN
    EXECUTE 'ALTER TYPE "AttachmentOwnerType" ADD VALUE IF NOT EXISTS ''BRIEFING_JOURNAL_ENTRY''';
  END IF;
END $$;
