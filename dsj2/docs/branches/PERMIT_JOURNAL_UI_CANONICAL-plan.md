# PERMIT_JOURNAL_UI_CANONICAL — Execution Scope

## Single execution scope

Будущая реализация на этой ветке должна добавить модуль Permit Journal как единый интерфейсный и системный контур, опирающийся на docs/context/PERMIT_JOURNAL_UI_CANONICAL.md.

Scope включает:

- навигацию "Журнал допусков";
- страницы /permits и связанные detail/workflow pages;
- канонические enum values;
- форму PermitEntry;
- таблицу списка;
- фильтры;
- lifecycle статусы;
- precheck rules;
- check snapshots;
- legal basis selector;
- edit lock rules;
- signature payload;
- PermitSignature / evidence;
- archive requirements;
- audit events;
- API contracts draft;
- MVP/P1/P2 boundary.

## Non-goals

- Не писать отраслевые формы для газа, энергетики, шахт, трубопроводов, химии, металлургии в MVP.
- Не создавать универсальную "госформу" Журнал допусков.
- Не заменять существующие instruction journals.
- Не ломать сертификаты, обучение, тестирование, документы, подрядчиков и аудит.
- Не удалять существующие маршруты.
- Не делать широкий refactor.

## Required source of truth

Codex должен открыть и использовать:

1. AGENTS.md
2. .mempalace/index.json
3. .mempalace/branches/PERMIT_JOURNAL_UI_CANONICAL.json
4. docs/branches/PERMIT_JOURNAL_UI_CANONICAL-brief.md
5. docs/branches/PERMIT_JOURNAL_UI_CANONICAL-plan.md
6. docs/context/PERMIT_JOURNAL_UI_CANONICAL.md
7. relevant app/package AGENTS
8. existing modules for Employees, Contractors, Certificates, Training, Testing, Documents, Audit, Signatures

## Acceptance criteria for future implementation

Будущая реализация считается корректной только если:

- все enum values соответствуют canonical file;
- все UI labels на русском;
- legal basis selector использует только зафиксированные документы;
- precheck rules реализованы без выдумывания;
- snapshots сохраняют состояние документов на момент допуска;
- medical snapshot не хранит диагнозы;
- signed payload отделён от PDF;
- approved/active/closed/archived имеют корректные edit locks;
- audit trail фиксирует lifecycle transitions;
- archive сохраняет final snapshot, signatures, approvals, prechecks, attachments, closure, legal basis snapshot и retentionUntil;
- P1/P2 отраслевые шаблоны не попали в MVP.
