import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "202606061600_work_permit_mvp",
    "migration.sql",
  ),
  "utf8",
);

describe("work permit migration", () => {
  it("creates the complete empty-database surface", () => {
    for (const table of [
      "WorkPermit",
      "WorkPermitVersion",
      "Brigade",
      "BrigadeMember",
      "WorkPermitApproval",
      "WorkPermitPrecheckRun",
      "WorkPermitClosure",
      "PpeIssueRecord",
    ]) {
      assert.match(
        migration,
        new RegExp(`CREATE TABLE IF NOT EXISTS "${table}"`),
      );
    }
  });

  it("contains upgrade guards and legacy type conversion", () => {
    assert.match(
      migration,
      /ADD COLUMN IF NOT EXISTS "journalRegistrationNumber"/,
    );
    assert.match(migration, /permit_type_name = 'WorkPermitType'/);
    assert.match(
      migration,
      /ALTER TYPE "WorkPermitStatus" ADD VALUE IF NOT EXISTS/,
    );
    assert.match(migration, /EXCEPTION WHEN duplicate_object THEN NULL/);
  });
});
