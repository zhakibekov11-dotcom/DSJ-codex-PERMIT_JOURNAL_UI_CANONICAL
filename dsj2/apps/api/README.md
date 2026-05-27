# API App

`apps/api` owns the NestJS backend for DSJ. It contains controllers, services, guards, validation pipes, tenant-scoped workflow orchestration, signing/archive/evidence flows, document generation endpoints, and backend contracts consumed by `apps/web`, `apps/worker`, and shared packages.

## Repo Context

`apps/api` is the canonical workflow layer for compliance documents, signing, evidence, archive, and document orchestration.

Current boundary:

- reuse the canonical stack first
- avoid parallel signing or archive universes
- signed documents are immutable
- changes after sign should go through annul, replace, or a new revision path
- the current next likely module is online work permits core

Read first:

- `../../README.md`
- `../../docs/context/start-here-for-codex.md`
- `../../docs/context/current-product-status.md`
- `../../docs/signing.md` when touching signing, eGov Mobile QR, NCALayer, evidence, verification, callbacks, or signature audit behavior
- `../../packages/database/prisma/schema.prisma`

## Main Modules

- `auth`, `users`, `common` - JWT session handling, roles, guards, validation, and tenant helpers.
- `companies`, `departments`, `contractor-companies`, `employees`, `core-platform` - organization and workforce data.
- `briefing-records`, `signatures`, `pdf` - briefing journal lifecycle, signing, invite flows, and PDF exports.
- `employee-documents`, `company-documents`, `safety-certificates`, `protocols`, `responsibility-orders` - document, order, archive, and evidence workflows.
- `training-programs`, `exams` - learning and testing flows.
- `biot-cards`, `correspondence`, `translations` - BIOT/PTM/PB/PS generation, outgoing correspondence, AI assistance, and job-title translation.
- `dashboard`, `notifications`, `audit` - metrics, notification jobs, and traceability.
- `database` - Prisma service integration.

## Signing API Roadmap

Current signing behavior is implemented through domain-specific routes and the `signatures` module. It supports:

- current providers `MOCK_NCALAYER` and `NCALAYER`;
- briefing record and public invite signing;
- protocol, responsibility-order, and employee-document `prepare-sign` plus `sign` flows;
- document envelope evidence package export through `core-platform`.

The target legal signing roadmap in `../../docs/signing.md` adds:

- a generic `SigningModule`;
- `SigningSession`, provider config, callback event, and evidence persistence models;
- provider adapters for mock, NCALayer, and eGov Mobile QR;
- eGov callback validation and reconciliation;
- redacted provider-response storage;
- production refusal of mock signing when a legal provider is required.

Until the generic module is implemented, keep the existing routes backward compatible and do not wire eGov directly into protocol, responsibility-order, employee-document, or briefing services.

## Rules Of Ownership

- Derive company scope from authenticated users, not request bodies.
- Keep authorization in controllers/guards and business behavior in services.
- Use shared schemas and `ZodValidationPipe` for request validation.
- Keep response contracts backward compatible and update `@dsj/types` with API contract changes.
- Do not expose PII, encrypted values, signature payloads, auth secrets, or tenant internals.

## Product Boundary Reminder

- Director, safety engineer, and shop chief should usually be expressed as personas or capabilities inside the existing admin contour.
- Employee self-service should stay separate from the admin contour.
- Use the canonical signature and archive paths instead of creating a second document universe.

## Environment

Backend variables used by current code:

- `PORT` - API port, defaulting to `4000`.
- `APP_URL`, `CORS_ORIGIN` - public frontend URL and allowed CORS origin.
- `DATABASE_URL` - PostgreSQL connection.
- `REDIS_URL` - Redis connection for worker/notification-backed flows.
- `JWT_SECRET`, `JWT_EXPIRES_IN`, `COOKIE_NAME` - auth/session config.
- `FIELD_ENCRYPTION_KEY` - encryption key for sensitive employee data.
- `OPENAI_API_KEY`, `OPENAI_MODEL` - correspondence AI support and fallback behavior.
- `SIGNING_PROVIDER`, `NCALAYER_BRIDGE_URL`, `NCALAYER_BRIDGE_TIMEOUT_MS`, `SIGNING_TEST_MODE`, `ALLOW_PUBLIC_INVITE_MOCK_SIGNING` - current signing runtime config.
- `SIGNING_PROVIDER_DEFAULT`, `SIGNING_MOCK_ENABLED`, `SIGNING_REQUIRE_LEGAL_PROVIDER_IN_PROD`, `NCALAYER_ENABLED`, `EGOV_MOBILE_QR_*`, `SIGNING_SESSION_TTL_SECONDS`, `SIGNATURE_EVIDENCE_*`, `SIGNATURE_HASH_ALGORITHM` - planned generic signing/session/evidence config documented in `../../docs/signing.md`.
- `SEED_ALLOW_DESTRUCTIVE_RESET`, `SEED_SUPER_ADMIN_EMAIL`, `SEED_SUPER_ADMIN_PASSWORD`, `SEED_COMPANY_ADMIN_EMAIL`, `SEED_COMPANY_ADMIN_PASSWORD` - guarded seed controls.

The API also depends on Python runtime packages from `scripts/requirements-runtime.txt` for DOCX/XLSX document generation paths.

Production signing safety targets:

- fail API startup when production is configured for mock signing while legal providers are required;
- reject eGov Mobile QR enablement without base URL, credentials, callback validation, and public callback URL;
- keep raw IIN, raw CMS payloads, provider secrets, biometric data, and full provider responses out of API responses and logs.

## Local Development

Run from the repo root unless you intentionally filter to this package.

```bash
pnpm dev
pnpm --filter @dsj/api dev
pnpm --filter @dsj/api typecheck
pnpm --filter @dsj/api build
pnpm build:api:deploy
pnpm db:generate
pnpm db:deploy
```

For full monorepo validation use `pnpm verify`. Root `pnpm lint` and `pnpm test` are placeholders in this repo.

## Verification Checklist

- Touched controllers/services compile.
- Tenant guardrails are checked for reads, writes, exports, and downloads.
- Contract changes are reflected in `@dsj/types`.
- Signing, archive, evidence, PII, and encryption paths receive targeted review.
- Binary download endpoints are smoke-checked when changed.
