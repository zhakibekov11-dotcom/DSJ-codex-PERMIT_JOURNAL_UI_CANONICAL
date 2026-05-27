# Worker App

`apps/worker` owns the BullMQ and Redis job runtime for DSJ. It handles reminders, notifications, compliance scans, and other background state synchronization.

## Repo Context

This layer is operational plumbing, not product UI.

Read first:

- `../../README.md`
- `../../docs/context/current-product-status.md`
- `../../docs/context/start-here-for-codex.md`
- `../../docs/signing.md` when touching signing expiry, provider polling, callback reconciliation, verification retry, or signing queue semantics
- `src/main.ts`
- the API notification module when worker behavior changes

## Main Responsibilities

- Keep job handlers idempotent.
- Keep queue names, `jobId`s, and repeat cadence changes deliberate.
- Make state transitions explicit and guarded.
- Preserve the `REDIS_URL` parsing and startup path unless the runtime layout changes on purpose.
- Keep worker writes aligned with API and database status enums and tenant scope.

Current worker behavior in `src/main.ts`:

- compliance scan queue repeats every 15 minutes
- notification dispatch queue repeats every 5 minutes
- reminder creation is deduplicated against existing pending/sent reminders
- employee document lifecycle and employee admission summaries are recalculated during compliance scans

## Signing Worker Roadmap

The current worker does not process signing sessions. The legal signing roadmap in `../../docs/signing.md` plans these queues:

- `dsj-signing-expiration`
- `dsj-signing-provider-poll`
- `dsj-signing-callback-reconcile`
- `dsj-signature-verification`

Planned jobs:

- `expireSigningSession(sessionId)`
- `pollProviderSession(sessionId)`
- `reconcileProviderCallback(callbackEventId)`
- `verifyAndPersistSignature(sessionId)`
- `cleanupStaleQrPayloads()`

When implementing these jobs, keep handlers idempotent, use stable `jobId` values, persist terminal failure states, and preserve the existing compliance/notification queue behavior.

## Product Boundary Reminder

- Do not reimplement API business logic in the worker.
- Do not create a second reminder or notification universe.
- If a worker change affects notifications, reminders, or compliance scans, verify the related API path too.

## Validation

```bash
pnpm --filter @dsj/worker build
pnpm --filter @dsj/worker typecheck
```

Smoke-check Redis-backed processing when queue behavior changes.

Worker signing env will use the same planned signing/session/evidence variables documented at the repo root and in `../../docs/signing.md`.
