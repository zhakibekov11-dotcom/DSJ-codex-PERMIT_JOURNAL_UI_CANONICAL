---
name: prisma-migration-safety
description: Safely review or change Prisma schema, migrations, seed data, and generated client behavior in DSJ. Use when editing packages/database/prisma, db scripts, or code that depends on db:generate, db:migrate, or db:deploy.
---

# Prisma Migration Safety

Handle Prisma schema and migration changes without corrupting applied history.

## When to use

Use for:

- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/migrations/*`
- `packages/database/prisma/seed*.ts`
- code that depends on the generated Prisma client

Do not use for unrelated API or UI refactors.

## Inputs

- Schema diff
- Migration intent
- Whether the change is additive, backfilled, or destructive
- The target environment: local dev, test, or deploy

## Procedure

1. Inspect the current schema and migration history.
2. Classify the change before editing: additive, backfill, or destructive.
3. Add a new migration for any applied schema change.
4. Do not rewrite migrations that already landed.
5. Run `pnpm db:generate` after schema edits.
6. Use `pnpm db:migrate` only against a disposable local database.
7. Use `pnpm db:deploy` for deploy paths.
8. Check dependent package builds and typechecks after the client changes.
9. Update seed files only when the schema or bootstrap data truly requires it.

## Required checks

- `pnpm --filter @dsj/database db:generate`
- `pnpm --filter @dsj/database typecheck`
- Dependent app builds/typechecks when the generated client or schema changed

## Outputs

- Migration folder with the new migration
- Regenerated Prisma client
- Seed updates if needed
- A rollback note when the change is not obviously reversible

## Red flags

- Column drops or renames
- Enum renames or relation changes
- `onDelete` changes that alter tenant or record safety
- New uniqueness rules that can break existing data
- Backfills without a rollback plan
- Schema changes that touch encrypted, hashed, or masked values without reviewing `src/security.ts`
