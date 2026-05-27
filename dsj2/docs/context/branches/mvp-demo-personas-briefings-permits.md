# Branch Context: MVP Demo Personas, Briefings, Permits

This document is the execution context for one narrow MVP branch. It is not a full product spec and not a redesign brief.

## Branch Identity

- Branch name: `mvp/demo-personas-briefings-permits`
- Branch purpose: build a client-demo production contour in 3-4 focused steps.
- Why this branch exists: make the existing compliance, signing, journal, employee self-service, and early permit foundations feel like one connected operational product for demo and early sales conversations.

## MVP Contour To Close

This branch closes the demo contour:

- demo accounts for Director, Safety Engineer, Shop Chief, and Employees
- readable hierarchy: company, shop or department, position, employee
- instructions by persona inside existing contours
- employee signing for own records
- narrow permit journey
- work report
- handover to the next shift
- director read-only top visibility

## Account Contours

Do not create new cabinets or new auth universes.

- Admin contour: `COMPANY_ADMIN` / `SAFETY_ENGINEER` -> `/dashboard`
- Employee contour: `EMPLOYEE_SIGNER` -> `/my-instructions`

Director, Safety Engineer, and Shop Chief must be expressed as seeded demo personas, capabilities, or landing modes inside the existing admin contour. Employee work remains in employee self-service.

## Existing Foundations To Reuse

- Canonical document, signature, evidence, and archive stack:
  - `apps/api/src/signatures/*`
  - `packages/database/prisma/schema.prisma` models `DocumentEnvelope`, `DocumentVersion`, `Signature`, `SignatureVerification`, `ArchiveRecord`
  - `apps/web/app/api/document-envelopes/[envelopeId]/evidence-package/route.ts`
- Employee compliance and employee card foundation:
  - `apps/api/src/employees/employee-compliance.service.ts`
  - `apps/web/app/(app)/compliance/page.tsx`
  - organization entities in Prisma: `Company`, `Department`, `Site`, `Position`, `Employee`
- Briefing journals and instruction signing:
  - `apps/api/src/briefing-records/*`
  - `apps/web/actions/briefing.ts`
  - `apps/web/app/(app)/journal/*`
  - `apps/web/app/(app)/my-instructions/*`
  - `packages/types/src/briefing.ts`
  - Prisma models `BriefingRecord`, `BriefingBatch`, `BriefingJournal`, `BriefingJournalEntry`
- Employee documents signed flow:
  - `apps/api/src/employee-documents/*`
  - `apps/web/app/(app)/my-documents/*`
  - Prisma model `EmployeeDocument`
- Responsibility orders:
  - `apps/api/src/responsibility-orders/*`
  - `apps/web/actions/responsibility-order.ts`
  - `apps/web/app/(app)/orders/responsibility/*`
  - `packages/types/src/responsibility-order.ts`
  - Prisma models `ResponsibilityOrder`, `ResponsibilityAppointment`
- Protocol registry:
  - `apps/api/src/protocols/*`
  - `apps/web/app/(app)/protocols/*`
  - Prisma models `Protocol`, `ProtocolEmployee`, `ProtocolCommissionMember`
- Existing web contours:
  - `/dashboard`
  - `/journal`
  - `/employees`
  - `/compliance`
  - `/my-instructions`
  - `/my-documents`
- Early permit foundation:
  - `apps/api/src/core-platform/core-platform.controller.ts`
  - `apps/api/src/core-platform/core-platform.service.ts`
  - `apps/api/src/core-platform/core-platform.contracts.ts`
  - `packages/types/src/core-admission.ts`
  - Prisma models `WorkPermit`, `WorkPermitVersion`, `Brigade`, `BrigadeMember`

## In Scope

- Seeded demo personas:
  - Director
  - Safety Engineer
  - Shop Chief
  - Employees
- Hierarchy in data and UI:
  - company
  - shop / department
  - position
  - employee
- Role and capability shaping inside existing admin and employee contours.
- Instruction journey:
  - Safety Engineer can run introductory, repeated, unscheduled, and targeted briefings.
  - Shop Chief can run primary workplace briefing.
  - Employee can open and sign only own records.
  - Instructor signs their side through the canonical signing path.
  - Supporting scans, certificates, QR, or files are attached as evidence/supporting data where the existing stack allows.
- Permit journey:
  - Shop Chief creates a permit.
  - Adds employees.
  - Defines scope of work and dates.
  - Attaches photos/files.
  - Records work report.
  - Records handover to the next shift.
  - Director sees cross-cutting read-only overview.
- Smoke and demo readiness for the connected walkthrough.

## Out Of Scope

- Mobile app
- Contractors as a new branch of the MVP flow
- BI dashboards
- LMS expansion
- Public verification
- New auth surfaces
- New cabinets
- New auth roles
- Broad workflow engines
- Broad refactors
- Director approval bottleneck
- OCR or QR recognition project

## Current Assumptions

- `COMPANY_ADMIN` can represent Director and Shop Chief by seeded persona or capability metadata without adding a role.
- `SAFETY_ENGINEER` remains the Safety Engineer persona.
- `EMPLOYEE_SIGNER` remains the employee self-service persona.
- The existing seed password environment model remains in place; demo credentials should be added deterministically without weakening production guardrails.
- Existing company, department, site, position, and employee models are sufficient for the readable hierarchy.
- Existing signing and archive/evidence stack is the only signing/evidence stack for this branch.
- Existing `WorkPermit` and `Brigade` backend foundations can be extended narrowly for demo permits instead of creating a separate permit universe.
- Director visibility is read-only overview and reporting, not mandatory approval.
- Attachments for permits and briefings should reuse canonical document/evidence primitives where possible; if a file attachment primitive is missing, Step 3 should add the smallest scoped mechanism.

## Current Dependencies On Implemented Modules

- Employee compliance: present via `employee-compliance.service` and `/compliance`.
- Employee documents: present via `employee-documents` API and `/my-documents`.
- Protocol journal/registry: present via `protocols` API and `/protocols`.
- Briefing journals: present via `briefing-records`, `/journal`, and `/my-instructions`; verification was previously pending in context docs.
- Responsibility orders: present via `responsibility-orders` API and `/orders/responsibility`.
- Canonical document/signature/evidence/archive: present via signatures, document envelopes, archive records, evidence package route, and PDF service.
- `/dashboard` contour: present and used as admin landing.
- `/my-instructions` contour: present and used as employee landing.
- Permit foundation: present in `core-platform`, Prisma, and shared contracts; needs narrow demo-facing completion.

## Step Breakdown

### Step 1 - Demo Personas, Hierarchy, Seeded Accounts

- Status: complete and verified in the 2026-04-13 STEP-1-FINALIZE pass.
- Added deterministic demo personas without creating new auth roles:
  - Director: `director@alpina.local` as `COMPANY_ADMIN`
  - Safety Engineer: `safety.engineer@alpina.local` as `SAFETY_ENGINEER`
  - Shop Chief: `shop.chief@alpina.local` as `COMPANY_ADMIN`
  - Employee: `signer.employee@alpina.local` as `EMPLOYEE_SIGNER`
- Seed/read hierarchy clearly: company -> department/site -> position -> employee.
- Login and shell use shared demo persona metadata so demo accounts are deterministic and understandable.
- `/dashboard` shows the demo persona narrative inside the existing admin contour.
- Director is shaped as a read-only overview persona: no dashboard create action, no employee create/edit path, and employee-card mutation panels are hidden.
- Safety Engineer is shaped as the org-wide operating persona for journal, compliance, and employee-oriented surfaces needed by Step 2.
- Shop Chief is shaped as a department/site-scoped operating persona for `Бурение / Площадка Запад-14`; the employee registry is narrowed to that context.
- Employee remains in self-service only: `EMPLOYEE_SIGNER` lands at `/my-instructions` and is blocked from `/dashboard`.
- Verification completed:
  - `corepack pnpm --filter @dsj/database typecheck`
  - `corepack pnpm --filter @dsj/web typecheck`
  - guarded local seed run against `postgresql://localhost:5433/dsj` with `SEED_ALLOW_DESTRUCTIVE_RESET=true`
  - HTTP smoke: `/login` lists Director, Safety Engineer, Shop Chief, and Employee demo accounts
  - HTTP smoke: Director, Safety Engineer, and Shop Chief enter `/dashboard`; Employee enters `/my-instructions`
  - HTTP smoke: Director has no `/journal/new` dashboard action and is redirected away from `/employees/new`
  - HTTP smoke: Shop Chief `/employees` is narrowed to `Бурение / Площадка Запад-14`
  - HTTP smoke: Employee signer is blocked from `/dashboard`
- Verification pending:
  - optional visual browser screenshot pass for demo polish
  - local `db:deploy` on the existing disposable database returned Prisma `P3005` because the schema is non-empty and not migration-baselined; seed verification still passed

### Step 2 - Instruction Flow By Persona

- Status: complete and verified in the 2026-04-13 STEP-2 pass.
- Shape briefing creation and journal actions around persona capabilities without new auth roles:
  - Safety Engineer can create introductory, repeated, unscheduled, and targeted briefings across the organization.
  - Shop Chief can create primary workplace briefings only for employees inside the seeded department/site scope.
  - Director can read journal registry/card state but cannot create, edit, prepare, sign, annul, or replace records.
  - Employee remains self-service only and sees own pending/signed briefing records in `/my-instructions`.
- Backend action gating is authoritative for mutable journal operations; web surfaces reflect those allowed actions.
- Employee selection on journal create/edit is scoped by persona so the demo restriction is visible in behavior.
- Canonical briefing lifecycle remains the only flow: draft -> prepare-sign -> dual-sign -> signed -> archive/evidence -> annul/replace.
- Verification completed:
  - `corepack pnpm --filter @dsj/types typecheck`
  - `corepack pnpm --filter @dsj/api typecheck`
  - `corepack pnpm --filter @dsj/web typecheck`
  - guarded local seed run against `postgresql://localhost:5433/dsj` with `SEED_ALLOW_DESTRUCTIVE_RESET=true`
  - HTTP smoke against current-source API/web on ports 4010/3010 for Safety Engineer org-wide introductory create, Shop Chief scoped primary create, blocked Director/Safety/Shop Chief invalid mutations, Director read-only actions, Shop Chief scoped list, Employee `/my-instructions` load, and canonical prepare-for-signing
- Verification pending:
  - full instructor and employee cryptographic signing smoke because the current environment is not using `MOCK_NCALAYER`
  - optional visual browser screenshot pass for demo polish

### Step 3 - Narrow Permit Flow, Work Report, Handover

- Add demo-facing permit list/detail/create path inside existing admin contour.
- Support employees, scope, dates, attachments, report, and handover.
- Reuse `WorkPermit`, `WorkPermitVersion`, `Brigade`, `BrigadeMember`, document envelope, evidence, and signature foundations where possible.
- Director sees read-only overview of permits and handovers.

### Step 4 - Demo Hardening, Smoke, Polish

- Run focused validation for touched packages.
- Smoke the full demo flow:
  - Director overview
  - Safety Engineer briefing
  - Shop Chief primary briefing
  - Employee signing
  - Permit creation/report/handover
- Tighten copy, empty states, and navigation so the system reads as one workflow.

## Whole-Branch Acceptance

The branch is successful only if:

- demo accounts exist and are usable
- hierarchy is readable
- Safety Engineer can run introductory plus repeated, unscheduled, and targeted briefings
- Shop Chief can run primary workplace briefing
- Employee can sign own records
- Director can see cross-cutting overview
- Shop Chief can create and manage a permit
- Permit includes employees, scope, dates, attachments, report, and handover
- System looks like one connected workflow, not unrelated screens

## Current Branch-Init Notes

- Do not implement the whole contour in one step.
- Step 1 and Step 2 are now complete and verified; next implementation prompt should target Step 3 only.
- Keep branch work narrow and demo-driven.
- If docs conflict with code or package scripts, code and package scripts win.

## Branch Execution Log

### 2026-04-13 - Step 1 P2 Source Slice

- Active phase: P2 narrow demo contour.
- Existing branch execution files checked:
  - `.mempalace/branches/mvp-demo-personas-briefings-permits.json` was not present.
  - `docs/branches/` was not present.
  - Existing repo-local branch context is this file plus `.mempalace/branches.json` and `docs/context/FEATURE_BRANCH_MATRIX.md`.
- Files touched:
  - `packages/database/prisma/seed.ts`
  - `apps/web/app/login/page.tsx`
  - `apps/web/app/(app)/dashboard/page.tsx`
  - `.mempalace/branches.json`
  - `docs/context/branches/mvp-demo-personas-briefings-permits.md`
  - `docs/context/FEATURE_BRANCH_MATRIX.md`
- Decisions:
  - Director and Shop Chief remain seeded `COMPANY_ADMIN` personas instead of new auth roles.
  - Safety Engineer keeps `SAFETY_ENGINEER`; Employee keeps `EMPLOYEE_SIGNER`.
  - All demo personas use the explicitly configured `SEED_COMPANY_ADMIN_PASSWORD`; no hard-coded password was added.
  - Position hierarchy uses existing `Organization` and `Position` models with the seeded company id so employee pages can render department, site, position, and employee data.
- Stop point:
  - Step 1 stops after seeded personas, hierarchy, and minimal dashboard/login discoverability.
  - Step 2 briefing capability shaping was not started.
  - Step 3 permit flow was not started.
- Next exact action:
  - Start Step 2 only: constrain or guide briefing creation by persona capability for Safety Engineer and Shop Chief while preserving canonical signing.

### 2026-04-13 - STEP-1-FINALIZE

- Active phase: P2 narrow demo contour.
- Files touched in this finalize pass:
  - `apps/web/lib/demo-personas.ts`
  - `apps/web/app/login/page.tsx`
  - `apps/web/app/(app)/dashboard/page.tsx`
  - `apps/web/components/app-shell.tsx`
  - `apps/web/app/(app)/employees/page.tsx`
  - `apps/web/app/(app)/employees/[id]/page.tsx`
  - `apps/web/app/(app)/employees/new/page.tsx`
  - `apps/web/app/(app)/employees/[id]/edit/page.tsx`
  - `apps/web/app/(app)/journal/page.tsx`
  - `apps/web/app/(app)/journal/new/page.tsx`
  - `.mempalace/branches.json`
  - `docs/context/branches/mvp-demo-personas-briefings-permits.md`
  - `docs/context/FEATURE_BRANCH_MATRIX.md`
- Decisions:
  - Demo personas are centralized in web metadata instead of adding roles or cabinets.
  - Director remains `COMPANY_ADMIN` but is made read-only in the demo UI contour.
  - Shop Chief remains `COMPANY_ADMIN` but shell, employee registry, and journal context are narrowed to the seeded drilling/West-14 narrative.
  - Safety Engineer remains `SAFETY_ENGINEER` and keeps org-wide admin navigation for Step 2 readiness.
  - Employee remains `EMPLOYEE_SIGNER` and self-service only.
- Verification completed:
  - `corepack pnpm --filter @dsj/database typecheck`
  - `corepack pnpm --filter @dsj/web typecheck`
  - guarded local seed run with `SEED_ALLOW_DESTRUCTIVE_RESET=true`
  - HTTP smoke for `/login`, `/dashboard`, `/my-instructions`, director read-only redirects, shop chief scoped `/employees`, and employee admin-boundary redirect
- Verification pending:
  - optional visual browser screenshot pass for demo polish
  - local disposable database migration baseline cleanup if future sessions need `db:deploy` before seed
- Stop point:
  - Step 1 is closed.
  - Step 2 briefing persona gating was not started.
  - Step 3 permit flow was not started.
- Next exact action:
  - Start Step 2 only: shape briefing creation around Safety Engineer and Shop Chief persona capabilities without adding auth roles and while preserving canonical signing.

### 2026-04-13 - STEP-2

- Active phase: P2 narrow demo contour.
- Files touched in this pass:
  - `packages/types/src/briefing.ts`
  - `apps/api/src/briefing-records/briefing-records.service.ts`
  - `apps/api/src/signatures/signatures.service.ts`
  - `apps/web/components/briefing-regulation-fields.tsx`
  - `apps/web/app/(app)/journal/page.tsx`
  - `apps/web/app/(app)/journal/new/page.tsx`
  - `apps/web/app/(app)/journal/[id]/page.tsx`
  - `apps/web/app/(app)/journal/[id]/edit/page.tsx`
  - `apps/web/app/(app)/my-instructions/page.tsx`
  - `apps/web/app/(app)/my-instructions/[id]/page.tsx`
  - `.mempalace/branches.json`
  - `docs/context/branches/mvp-demo-personas-briefings-permits.md`
  - `docs/context/FEATURE_BRANCH_MATRIX.md`
- Decisions:
  - Demo persona behavior is enforced inside existing `COMPANY_ADMIN`, `SAFETY_ENGINEER`, and `EMPLOYEE_SIGNER` contours; no new roles or cabinets were added.
  - Safety Engineer is an organization-wide briefing operator for introductory, repeated, unscheduled, and targeted briefings, but not primary workplace briefings in this demo narrative.
  - Shop Chief is scoped to the seeded department/site and can create only primary workplace briefings for employees in that scope.
  - Director remains read-only on journal surfaces and receives no mutable allowed actions.
  - Employee self-service remains limited to own briefing records and uses the canonical signing path.
  - Canonical briefing lifecycle and immutable signed-record behavior remain authoritative.
- Verification completed:
  - `corepack pnpm --filter @dsj/types typecheck`
  - `corepack pnpm --filter @dsj/api typecheck`
  - `corepack pnpm --filter @dsj/web typecheck`
  - guarded local seed run against `postgresql://localhost:5433/dsj` with `SEED_ALLOW_DESTRUCTIVE_RESET=true`
  - current-source HTTP smoke on API 4010 and web 3010:
    - Safety Engineer created an org-wide introductory briefing
    - Shop Chief created a scoped primary workplace briefing
    - Director create, Safety Engineer primary create, Shop Chief repeated create, and Shop Chief out-of-scope create attempts returned `403`
    - Director read-only allowed actions, Shop Chief scoped registry visibility, and Employee `/my-instructions` page load were verified
    - Shop Chief primary briefing moved from draft to signing-ready through the canonical prepare step
- Verification pending:
  - full instructor and employee cryptographic signing smoke because the current environment is not using `MOCK_NCALAYER`
  - optional visual browser screenshot pass for demo polish
- Stop point:
  - Step 2 is closed.
  - Step 3 permit flow, work report, and handover were not started.
- Next exact action:
  - Start Step 3 only: implement the narrow permit flow, work report, and handover inside existing contours.
