# Database Package

`packages/database` is the canonical persisted-data layer for DSJ.

Treat `prisma/schema.prisma` as the source of truth.

## Repo Context

This package carries the current compliance-contour data model and generated Prisma client workflow:

- companies, users, departments, sites, positions, employees, contractor data
- briefing journals, briefing records, signatures, reminders, and notification jobs
- employee documents, company documents, safety certificates, and archive/evidence records
- training programs, exams, assignments, and generated compliance artifacts
- protocols, responsibility orders, work permits, approval routes, and admission evaluations
- BIOT card generation requests, correspondence, and retention-related records
- seed data, encryption helpers, and Prisma client wiring

Read first:

- `prisma/schema.prisma`
- `prisma/seed.ts`
- `prisma/seed-employee-learning.ts`
- `src/security.ts`
- `src/client.ts`
- `../../docs/context/current-product-status.md`

## Boundaries

- Do not edit already-applied migrations.
- Add a new migration for schema changes.
- Keep seed scripts deterministic and rerunnable.
- Signed documents are immutable at the product level; post-sign changes should use annul, replace, or a new revision path.
- Avoid introducing a second persisted universe for signatures or archives.

## Validation

```bash
pnpm --filter @dsj/database db:generate
pnpm --filter @dsj/database typecheck
```

Run dependent package builds and typechecks when schema or generated client changes.
