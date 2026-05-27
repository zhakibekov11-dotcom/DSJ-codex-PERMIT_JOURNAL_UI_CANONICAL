# Worker Area Rules

This file augments `../../AGENTS.md`.

Use it for BullMQ/Redis jobs, repeat schedules, notifications, and compliance scans.

## Rules

- Treat job handlers as idempotent.
- Keep queue names, `jobId`s, and repeat cadence changes deliberate.
- Make state transitions explicit and guarded; do not swallow failures.
- Preserve the `REDIS_URL` parsing and startup path unless the runtime layout changes on purpose.
- Keep worker writes aligned with API/database status enums and tenant scope.
- If a worker change affects notifications or reminders, verify the related API path too.

## Validation

- Verify with `pnpm --filter @dsj/worker build` and `pnpm --filter @dsj/worker typecheck`.
- Smoke-check Redis-backed processing when queue behavior changes.
- If repeat jobs change, confirm the new cadence and deduplication behavior.

## Escalate

- Non-idempotent side effects without a guard.
- Queue jobs without stable IDs where duplicates would hurt data.
- Retry or failure handling that can silently lose reminders, notifications, or compliance work.
