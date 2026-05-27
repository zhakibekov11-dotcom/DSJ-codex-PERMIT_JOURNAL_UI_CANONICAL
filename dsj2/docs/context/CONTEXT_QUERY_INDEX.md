# Context Query Index

Use this as a lightweight router. It is not a product spec.

## Query Patterns

- Need docs navigation hub: open `docs/context/README.md`
- Need repo operating model: open `docs/context/repo-context-operating-system.md`
- Need current product snapshot: open `docs/context/current-product-status.md`
- Need execution phase definitions: open `docs/context/execution-phases-p0-p4.md`
- Need Codex start checklist: open `docs/context/start-here-for-codex.md`
- Need feature context: open `.mempalace/features/<feature>.json`
- Need branch metadata: open `.mempalace/branches.json`, `docs/context/FEATURE_BRANCH_MATRIX.md`, and the matching `docs/context/branches/*.md` file when present
- Need area routing: open the nearest area `AGENTS.md`, then the area README when present
- Need Permit Journal / Журнал допусков context for journal permits, permit journal, журнал допусков, наряд-допуск, акт-допуск подрядчика, PermitEntry, PermitJournal, допуск подрядчика, precheck допуска, ЭЦП evidence допуска, or audit trail допуска: open `docs/context/PERMIT_JOURNAL_UI_CANONICAL.md`, then `.mempalace/branches/PERMIT_JOURNAL_UI_CANONICAL.json`, `docs/branches/PERMIT_JOURNAL_UI_CANONICAL-brief.md`, and `docs/branches/PERMIT_JOURNAL_UI_CANONICAL-plan.md`

## Loading Policy

- L0: `.mempalace/index.json`
- L1: `.mempalace/areas.json` and `.mempalace/branches.json`
- L2: matching feature card
- L3: nearest area `AGENTS.md` and README when present
- L4: only canonical files needed for the task

## Never Load By Default

- logs
- caches
- generated runtime dumps
- Playwright CLI transient captures
- Next build output
- temp folders
- Python bytecode
- historical notes not linked from a feature card or task
