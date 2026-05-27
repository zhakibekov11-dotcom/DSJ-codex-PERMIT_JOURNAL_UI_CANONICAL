---
name: worker-queue-diagnostics
description: Diagnose DSJ BullMQ/Redis worker jobs, repeat schedules, retries, and status transitions. Use when editing apps/worker, queue-backed notifications, compliance scans, or processing that must stay idempotent.
---

# Worker Queue Diagnostics

Diagnose BullMQ and Redis worker behavior without introducing duplicate jobs.

## When to use

Use for:

- `apps/worker`
- queue names, repeat jobs, and job IDs
- notification or compliance processing that runs from Redis
- status transition logic in worker-backed flows

Do not use for pure API or UI work unless the worker behavior changes too.

## Inputs

- Queue or job name
- Retry/deduplication behavior
- Expected status transitions
- Redis or startup assumptions

## Procedure

1. Identify the queue names, `jobId`s, and repeat cadence involved.
2. Check whether the job is idempotent before touching enqueue or processing logic.
3. Make status transitions explicit and guarded.
4. Preserve the `REDIS_URL` parsing and startup path unless the runtime layout changes on purpose.
5. Check whether a change affects reminders, notifications, or compliance records in the API/database.
6. Run the worker build/typecheck path.
7. Smoke-check Redis-backed processing when queue behavior changes.
8. Confirm that repeated runs do not create duplicate state.

## Required checks

- `pnpm --filter @dsj/worker build`
- `pnpm --filter @dsj/worker typecheck`
- A local smoke-check for the queue or repeat job when behavior changed

## Outputs

- Queue/job summary
- Retry and idempotency decision
- Status transition notes
- Any follow-up API or database check that the worker change requires

## Red flags

- Jobs without stable IDs where duplicates would hurt data
- Non-idempotent side effects without a guard
- Retry or failure handling that can silently lose reminders, notifications, or compliance work
- A queue change that does not match the API/database status enums
- Silent catches around worker errors
