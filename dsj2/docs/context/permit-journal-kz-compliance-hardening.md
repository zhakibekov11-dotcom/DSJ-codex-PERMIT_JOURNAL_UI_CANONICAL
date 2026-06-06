# Permit Journal KZ Compliance Hardening

Branch: `feat/permit-journal-kz-compliance-hardening`

This is a baseline audit and first hardening pass for the existing WorkPermit / Permit Journal MVP. It does not introduce a second permit module, new roles, new cabinets, or a parallel signing/archive/evidence stack.

## Existing Permit Entities

- Prisma enums: `PermitType`, `PermitWorkType`, `WorkPermitStatus`, `WorkPermitVersionStatus`, `WorkPermitApprovalRole`, `WorkPermitApprovalStatus`, `WorkPermitPrecheckResult`, `PpeIssueStatus`, plus older `WorkPermitType` used by admission logic.
- Prisma models: `WorkPermit`, `WorkPermitVersion`, `WorkPermitApproval`, `WorkPermitPrecheckRun`, `WorkPermitClosure`, `PpeIssueRecord`, `Brigade`, `BrigadeMember`.
- Shared contracts: `packages/types/src/permit.ts` for permit entry payload, MVP work types, workflow bodies, precheck checks/snapshots, closure, and PPE issue input.
- Canonical stack reused by permits: `DocumentEnvelope`, `DocumentVersion`, `SigningSession`, `Signature`, `SignatureEvidence`, `SignatureVerification`, `ExportSnapshot`, `ArchiveRecord`, `RetentionPolicy`.

## Existing Statuses

Database statuses are uppercase: `DRAFT`, `SUBMITTED`, `MISSING_DOCUMENTS`, `IN_APPROVAL`, `APPROVED`, `SIGNING_READY`, `SIGNED`, `ACTIVE`, `CLOSED`, `SUSPENDED`, `EXTENDED`, `REJECTED`, `CANCELLED`, `EXPIRED`, `ANNULLED`, `ARCHIVED`.

Shared/UI statuses are lowercase: `draft`, `pending_precheck`, `missing_documents`, `pending_approval`, `approved`, `signing_ready`, `signed`, `active`, `suspended`, `extended`, `closed`, `rejected`, `cancelled`, `expired`, `archived`.

Controlled lifecycle is implemented in `apps/api/src/core-platform/permit-workflow.ts`. The active MVP path supports:

- `draft -> missing_documents / in_approval / cancelled`
- `missing_documents -> draft / in_approval / cancelled`
- `in_approval -> approved / rejected / cancelled`
- `approved -> signing_ready / cancelled`
- `signing_ready -> signed / rejected / cancelled`
- `signed -> active / cancelled`
- `active -> suspended / closed / expired`
- `suspended -> active / closed / expired`
- `extended -> active / suspended / closed / expired`
- `closed -> archived`
- `expired -> archived`
- `cancelled -> archived`

`SUBMITTED` and `ANNULLED` remain legacy-compatible database statuses and are not the main UI flow.

## Existing Endpoints And Actions

Backend routes live under `/v1/core-platform` in `apps/api/src/core-platform/core-platform.controller.ts`:

- `GET /work-permits`
- `GET /work-permits/:permitId`
- `POST /work-permits`
- `PATCH /work-permits/:permitId`
- `GET /ppe-issues`
- `POST /ppe-issues`
- `POST /work-permits/:permitId/precheck`
- `POST /work-permits/:permitId/submit`
- `POST /work-permits/:permitId/confirm`
- `POST /work-permits/:permitId/approve`
- `POST /work-permits/:permitId/reject`
- `POST /work-permits/:permitId/prepare-sign`
- `POST /work-permits/:permitId/activate`
- `POST /work-permits/:permitId/suspend`
- `POST /work-permits/:permitId/resume`
- `POST /work-permits/:permitId/close`
- `POST /work-permits/:permitId/cancel`
- `POST /work-permits/:permitId/archive`
- `GET /work-permits/:permitId/evidence`
- `GET /work-permits/:permitId/pdf`

Web server actions live in `apps/web/actions/permits.ts` and call the existing API endpoints. Generic signing sessions route `WORK_PERMIT` targets through `apps/api/src/signing/signing.service.ts` into `WorkPermitsService.signingTarget()` and `WorkPermitsService.completeSigning()`.

## Existing UI Pages

Existing pages under `apps/web/app/(app)/permits`:

- `/permits` journal/list
- `/permits/new` create draft
- `/permits/[id]` detail
- `/permits/[id]/edit` edit while unlocked
- `/permits/[id]/precheck`
- `/permits/[id]/approvals`
- `/permits/[id]/signatures`
- `/permits/[id]/closure`
- `/permits/[id]/audit`

Existing support files include `apps/web/components/permit-entry-form.tsx`, `apps/web/components/permit-summary.tsx`, `apps/web/lib/permits.ts`, `apps/web/lib/permit-queries.ts`, and PDF/evidence proxy routes under `apps/web/app/api/permits/[id]`.

## What Already Matches Order No. 344 MVP

- General high-risk permit is represented by `PermitType.HIGH_RISK_WORK` and `PermitWorkType.GENERAL_HIGH_RISK`.
- Permit journal registration is represented by `journalRegistrationNumber`, unique per organization.
- Contractor access is represented by `PermitType.CONTRACTOR_ACCESS` and `PermitWorkType.CONTRACTOR_SITE_ACCESS`, with contractor organization and representative fields.
- Core form fields exist for organization scope, department/work site, workplace, work description, validity period, issuer, responsible manager, work producer, admitter, observer, brigade, hazards, safety measures, PPE, required evidence, and legal basis.
- Permit versions and document versions are created transactionally through the existing `DocumentEnvelope` / `DocumentVersion` stack.
- Precheck stores real-source checks and snapshots in `WorkPermitPrecheckRun`.
- Approval route uses MVP roles: work producer, responsible manager, permit issuer, admitter. Director is not a default mandatory approver.
- Signing freezes the current document version, hashes the canonical payload, stores `signedPayloadHash`, and completes through the generic signing session and `Signature` stack.
- PDF and evidence downloads reuse API PDF rendering and document-envelope evidence package generation.
- Closure stores a hashed closure payload in `WorkPermitClosure`.
- Archive reuses `RetentionPolicy` and `ArchiveRecord`.

## Partial Matches

- `HEIGHT_WORK` is allowed as an MVP bridge, but it is not a complete specialized height-work legal module.
- `HOT_WORK`, `GAS_HAZARDOUS_WORK`, `ELECTRICAL_WORK`, `EARTH_WORK`, `CONFINED_SPACE`, and `LIFTING_WORK` exist as enum values, but create/update is restricted to MVP work types by shared schemas and service guards.
- Contractor access act is represented by the contractor access permit shape, not a full separate Appendix 3 act entity.
- PDF output is an operational summary, not a full official Appendix 1/2/3 printable package.
- `ExportSnapshot` exists in the canonical stack, but permit PDF generation currently streams a PDF instead of persisting a permit export snapshot.

## Missing Or Deferred

- Full Appendix 1 field-by-field printable form.
- Full Appendix 2 journal export with all columns and retention/export snapshot persistence.
- Full Appendix 3 contractor access act entity and print form.
- Specialized permit templates and extra fields for hot work, gas hazardous work, electrical work, earth work, confined space, lifting work, and height work.
- Shift handover and extension workflow UI/business rules beyond existing `EXTENDED` status.
- eGov Mobile signing for permits; current permit signing supports NCALayer and controlled mock test mode through generic sessions.

## Hardening Applied In This Branch

- Active/suspended/extended permits can no longer be cancelled directly; they must move through suspend/close/expire and then archive.
- Precheck now verifies that assigned contractor workers still belong to the selected contractor at the time of admission.
- Tests cover lifecycle bypass rejection, contractor worker cross-contractor precheck failure, and diagnosis-free medical snapshots.
- Phase 1 Appendix 1 payload hardening adds draft/create/update support for equipment or object of work, workplace preparation measures, responsible safety-measure executors, air analysis requirement/result/time/by, isolation/lockout, fencing/signs, fire-safety measures, adjacent-area approvals/communication, target briefing, crew acknowledgement placeholders, admission time/admitter, and work-producer acceptance time.
- `legalBasisVersion` and `legalBasisEffectiveDate` are system-set in the canonical payload as `KZ_ORDER_344_APPENDIX_1` and `2020-08-28`; clients cannot inject these service fields.
- Appendix 1 additions are payload-first and stored in existing `WorkPermitVersion` / `DocumentVersion` JSON. No Prisma migration or parallel permit table was added.
- Existing create/edit permit UI now exposes the Appendix 1 payload fields, and permit detail shows an Appendix 1 summary card.
- Canonical hash tests now cover Appendix 1 fields so signed/frozen payloads protect these values.

## Phase 2 - Appendix 2 permit issue journal hardening

Implemented on top of the existing `/permits` WorkPermit flow. No new PermitJournal module, signing stack, evidence stack, archive stack, Prisma model, or migration was added.

Covered Appendix 2 MVP columns:

- Journal row number: persisted `WorkPermit.journalRegistrationNumber`.
- Initial admission date/time: derived from persisted `WorkPermit.startedAt`, falling back to canonical payload `permitEntry.admissionAt` when present.
- Repeated admission date/time: exposed as `repeatedAdmissionAt`, currently `null` because resume/extension/handover does not yet create a legally meaningful repeated-admission event.
- Permit number: persisted `WorkPermit.permitCode`.
- Issuer: persisted `WorkPermit.issuerEmployeeId` plus display lookup from `Employee.fullName` where available.
- Work description: persisted `WorkPermit.workDescription`.
- Workplace: persisted `WorkPermit.workplace`.
- Work type: persisted `WorkPermit.workType`.
- Lifecycle status: persisted `WorkPermit.status`, mapped to shared permit status labels in UI.
- Closure date/time: persisted `WorkPermit.closedAt`.
- Valid-until: persisted `WorkPermit.effectiveTo`, falling back to canonical payload `validUntil`.
- Contractor: persisted `WorkPermit.contractorOrganizationId` plus display lookup from `ContractorOrganization.name` where available.
- Archive/retention: persisted `WorkPermit.archivedAt`, `archiveRecordId`, `retentionPolicyId`, and related `ArchiveRecord.disposalEligibleAt` where available.

API/list status:

- `GET /core-platform/work-permits` still returns the existing WorkPermit-shaped records for backward compatibility.
- Each list/detail record now includes a derived `journal` object with Appendix 2 display data.
- `journalRegistrationNumber` is required by `createPermitSchema`.
- Uniqueness is enforced by the existing `@@unique([organizationId, journalRegistrationNumber])` constraint and now maps duplicate Prisma conflicts to a user-facing `ConflictException`.
- Employee signer visibility remains scoped to assigned participant/brigade permits through the existing WorkPermit access logic.

UI status:

- `/permits` is now presented as `Журнал нарядов-допусков`.
- The table shows journal row number, initial admission, repeated admission, permit number, issuer, work description, workplace/work type/contractor, lifecycle status, valid-until, closure, and archive marker.
- Existing filters remain on the same page: status, work type, date range, contractor, active-only, archived-only.
- Rows link to the existing permit detail page.
- Permit detail now includes a `Журнальная запись` block with journal number, permit number, admission timestamps, issuer, status, closure, archive, and retention data.

Export status:

- Added minimal authenticated CSV export at `/api/permits/journal.csv`, backed by the existing WorkPermit list API and current filters.
- This is an MVP operational export, not a persisted legal `ExportSnapshot`.
- Persisted export snapshots and full official Appendix 2 print/export package remain P1.

Phase 2 remaining gaps:

- Auto-numbering engine for journal numbers; current mode remains manual.
- Legally complete repeated-admission, shift handover, and extension event model.
- Full Appendix 2 PDF/XLSX package with persisted `ExportSnapshot`.
- Human-readable issuer/contractor display depends on current lookup availability; no new relations were added.
- Full Appendix 3 contractor access act remains deferred.

## Phase 3 - Appendix 3 contractor access act MVP

Implemented on top of the existing WorkPermit, contractor, document-envelope, and archive primitives. No new permit module, contractor cabinet, signing stack, archive stack, evidence stack, or specialized hot/gas/electrical/earth/confined/lifting template was added.

Implemented flow:

- New `ContractorAccessAct` Prisma entity with `DRAFT`, `ACTIVE`, `CLOSED`, `CANCELLED`, and `ARCHIVED` lifecycle statuses.
- API routes under existing `/v1/core-platform/contractor-access-acts` support list, detail, create draft, update draft, activate, close, cancel, and archive.
- Web management screen lives inside the permits area at `/permits/contractor-access-acts`.
- WorkPermit create/update accepts optional `contractorAccessActId`.
- Permit create/edit UI can select an active contractor access act when contractor work is being prepared.
- Permit detail shows the linked act summary and a link back to the act management screen.

Appendix 3 fields covered as persisted columns:

- Organization: `organizationId`.
- Receiving-side scope: `scopeType`, `branchId`, `departmentId`, `workSiteId`.
- Contractor organization: `contractorOrganizationId`.
- Contractor representative: `contractorRepresentativeId`.
- Receiving-side representative and unit chief: `hostRepresentativeEmployeeId`, `hostUnitChiefEmployeeId`.
- Work name and description: `workName`, `workDescription`.
- Work area / site: `workArea`.
- Area boundaries and coordinates: `workAreaBoundaries`, `workAreaCoordinates`.
- Validity dates: `validFrom`, `validTo`.
- Special conditions: `specialConditions`.
- Legal basis: `legalBasis`, `legalBasisVersion`, `legalBasisEffectiveDate`.
- Document/archive readiness: `documentEnvelopeId`, `currentVersionId`, `archiveRecordId`, `retentionPolicyId`, `signedAt`, `closedAt`, `cancelledAt`, `archivedAt`.

Appendix 3 fields covered as payload/json:

- Safety measures are persisted as `ContractorAccessAct.safetyMeasures` JSON and included in the act document-version payload.
- Minimal act reference is included in WorkPermit payload as `contractorAccessAct` / `contractorAccessActSnapshot`: act number, validity period, work area, contractor organization, and contractor representative.

WorkPermit integration:

- `WorkPermit.contractorAccessActId` links permits to `ContractorAccessAct`.
- The link is optional for general MVP permits.
- For `CONTRACTOR_SITE_ACCESS`, precheck fails with a blocker when no active valid act is linked.
- Linking validates same organization, matching contractor organization, active act status, and permit dates within act validity.
- The canonical WorkPermit payload and payload hash change when the linked act reference changes.

Precheck behavior:

- `CONTRACTOR_ACCESS_ACT` passes when the linked act exists, belongs to the same organization, is `ACTIVE`, matches the permit contractor, and covers the permit effective dates.
- `CONTRACTOR_ACCESS_ACT` fails as `BLOCKER` when the act is missing for `CONTRACTOR_SITE_ACCESS`, belongs to another organization, belongs to another contractor, is inactive/closed/cancelled/archived, or does not cover permit dates.
- Checks read real `ContractorAccessAct` database records and store a real-source precheck snapshot.

Phase 3 remaining gaps:

- Full official Appendix 3 PDF layout.
- Appendix 3 signing ceremony and signature routing.
- Appendix 3 evidence package.
- Appendix 3 archive export package.
- Complex contractor chains and subcontractor hierarchies.
- Rich model for areas with active communications, adjacent lines, and intersecting hazardous zones.
- Auto-numbering for act numbers; current mode remains manual.

## Do Not Do In This Branch

- Do not create a second permit table set, second signing table set, second archive/evidence stack, or a new permit cabinet.
- Do not add new auth roles beyond `SUPER_ADMIN`, `COMPANY_ADMIN`, `SAFETY_ENGINEER`, and `EMPLOYEE_SIGNER`.
- Do not use Russian forms as legal basis for Kazakhstan.
- Do not claim all Kazakhstan high-risk work types are fully covered.
- Do not mutate signed payloads in place.
- Do not expose raw provider payloads, certificate personal data, diagnoses, secrets, or raw CMS data in browser responses or logs.

## MVP Definition Of Done

- Existing WorkPermit flow remains the only active permit flow.
- MVP work types are `GENERAL_HIGH_RISK`, `CONTRACTOR_SITE_ACCESS`, and bridge `HEIGHT_WORK`.
- Draft/update/precheck/submit/approval/prepare-sign/sign/activate/suspend/resume/close/archive are controlled through `WorkPermitsService` and the workflow state machine.
- Precheck reads real current records where models exist and stores snapshots.
- Signed payload hash is frozen before signing and remains immutable after signing.
- PDF/evidence/archive use the existing document envelope/signature/archive primitives.
- Verification passes, or failures are documented as unrelated blockers.

## P1/P2 Backlog

- Hot work specialized template and legal field set.
- Gas hazardous work specialized template and legal field set.
- Electrical work specialized template and legal field set.
- Earth work specialized template and legal field set.
- Confined space specialized template and legal field set.
- Lifting work specialized template and legal field set.
- Height work completion beyond the current MVP bridge.
- Shift handover.
- Extension flow and UI.
- Full contractor access act entity and Appendix 3 print/export.
- Persisted permit `ExportSnapshot` for generated PDF packages.
- eGov Mobile signing later through generic signing sessions, after provider documentation and callback validation are available.
