# Permit Demo Smoke Checklist

## Scope

Customer-safe claim:

> Demo MVP for a general high-risk work permit workflow based on Kazakhstan
> Order No. 344 Appendices 1-3.

This checklist covers the existing WorkPermit, ContractorAccessAct, generic
signing session, PDF, evidence, audit, export snapshot, retention, and archive
paths. It does not introduce a second stack.

## Preconditions

1. Run from the `dsj2` repository root.
2. PostgreSQL is available through a local `DATABASE_URL`.
3. Prisma migrations are deployed and the client is generated.
4. API and web use the same local database and signing configuration.
5. Set encryption/hash keys required by the existing employee data model.
6. Use a disposable local database. The permit fixture is non-destructive and
   rerunnable, but it must not be used in production.

## Environment

Required for the fixture:

```text
DATABASE_URL=postgresql://...
NODE_ENV=development
FIELD_ENCRYPTION_KEY=<local value>
FIELD_HASH_PEPPER=<local value>
PERMIT_DEMO_SEED_ENABLED=true
PERMIT_DEMO_USER_PASSWORD=<local password>
PERMIT_DEMO_USER_EMAIL=permit.demo@dsj.local
```

Required for the local mock signing path:

```text
SIGNING_PROVIDER=MOCK_NCALAYER
SIGNING_TEST_MODE=true
SIGNING_PROVIDER_DEFAULT=MOCK_PROVIDER
SIGNING_MOCK_ENABLED=true
SIGNING_REQUIRE_LEGAL_PROVIDER_IN_PROD=true
```

Use the existing NCALayer variables instead when demonstrating NCALayer. Do
not enable mock signing in a production contour.

Prepare the fixture:

```powershell
corepack pnpm db:generate
$env:PERMIT_DEMO_SEED_ENABLED="true"
$env:PERMIT_DEMO_USER_PASSWORD="<local password>"
corepack pnpm db:seed:permit-demo
```

The script prints the deterministic organization, employee, contractor,
worker, work-site, and fallback active act identifiers.

## Login

- Email: `PERMIT_DEMO_USER_EMAIL`, default `permit.demo@dsj.local`
- Password: `PERMIT_DEMO_USER_PASSWORD`
- Role: `SAFETY_ENGINEER`

For a reliable single-login demo, assign `Permit Demo Safety Engineer` as:

- permit issuer;
- responsible manager;
- work producer;
- admitter.

This is a demo shortcut that satisfies the current assigned-participant
authorization rules. Explain that production duties should be assigned to the
actual responsible people.

## Happy Path

1. Open `/permits`.
   Expected: Appendix 2 journal screen loads; CSV/PDF exports and Appendix 3
   navigation are visible.

2. Open `/permits/contractor-access-acts`.
   Expected: existing fallback act `PDM-ACT-READY-001` is visible. The draft
   form is available.

3. Create a new ContractorAccessAct draft.
   Use the demo contractor, representative, workshop, host representative,
   valid dates covering the planned permit, work area, and safety measures.
   Expected: status `DRAFT`; legal basis/version are server-set.

4. Activate the new act.
   Expected: status `ACTIVE`; the act becomes selectable on the permit form.
   Keep `PDM-ACT-READY-001` as a fallback if time is limited.

5. Create a `CONTRACTOR_SITE_ACCESS` permit, or `GENERAL_HIGH_RISK` when the
   customer presentation focuses on Appendix 1.
   Use unique numbers such as `PDM-WP-<date>-01` and `PDM-J-<date>-01`.
   Select the demo workshop, contractor, representative, active act, actor for
   all four workflow assignments, observer, internal crew member, and
   contractor brigade member.

6. Complete the Appendix 1 fields.
   Include workplace, object/equipment, work description, hazards, safety
   measures, workplace preparation, safety-measure executors, isolation,
   fencing/signs, fire safety, target briefing text/time/instructor, PPE
   requirements, admission details, and crew acknowledgement checkbox.

7. Select evidence.
   Select completed training and signed briefing records for assigned internal
   participants, active qualification/medical records for selected subjects,
   and PPE records for the internal and contractor crew members. Do not enter
   diagnosis or medical details.

8. Save the draft.
   Expected: detail page shows `DRAFT / not legally signed`; edit remains
   available and PDF preview is marked unsigned.

9. Run precheck.
   Expected: overall `PASS`, zero blockers, and any remaining unsupported
   requirement-matrix gaps shown as warnings. A blocker must be fixed rather
   than bypassed.

10. Submit.
    Expected: status `pending_approval`; four approval route rows exist.

11. Confirm and approve.
    Expected: work producer step becomes `CONFIRMED`, responsible manager step
    becomes `APPROVED`, permit status becomes `approved`.

12. Prepare sign.
    Expected: permit and envelope become `SIGNING_READY`; current document
    version is `FINAL`; `signedPayloadHash` equals the frozen payload hash.

13. Sign through the configured provider.
    For mock mode, enter synthetic signer data only. Expected: signing session
    completes, signature/evidence records are created, status becomes `signed`.

14. Activate.
    Expected: activation succeeds only while the latest precheck is `PASS` and
    its payload hash still matches; status becomes `active`.

15. Close.
    Enter work result and workplace inspection result. Expected: status
    `closed`; closure payload hash and audit event exist.

16. Download Appendix 1 PDF.
    Expected: non-empty PDF containing permit/journal numbers, workplace,
    work description, responsible people, crew, contractor act, controls,
    precheck summary, signature summary, closure, and version/hash metadata.

17. Download Appendix 2 PDF and CSV from `/permits`.
    Expected: the permit row includes registration, admission, issuer, work,
    workplace, status, validity, close, archive, and retention fields.

18. Download evidence JSON.
    Expected: permit/version hashes, latest precheck, signature summary, audit
    events, linked contractor act, closure, exports, and `containsDiagnosis:
false`. Raw CMS/provider payloads and diagnosis must not appear.

19. Attempt archive before close in a separate active permit.
    Expected: rejected with a clear lifecycle error.

20. Archive the closed permit.
    Expected: status `archived`; a final PDF ExportSnapshot exists and the
    ArchiveRecord uses the evidence manifest hash.

21. Open the audit page.
    Expected: meaningful create, precheck, submit, confirm, approve,
    signing-prepared, signed, activate, close, PDF/evidence, and archive events.

## Known Limitations

- Appendix 1 is an operational MVP layout, not pixel-perfect official
  bilingual KZ/RU reproduction.
- Appendix 2 PDF/CSV is an MVP export, not the final official XLSX package.
- Appendix 3 has entity/lifecycle/linking support but no final print/sign
  package.
- Mock signing is demo/test only. NCALayer legal readiness depends on the
  deployed provider, certificates, and legal review.
- Crew acknowledgement is a payload status, not a crew legal-signature
  ceremony.
- Specialized hot, gas, electrical, earth, confined-space, lifting, and full
  height-work templates are not production-ready.
- Long-term OCSP/CRL validation, durable binary object storage, and strict
  external PDF/A conformance validation remain backlog items.

## Customer Talking Points

- One traceable workflow links Appendix 3 contractor access to the Appendix 1
  permit and Appendix 2 journal.
- Precheck uses current employee, contractor, training, briefing,
  qualification, medical-clearance, PPE, and document records.
- Signing freezes the payload hash; activation checks the current PASS
  precheck hash.
- PDF, evidence, audit, export snapshot, retention, and archive reuse the
  canonical platform stack.
- Medical evidence is status-only in this flow and excludes diagnosis.

## Red Flags / Do Not Claim

- Do not claim full coverage of all Kazakhstan work permits.
- Do not claim legal completeness for every hazardous work type.
- Do not claim every paper form can be replaced without legal review.
- Do not present specialized work templates as production-ready.
- Do not present mock signing as a legally qualified production signature.
- Do not claim certified PDF/A-1 conformance from the internal format enum.
