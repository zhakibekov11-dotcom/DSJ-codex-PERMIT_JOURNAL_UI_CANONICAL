# Database Area Rules

Use this after `.mempalace/index.json` when a task touches `packages/database`.

Read first:

- the relevant `.mempalace/features/*.json` card when the task names a feature
- `packages/database/prisma/schema.prisma`
- the specific migration, seed, or helper file being changed

## Rules

- Treat `prisma/schema.prisma` as the source of truth.
- Add a new migration for applied schema changes; do not edit already-applied migrations.
- Run `pnpm db:generate` after schema changes.
- Use `pnpm db:migrate` only for local/dev workflows on a disposable database.
- Use `pnpm db:deploy` for deploy paths.
- Keep `seed.ts` and `seed-employee-learning.ts` deterministic and rerunnable.
- Review `src/security.ts` if a schema change touches encrypted, hashed, or masked fields.

## Validation

- Verify with `pnpm --filter @dsj/database db:generate` and `pnpm --filter @dsj/database typecheck`.
- Run dependent package builds/typechecks when schema or generated client changes.
- If a migration changes data shape, confirm the app layer still compiles and the seed still runs.

## Escalate

- Column drops, renames, enum renames, or relation changes that can break existing data.
- `onDelete`, uniqueness, or index changes that alter tenant isolation or query behavior.
- Data backfills without a rollback story.
- Any schema change that affects PII, signatures, or encrypted identifiers.
