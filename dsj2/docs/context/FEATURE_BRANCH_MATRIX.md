# Feature Branch Matrix

This table summarizes lightweight routing metadata. It is not the product status snapshot.
For the current repo snapshot, read `current-product-status.md`.

MemPalace feature cards are the machine-readable source for canonical file lists.

| feature_id | title | branch_context | status | areas | canonical_files | verification | note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FEAT-P1-BRIEFING-JOURNAL | Briefing Journal Lifecycle | ABTEST-A | code_present_verification_not_run_in_hygiene_pass | api, web, database, worker | see `.mempalace/features/FEAT-P1-BRIEFING-JOURNAL.json` | not run in hygiene pass | Journal lifecycle, signing, invite, employee self-service, PDF/export routing |
| FEAT-P1-RESPONSIBILITY-ORDERS | Responsibility Orders | ABTEST-A | code_present_verification_not_run_in_hygiene_pass | api, web, database | see `.mempalace/features/FEAT-P1-RESPONSIBILITY-ORDERS.json` | not run in hygiene pass | Responsibility order registry, appointments, signing, archive/evidence routing |
| MVP-DEMO-PERSONAS-BRIEFINGS-PERMITS | Demo Personas + Briefings + Permits MVP | mvp/demo-personas-briefings-permits | step_2_complete_verified | api, web, database | see `docs/context/branches/mvp-demo-personas-briefings-permits.md` | types, api, and web typecheck passed; guarded local seed passed; current-source HTTP smoke passed for Safety Engineer, Shop Chief, Director, and Employee briefing/journal contours; full cryptographic signing smoke pending because current env is not using `MOCK_NCALAYER`; optional visual screenshot pending | Step 1 personas/hierarchy and Step 2 briefing persona flow are closed; Step 3 narrow permit flow, work report, and handover are next |
| Permit Journal / Журнал допусков | Permit Journal UI Canonical Context | PERMIT_JOURNAL_UI_CANONICAL | context_initialized | big_dsj_contour, PermitJournalModule | `docs/context/PERMIT_JOURNAL_UI_CANONICAL.md` | not run; context only | Big DSJ contour; PermitJournalModule; future implementation must follow canonical MD |

Current branch observed during branch init: `mvp/demo-personas-briefings-permits`.
Current phase mapping: P1 core is present; this branch starts a narrow P2/demo contour using online work permits core.
