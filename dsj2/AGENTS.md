# DSJ Agent Router

This file is a router, not a knowledge dump. Work from the `dsj2` repository root and load only the context needed for the task.

## Load Order

1. Read `.mempalace/index.json`.
2. If the task names a feature or business process, open the matching `.mempalace/features/*.json` card.
3. Read only the nearest area `AGENTS.md` needed for the touched files:
   - `apps/web/AGENTS.md`
   - `apps/api/AGENTS.md`
   - `apps/worker/AGENTS.md`
   - `packages/database/AGENTS.md`
   - `scripts/AGENTS.md`
4. Read the area README when it exists.
5. Read only the canonical files listed by the feature card or task prompt.

## Source Of Truth

- Code, `package.json`, `pnpm-workspace.yaml`, and `turbo.json` are authoritative for commands.
- `packages/database/prisma/schema.prisma` is authoritative for schema.
- If docs conflict with package scripts or code, trust the package scripts and code.

## Ignore By Default

Do not load generated/runtime folders unless explicitly asked:

- `.codex-runtime/`
- `.playwright-cli/`
- `.runlogs/`
- `.turbo/`
- `.next/`
- `.next.broken.*/`
- `node_modules/`
- `dist/`
- `build/`
- `coverage/`
- `tmp/`
- `__pycache__/`

## Hard Limits

- Do not rewrite unrelated modules.
- Do not treat logs, caches, Playwright dumps, build output, or temp files as source of truth.
- Do not rewrite applied Prisma migrations.
- Do not trust tenant/company scope from request bodies.
- Do not change auth, tenant scope, signatures, PII, encryption, worker queue semantics, or deploy/runtime files without explicit approval.

## Reporting

Always report changed files, intentionally unchanged surfaces, verification done, and verification pending.
