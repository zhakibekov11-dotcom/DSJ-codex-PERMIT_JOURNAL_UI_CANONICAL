# Current Product Status Snapshot

This is a current repo snapshot, not the final product ideal.

## Implemented / Near-Ready

- Employee compliance foundation
- Canonical document / signature / evidence / archive core
- Employee documents signed flow - implemented
- Protocol journal / protocol registry - implemented
- Responsibility orders - implemented
- Electronic briefing journals - implementation complete, verification pending
- Permit journal / work permit lifecycle - working MVP implemented, deployment verification pending

## Current Account Contours

- `COMPANY_ADMIN` / `SAFETY_ENGINEER` -> `/dashboard`
- `EMPLOYEE_SIGNER` -> `/my-instructions`

## Current Boundaries

- No new cabinets.
- No new auth roles unless the current ones cannot express the task.
- Director, safety engineer, and shop chief should stay as personas or capabilities inside the existing admin contour.
- Employee work stays in the self-service contour.
- Reuse the canonical document / signature / evidence / archive stack first.
- Avoid parallel signing or archive universes.
- Signed documents are immutable; changes after sign should go through annul, replace, or a new revision path.

## Current Next Likely Module

- Permit journal deployment verification and specialized P1 form planning

## Evidence Anchors

- `apps/web/components/app-shell.tsx`
- `apps/web/lib/auth.ts`
- `packages/database/prisma/schema.prisma`
- `apps/api/src/briefing-records/briefing-records.controller.ts`
- `apps/api/src/responsibility-orders/responsibility-orders.controller.ts`
- `apps/api/src/signatures/signatures.service.ts`
- `apps/api/src/core-platform/work-permits.service.ts`
- `apps/worker/src/main.ts`
- `apps/web/app/(app)/permits/*`
- `apps/api/src/employee-documents/*`
- `apps/api/src/protocols/*`

## Deeper Audit

For more detail, use `CURRENT_FUNCTIONALITY.md` and the relevant feature card under `.mempalace/features/`.
