# DSJ Monorepo

DSJ is a Kazakhstan-focused digital safety and compliance platform.

At a business level, it replaces paper journals and fragmented files with one auditable workflow for safety briefings, employee acknowledgements, signatures, training records, compliance documents, and related evidence.

It is built for:

- company admins and safety engineers who run day-to-day compliance operations;
- employees who need a self-service cabinet to review and sign assigned items;
- super admins who manage multiple companies and cross-company access;
- PMs and business stakeholders who need a clear view of what is implemented, what is in progress, and what depends on external runtime such as NCALayer.

## Product At A Glance

Current business capabilities:

- employee, company, contractor, and department management;
- briefing journals with signing and PDF export;
- responsibility orders and protocol registry flows;
- employee documents, company documents, and safety certificates;
- training and exams with generated compliance artifacts;
- BIOT/PTM/PB/PS document generation;
- outgoing correspondence and document exports;
- reminders, audit history, and background compliance scans;
- local NCALayer-based signing transport for the current signing flows.

Current user contours:

- `COMPANY_ADMIN` and `SAFETY_ENGINEER` work from `/dashboard`;
- `EMPLOYEE_SIGNER` works from `/my-instructions`;
- `SUPER_ADMIN` has cross-company access.

Current delivery focus:

- P1 core is in place;
- the next major delivery direction is P2, starting with online work permits core.

## How To Read The Repo

Start here when you open a new chat or branch:

1. `docs/context/README.md`
2. `docs/context/start-here-for-codex.md`
3. `docs/context/current-product-status.md`
4. `docs/context/repo-context-operating-system.md`
5. `docs/context/execution-phases-p0-p4.md`
6. `docs/signing.md` when the task touches legal signing, NCALayer, mock signing, eGov Mobile QR, evidence, or signature audit behavior
7. The relevant area README: `apps/web/README.md`, `apps/api/README.md`, `packages/database/README.md`, or `apps/worker/README.md`
8. The nearest area `AGENTS.md`
9. The canonical files for the touched flow, usually `packages/database/prisma/schema.prisma`, the matching controller/service, and the matching web route or action

Use `.mempalace/index.json` and the feature cards under `.mempalace/features/` when the task touches a named product slice.

## RCOS Layers

- AGENTS routing layer: choose the nearest `AGENTS.md` before editing files.
- MemPalace context memory layer: `.mempalace/*` holds machine-readable repo, branch, and feature routing.
- split README layer: `apps/*/README.md` and package-level `README.md` files give local orientation.
- docs/context navigation layer: human-readable start-here, status, and phase docs.
- branch execution layer P0-P4: phase markers for what is in scope now versus later.

## Repository Structure

- `apps/web` - Next.js App Router frontend, server actions, auth redirects, employee self-service, and `app/api` proxy routes.
- `apps/api` - NestJS API modules, tenant-scoped workflows, signing/archive/evidence orchestration, and document endpoints.
- `apps/worker` - BullMQ/Redis worker for reminders, notifications, and compliance scans.
- `apps/ncalayer-bridge` - Local bridge service for NCALayer signing transport.
- `packages/database` - Prisma schema, migrations, seed scripts, generated client workflow, and encryption helpers.
- `packages/types` - Shared request/response contracts and validation schemas.
- `packages/ui`, `packages/utils`, `packages/config` - Shared UI primitives, utility code, and tsconfig presets.
- `scripts` - Python document-generation helpers for DOCX/XLSX/PDF-adjacent export flows.
- `docs/context` - Human navigation and branch/status memory for Codex.
- `.mempalace` - Machine-readable context routing for agents.
- `CURRENT_FUNCTIONALITY.md` - Useful audit snapshot, but verify claims against code before changing behavior.

## Product Boundaries

- Do not add new cabinets unless the product scope explicitly changes.
- Do not add new auth roles unless the current roles cannot express the task.
- Director, safety engineer, and shop chief should usually be represented as personas or capabilities inside the existing admin contour.
- Employee work stays in the self-service contour.
- Reuse the canonical document / signature / evidence / archive stack first.
- Avoid parallel signing or archive universes.
- Signed documents are immutable; changes after sign should flow through annul, replace, or a new revision path.
- Current focus is an operationally credible compliance flow, not broad platform sprawl.

## Signing Roadmap

The current repository supports NCALayer and mock signing through domain-specific routes. The target legal signing architecture is documented in `docs/signing.md` and adds a generic signing session model, provider adapters, eGov Mobile QR callback/polling, signing worker queues, immutable evidence storage, and production mock-signing refusal.

Until that implementation is complete:

- keep existing protocol, responsibility-order, employee-document, briefing, and public invite signing routes compatible;
- do not wire eGov directly into domain services;
- keep raw provider payloads, certificate personal data, and signing secrets out of browser responses and logs;
- preserve existing `MOCK_NCALAYER` and `NCALAYER` enum values during any migration.

## Environment

Copy `.env.example` to `.env` for local development and keep secrets out of git.

Common variables:

- `APP_URL`, `API_URL`, `CORS_ORIGIN` - public web/API URLs and CORS origin.
- `DATABASE_URL` - PostgreSQL connection string.
- `REDIS_URL` - Redis connection string for worker and queue-backed flows.
- `JWT_SECRET`, `JWT_EXPIRES_IN`, `COOKIE_NAME` - auth/session configuration.
- `FIELD_ENCRYPTION_KEY` - encryption key for sensitive employee data.
- `OPENAI_API_KEY`, `OPENAI_MODEL` - optional correspondence AI support.
- `SIGNING_PROVIDER`, `NCALAYER_BRIDGE_URL`, `NCALAYER_BRIDGE_TIMEOUT_MS`, `SIGNING_TEST_MODE`, `ALLOW_PUBLIC_INVITE_MOCK_SIGNING` - current signing runtime selection and NCALayer/mock behavior.
- `SIGNING_PROVIDER_DEFAULT`, `SIGNING_MOCK_ENABLED`, `SIGNING_REQUIRE_LEGAL_PROVIDER_IN_PROD`, `NCALAYER_ENABLED`, `EGOV_MOBILE_QR_*`, `SIGNING_SESSION_TTL_SECONDS`, `SIGNATURE_EVIDENCE_*`, `SIGNATURE_HASH_ALGORITHM` - planned generic signing/session/evidence settings for the legal signing roadmap.
- `SEED_ALLOW_DESTRUCTIVE_RESET`, `SEED_*` - guarded local seed reset controls.

Use `.env.abtest.example` as the branch-contour example for isolated AB test deployments.

## Common Commands

Run commands from the `dsj2` root.

```bash
corepack enable && pnpm install --frozen-lockfile
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm verify
pnpm db:generate
pnpm db:migrate
pnpm db:deploy
pnpm db:seed
pnpm build:api:deploy
pnpm build:worker:deploy
```

Current validation reality:

- `pnpm verify` is the current compile/build gate and runs database generation, typecheck, and build.
- Root `pnpm lint` and `pnpm test` intentionally fail with placeholder messages because package-level lint/test tasks are not configured yet.
- For narrow changes, prefer the touched package build/typecheck plus a targeted smoke check.

## Source Of Truth

- Code, `package.json`, `pnpm-workspace.yaml`, and `turbo.json` are authoritative for commands and runtime shape.
- `packages/database/prisma/schema.prisma` is authoritative for persisted data shape.
- `.mempalace/` is a compact context router, not a long-form architecture document.
- `docs/context/` complements MemPalace for human navigation.

## Git Hygiene

Generated/runtime artifacts are not source of truth. Do not commit logs, caches, Playwright CLI captures, Next build output, Python bytecode, temp files, or local environment files. Keep intentional examples such as `.env.example` and `.env.abtest.example` tracked.
