# Permit Journal UI Canonical Context

**File purpose:** this Markdown document is the canonical UI/data/legal source-of-truth for implementing the module **“Журнал допусков / Permit Journal”** in the B2B SaaS platform **“Цифровой журнал по ТБ”** for Kazakhstan.

This document is based on the provided Adilet-oriented legal/product research and is intended to be attached to Codex prompts so that implementation does not invent fields, categories, statuses, dropdowns, labels, legal basis, or workflow.

**Canonical path in repo:** `docs/context/PERMIT_JOURNAL_UI_CANONICAL.md`

**Hard rule:** this is not a broad legal research memo. This is a practical implementation context for UI/backend/frontend work.

---

## Legal/Product Levels

Every relevant field, status, check, screen, category, UI text, or workflow element should be interpreted through one of these levels:

| Level | Meaning |
|---|---|
| `DIRECT_LEGAL_REQUIREMENT` | The requirement directly follows from a normative act. |
| `FORM_FROM_ADILET` | The field/form/journal is taken from an approved form or appendix found in the Adilet-oriented research. |
| `DERIVED_COMPLIANCE_LOGIC` | Required for a digital compliance system, but not a direct state form by itself. |
| `PRODUCT_RECOMMENDATION` | Useful product behavior, not a legal obligation. |

If there is uncertainty, use `DERIVED_COMPLIANCE_LOGIC` and leave a short comment.

---

# 1. Product Position

- Universal state form **“Журнал допусков”** as one single official document for every case was **not identified** in the Adilet-oriented research.
- `Permit Journal / Журнал допусков` is a **digital umbrella journal** over multiple normative and compliance processes:
  - наряд-допуск на работы повышенной опасности;
  - журнал учёта выдачи нарядов-допусков;
  - акт-допуск подрядчика;
  - допуск после инструктажа;
  - допуск после обучения и проверки знаний;
  - допуск по медосмотру;
  - допуск по удостоверению/квалификации;
  - допуск по СИЗ;
  - допуск к электроустановкам, работам на высоте, огневым, газоопасным и другим работам.
- UI may use: **“Журнал допусков”**.
- Page title should preferably use: **“Журнал допусков и нарядов”**.
- Internal architecture must use: `PermitJournal`, `PermitEntry`, `PermitJournalModule`.
- Main MVP scenario: **наряд-допуск на работы повышенной опасности**.
- Second important MVP scenario: **contractor access / акт-допуск подрядчика**.
- Admission after training, briefing, medical exam, PPE, and certificates are **blocking prechecks** before an active permit.
- Do not build “the perfect system for every dangerous work type in Kazakhstan” in MVP.
- Industry-specific forms for gas, energy, mines, pipelines, and industrial facilities belong to P1/P2 unless explicitly requested.

---

# 2. Legal Basis Registry

| Key | Направление | Документ | Номер/дата | Adilet ID / URL marker | Что даёт интерфейсу | MVP/P1/P2 | Level |
|---|---|---|---|---|---|---|---|
| `HIGH_RISK_PERMIT_RULES_344` | Работы повышенной опасности | Правила оформления и применения нарядов-допусков при производстве работ в условиях повышенной опасности | Приказ МТСЗН РК № 344 от 28.08.2020 | `V2000021151` | Центральный документ для `PermitEntry`, `PermitJournal`, регистрации, срока действия, электронного ведения, хранения закрытых нарядов | MVP | `DIRECT_LEGAL_REQUIREMENT` / `FORM_FROM_ADILET` |
| `BIOT_TRAINING_BRIEFING_1019` | БиОТ / обучение / инструктаж | Правила и сроки проведения обучения, инструктирования и проверок знаний по вопросам безопасности и охраны труда | Приказ МЗСР РК № 1019 от 25.12.2015 | `V1500012665` | Блокирующие проверки: обучение, инструктаж, проверка знаний; формы журналов | MVP | `DIRECT_LEGAL_REQUIREMENT` / `FORM_FROM_ADILET` |
| `LABOR_CODE_KZ` | Трудовое право / БиОТ | Трудовой кодекс РК | Кодекс РК от 23.11.2015 № 414-V | `K1500000414` | Общая правовая основа обязательности БиОТ-процессов | MVP | `DIRECT_LEGAL_REQUIREMENT` |
| `FIRE_SAFETY_RULES` | Пожарная безопасность | Правила пожарной безопасности | Приказ МЧС РК № 55 от 21.02.2022 | `V2200026867` | Основание для fire-related checks, огневых работ, эксплуатационных журналов | P1 | `DIRECT_LEGAL_REQUIREMENT` |
| `FIRE_TRAINING_RULES` | Пожарное обучение | Правила обучения работников организаций и населения мерам пожарной безопасности | Приказ от 09.06.2014 | `V1400009510` | Противопожарный инструктаж, ПТМ, протокол, удостоверение; связь с training/testing/certificates | MVP/P1 | `DIRECT_LEGAL_REQUIREMENT` / `FORM_FROM_ADILET` |
| `HEIGHT_WORK_RULES` | Работы на высоте | Правила по обеспечению безопасности и охраны труда при работе на высоте | Приказ от 31.03.2022 | `V2200027349` | `PermitWorkType = HEIGHT_WORK`; работы осуществляются по наряду-допуску | MVP/P1 | `DIRECT_LEGAL_REQUIREMENT` |
| `ELECTRICAL_CONSUMER_RULES` | Электробезопасность | Правила техники безопасности при эксплуатации электроустановок потребителей | Приказ Министра энергетики РК от 19.03.2015 № 222 | `V1500010889` | Наряд-допуск, группы электробезопасности, удостоверения, журнал нарядов | P1 | `DIRECT_LEGAL_REQUIREMENT` / `FORM_FROM_ADILET` |
| `ELECTRICAL_INSTALLATION_RULES` | Электроустановки | Правила техники безопасности при эксплуатации электроустановок | Приказ Министра энергетики РК № 253 от 31.03.2015 | `V1500010907` | Допуск в наряде и журнале работ по нарядам/распоряжениям или электронным документом | P1 | `DIRECT_LEGAL_REQUIREMENT` / `FORM_FROM_ADILET` |
| `INDUSTRIAL_SAFETY_MINERALS` | Промышленная безопасность | Правила обеспечения промышленной безопасности для ОПО по переработке твёрдых полезных ископаемых | Приказ МИР РК № 348 от 30.12.2014 + изменения 2023 | `V1400010258` / `V2300031718` | Модель подрядного допуска: опасные факторы, границы участка, безопасное производство работ | MVP/P1 | `DIRECT_LEGAL_REQUIREMENT` |
| `GAS_SUPPLY_SAFETY` | Газоопасные работы | Требования безопасности объектов систем газоснабжения | Adilet marker from research | `V1700015986` | Газоопасные работы, журнал регистрации нарядов-допусков, продление | P1 | `DIRECT_LEGAL_REQUIREMENT` / `FORM_FROM_ADILET` |
| `MAIN_GAS_PIPELINES` | Магистральные трубопроводы | Правила эксплуатации магистральных газопроводов | Adilet marker from research | `V1500010363` | Огневые и газоопасные работы, регистрация нарядов, закрытие наряда после осмотра | P1/P2 | `DIRECT_LEGAL_REQUIREMENT` / `FORM_FROM_ADILET` |
| `MEDICAL_EXAMS` | Медосмотры | Целевые группы лиц, подлежащих обязательным медицинским осмотрам, правила и периодичность | Приказ № ҚР ДСМ-131/2020 от 15.10.2020 | `V2000021443` | Блокирующая проверка `medicalExam.valid`; не хранить диагнозы | MVP | `DIRECT_LEGAL_REQUIREMENT` |
| `PPE_NORMS` | СИЗ | Нормы выдачи специальной одежды и других СИЗ | Приказ МЗСР РК № 943 от 08.12.2015 | `V1500012627` | Проверка `ppe.issued` перед опасными работами | MVP | `DIRECT_LEGAL_REQUIREMENT` |
| `E_DOCUMENT_E_SIGNATURE_LAW` | ЭДО / ЭЦП | Закон “Об электронном документе и электронной цифровой подписи” | Закон РК № 370-II от 07.01.2003 | `Z030000370_` | Основа для подписи/evidence; нельзя утверждать универсальную безбумажность для всех случаев | MVP | `DIRECT_LEGAL_REQUIREMENT` |
| `DIGITAL_CODE_KZ` | Цифровой кодекс | Цифровой кодекс РК | Кодекс от 09.01.2026 | `K2600000255` | Требует хранить `legalBasisVersion`, `legalBasisEffectiveDate`; переходный риск по ЭДО/ЭЦП | MVP/P1 | `DIRECT_LEGAL_REQUIREMENT` |
| `DOCUMENT_MANAGEMENT_RULES_236` | Документирование / архив | Правила документирования, управления документацией и использования систем ЭДО в гос. и негос. организациях | Приказ МКС РК № 236 от 25.08.2023 | `V2300033339` | Реквизиты, документооборот, ЭДО, архивная дисциплина, evidence | MVP | `DIRECT_LEGAL_REQUIREMENT` |
| `RETENTION_PERIODS` | Типовые сроки хранения | Перечень типовых документов со сроками хранения | Markers from research | `V1700015997` / `G25JC000279` | Архивный слой; нельзя хардкодить один срок для всех документов | MVP/P1 | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` |

---

# 3. UI Navigation

## Main menu item

| Property | Value |
|---|---|
| UI label | `Журнал допусков` |
| Internal route | `/permits` |
| Internal module | `PermitJournalModule` |
| Main page title | `Журнал допусков и нарядов` |
| Internal entities | `PermitJournal`, `PermitEntry` |
| Level | `PRODUCT_RECOMMENDATION` |

## Allowed alternative UI names

- `Допуски и наряды`
- `Наряды-допуски`
- `Журнал допусков`

## Recommendation

- Left sidebar: **“Журнал допусков”**.
- Inside page title: **“Журнал допусков и нарядов”**.
- Code/module naming: `PermitJournal`, `PermitEntry`, `PermitJournalModule`.

---

# 4. Pages

| Route | UI title | Purpose | MVP/P1/P2 | Notes |
|---|---|---|---|---|
| `/permits` | Журнал допусков и нарядов | Main list of permit records, filters, statuses, actions | MVP | Shows table, filters, bulk indicators, archive state |
| `/permits/new` | Создать допуск | Create `PermitEntry` draft | MVP | Uses form blocks from section 6 |
| `/permits/[id]` | Карточка допуска | Read detail page for one permit | MVP | Shows all fields, status timeline, checks, signatures, evidence |
| `/permits/[id]/edit` | Редактировать допуск | Edit while allowed by status | MVP | Disabled after `approved` for signed fields |
| `/permits/[id]/precheck` | Проверка перед допуском | Run/inspect precheck rules | MVP | Shows blocking and non-blocking checks |
| `/permits/[id]/approvals` | Согласования | Approval workflow | MVP | Shows responsible persons, approval status, rejection reason |
| `/permits/[id]/signatures` | Подписи и ЭЦП evidence | Sign and inspect signature evidence | MVP | Shows normalized signed payload hash and signer metadata |
| `/permits/[id]/closure` | Закрытие допуска | Close active permit after work completion | MVP | Requires closure data and responsible confirmation |
| `/permits/[id]/audit` | Журнал действий | Audit trail for lifecycle events | MVP | Read-only, exportable |
| `/contractors/[id]/access` | Допуски подрядчика | Contractor-specific access and permits | MVP | Preserves contractor fields and work zone boundaries |
| `/employees/[id]/permits` | Допуски сотрудника | Employee-specific permit history | MVP | Useful for employee card integration |

## Data locked after `approved`

After `approved`, these must not be changed directly:

- `workType`
- `crewMemberIds`
- `startAt`
- `endAt`
- `hazardFactors`
- `safetyMeasures`
- `responsibleManagerId`
- `workProducerId`
- `issuerId`
- `admitterId`
- `legalBasis`
- `checkSnapshots`
- `signedPayloadHash`
- `documentVersionHash`

Any change after `approved` requires one of:

- new version;
- cancellation and new draft;
- P1 extension/repeated admission mechanics.

---

# 5. Main List Page: `/permits`

## Required table columns

| Column | Source field | Level | Notes |
|---|---|---|---|
| № записи | `journalRegistrationNumber` | `FORM_FROM_ADILET` | Journal registration number |
| № наряда-допуска | `permitNumber` | `FORM_FROM_ADILET` | Permit/order number |
| Тип допуска | `permitType` | `DERIVED_COMPLIANCE_LOGIC` | Dropdown from `PermitType` |
| Вид работ | `workType` | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` | Dropdown from `PermitWorkType` |
| Компания / объект | `companyId`, `workZoneId` | `PRODUCT_RECOMMENDATION` | Company/object context |
| Подразделение | `departmentId` | `DERIVED_COMPLIANCE_LOGIC` | Scope and responsibility |
| Место работ | `workplace` | `FORM_FROM_ADILET` | Work location |
| Подрядчик | `contractorId` | `DERIVED_COMPLIANCE_LOGIC` | Empty for employee-only permits |
| Ответственный руководитель | `responsibleManagerId` | `FORM_FROM_ADILET` | Responsible manager |
| Производитель работ | `workProducerId` | `FORM_FROM_ADILET` | Work producer |
| Дата начала | `startAt` | `FORM_FROM_ADILET` | Start date/time |
| Дата окончания | `endAt` | `FORM_FROM_ADILET` | End date/time |
| Статус | `status` | `DERIVED_COMPLIANCE_LOGIC` | `PermitStatus` |
| Проверки | `precheckSummary` | `DERIVED_COMPLIANCE_LOGIC` | Aggregated precheck status |
| Подписи | `signatureStatus` | `DERIVED_COMPLIANCE_LOGIC` | Signature/evidence status |
| Архив | `archivedAt`, `retentionUntil` | `DERIVED_COMPLIANCE_LOGIC` | Archive status and retention |

## Filters

- Тип допуска
- Вид работ
- Статус
- Подразделение
- Подрядчик
- Ответственный
- Дата начала
- Дата окончания
- Только просроченные
- Только с недостающими документами
- Только активные
- Только архивные

## Actions

| Action | Allowed statuses | Result / endpoint | Level |
|---|---|---|---|
| Создать допуск | n/a | `POST /api/permits` -> `draft` | `PRODUCT_RECOMMENDATION` |
| Открыть | all | `GET /api/permits/:id` | `PRODUCT_RECOMMENDATION` |
| Редактировать | `draft`, `missing_documents`, `rejected` | `PATCH /api/permits/:id` | `PRODUCT_RECOMMENDATION` |
| Запустить precheck | `draft`, `missing_documents`, `rejected` | `POST /api/permits/:id/precheck` | `DERIVED_COMPLIANCE_LOGIC` |
| Отправить на согласование | `draft`, `missing_documents` after passed precheck | `POST /api/permits/:id/submit` -> `pending_approval` | `DERIVED_COMPLIANCE_LOGIC` |
| Подписать | `approved`, `pending_approval` where signer assigned | `POST /api/permits/:id/sign` | `DERIVED_COMPLIANCE_LOGIC` |
| Активировать | `approved` | `POST /api/permits/:id/activate` -> `active` | `DERIVED_COMPLIANCE_LOGIC` |
| Приостановить | `active` | `POST /api/permits/:id/suspend` -> `suspended` | `DERIVED_COMPLIANCE_LOGIC` |
| Закрыть | `active`, `suspended` if closure allowed | `POST /api/permits/:id/close` -> `closed` | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` |
| Архивировать | `closed`, `cancelled`, `expired` | `POST /api/permits/:id/archive` -> `archived` | `DERIVED_COMPLIANCE_LOGIC` |
| Экспорт PDF | all except pure empty draft | `GET /api/permits/:id/pdf` | `PRODUCT_RECOMMENDATION` |

---

# 6. Create/Edit Form Structure

| Block | UI fields | Input type | Required | Dropdown values / source | Level | Comment |
|---|---|---|---|---|---|---|
| 1. Основная информация | `permitNumber`, `journalRegistrationNumber`, `companyId`, `departmentId`, `status` | text, readonly, select | Yes | Company, Department, `PermitStatus` | `FORM_FROM_ADILET` / `PRODUCT_RECOMMENDATION` | `status` is usually system-controlled |
| 2. Тип допуска и вид работ | `permitType`, `workType` | select | Yes | `PermitType`, `PermitWorkType` | `DERIVED_COMPLIANCE_LOGIC` | Main branching for UI and precheck |
| 3. Место и зона работ | `workplace`, `workZoneId` | text, select/map/list | Yes | WorkZone registry | `FORM_FROM_ADILET` / `DERIVED_COMPLIANCE_LOGIC` | For contractors/OPO preserve zone boundaries |
| 4. Сроки | `startAt`, `endAt`, `validUntil` | datetime | Yes | n/a | `FORM_FROM_ADILET` / `DERIVED_COMPLIANCE_LOGIC` | Validate `startAt < endAt` |
| 5. Участники и ответственные | `issuerId`, `responsibleManagerId`, `workProducerId`, `admitterId`, `observerId` | employee/user select | Yes by type | Employee/User registry | `FORM_FROM_ADILET` | Roles depend on work type |
| 6. Бригада / сотрудники | `crewMemberIds` | multi-select | Yes | Employees/ContractorEmployees | `FORM_FROM_ADILET` / `DERIVED_COMPLIANCE_LOGIC` | Must not be empty before approval |
| 7. Подрядчик, если есть | `contractorId`, `contractorRepresentativeId` | select | If contractor | Contractors registry | `DERIVED_COMPLIANCE_LOGIC` | Required for `CONTRACTOR_ACCESS` |
| 8. Опасные факторы | `hazardFactors` | tags/multi-select/json | Yes | `HazardFactor` registry | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` | Especially important for OPO and contractors |
| 9. Меры безопасности | `safetyMeasures` | textarea/checklist | Yes | template text + manual | `FORM_FROM_ADILET` | Signed field |
| 10. СИЗ | `ppeRequirements`, `ppeIssuedSnapshot` | checklist/snapshot | Yes for risky works | PPE norms/status | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` | Store snapshot at approval/signing |
| 11. Проверки перед допуском | `trainingCheckSnapshot`, `briefingCheckSnapshot`, `certificateCheckSnapshot`, `medicalCheckSnapshot`, `requiredDocumentSnapshot` | generated status cards | Yes before approval | Existing modules | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` | Do not manually fake snapshots |
| 12. Вложения | `attachments` | file upload/list | Optional/by type | Documents | `DERIVED_COMPLIANCE_LOGIC` | Schemes, scans, photos, gas analysis, contractor docs |
| 13. Нормативное основание | `legalBasis`, `legalBasisVersion`, `legalBasisEffectiveDate` | multi-select + readonly metadata | Yes | Legal basis registry | `DERIVED_COMPLIANCE_LOGIC` | Required before submission |
| 14. Подписи и согласования | `approvalStatus`, `signatureStatus`, `PermitApproval`, `PermitSignature` | workflow cards | Yes for approval/signing | Participant roles | `DERIVED_COMPLIANCE_LOGIC` | Do not treat PDF as source of truth |
| 15. Закрытие допуска | `closure` | closure form | Required for `closed` | Closure model | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` | Includes result, comments, inspection, closing signatures |
| 16. Архив и evidence | `archivedAt`, `retentionUntil`, evidence artifacts | readonly | Required after archive | Archive settings | `DERIVED_COMPLIANCE_LOGIC` | Retention depends on document type |

---

# 7. PermitType Dropdown

```ts
enum PermitType {
  HIGH_RISK_WORK
  CONTRACTOR_ACCESS
  SELF_WORK_ADMISSION
  AFTER_BRIEFING_ADMISSION
  AFTER_TRAINING_ADMISSION
  MEDICAL_BASED_ADMISSION
  PPE_BASED_ADMISSION
}
```

| Enum | UI label | Description | MVP/P1/P2 | Level |
|---|---|---|---|---|
| `HIGH_RISK_WORK` | Наряд-допуск на работы повышенной опасности | Main permit-order process for dangerous work | MVP | `DIRECT_LEGAL_REQUIREMENT` / `FORM_FROM_ADILET` |
| `CONTRACTOR_ACCESS` | Допуск подрядчика / акт-допуск | Contractor/site/object access scenario | MVP | `DERIVED_COMPLIANCE_LOGIC` |
| `SELF_WORK_ADMISSION` | Допуск к самостоятельной работе | Employee admission to independent work after required checks | MVP | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` |
| `AFTER_BRIEFING_ADMISSION` | Допуск после инструктажа | Admission linked to briefing/instruction journals | MVP | `DIRECT_LEGAL_REQUIREMENT` / `FORM_FROM_ADILET` |
| `AFTER_TRAINING_ADMISSION` | Допуск после обучения и проверки знаний | Admission after training and knowledge check | MVP | `DIRECT_LEGAL_REQUIREMENT` |
| `MEDICAL_BASED_ADMISSION` | Допуск по медосмотру | Admission constrained by medical exam status | MVP | `DIRECT_LEGAL_REQUIREMENT` |
| `PPE_BASED_ADMISSION` | Допуск по СИЗ | Admission constrained by issued PPE | MVP | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` |

Do not add new `PermitType` values in MVP without explicit instruction.

---

# 8. PermitWorkType Dropdown

```ts
enum PermitWorkType {
  GENERAL_HIGH_RISK
  HEIGHT_WORK
  HOT_WORK
  GAS_HAZARDOUS_WORK
  ELECTRICAL_WORK
  EARTH_WORK
  CONFINED_SPACE
  LIFTING_WORK
  CONTRACTOR_SITE_ACCESS
}
```

| Enum | UI label | Used with PermitType | MVP/P1/P2 | Legal basis | Level |
|---|---|---|---|---|---|
| `GENERAL_HIGH_RISK` | Общие работы повышенной опасности | `HIGH_RISK_WORK` | MVP | `V2000021151` | `DIRECT_LEGAL_REQUIREMENT` / `FORM_FROM_ADILET` |
| `HEIGHT_WORK` | Работы на высоте | `HIGH_RISK_WORK` | MVP/P1 bridge | `V2200027349` | `DIRECT_LEGAL_REQUIREMENT` |
| `HOT_WORK` | Огневые работы | `HIGH_RISK_WORK` | P1 | `V2200026867`, `V1500010363` | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` |
| `GAS_HAZARDOUS_WORK` | Газоопасные работы | `HIGH_RISK_WORK` | P1 | `V1700015986`, `V1500010363` | `DIRECT_LEGAL_REQUIREMENT` / `FORM_FROM_ADILET` |
| `ELECTRICAL_WORK` | Работы в электроустановках | `HIGH_RISK_WORK` | P1 | `V1500010889`, `V1500010907` | `DIRECT_LEGAL_REQUIREMENT` / `FORM_FROM_ADILET` |
| `EARTH_WORK` | Земляные работы | `HIGH_RISK_WORK` | P1 | Derived from electrical/industrial safety contexts | `DERIVED_COMPLIANCE_LOGIC` |
| `CONFINED_SPACE` | Работы в замкнутом пространстве | `HIGH_RISK_WORK` | P1 | Industrial safety contexts | `DERIVED_COMPLIANCE_LOGIC` |
| `LIFTING_WORK` | Грузоподъёмные работы | `HIGH_RISK_WORK` | P1/P2 | Industrial safety / qualification logic | `DERIVED_COMPLIANCE_LOGIC` |
| `CONTRACTOR_SITE_ACCESS` | Допуск подрядчика на территорию / объект | `CONTRACTOR_ACCESS` | MVP | OPO/contractor access logic from research | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` |

## MVP allowed work types

- `GENERAL_HIGH_RISK`
- `CONTRACTOR_SITE_ACCESS`
- `HEIGHT_WORK` as optional MVP/P1 bridge

## P1 work types

- `HOT_WORK`
- `GAS_HAZARDOUS_WORK`
- `ELECTRICAL_WORK`
- `EARTH_WORK`
- `CONFINED_SPACE`
- `LIFTING_WORK`

---

# 9. PermitStatus

```ts
enum PermitStatus {
  draft
  pending_precheck
  missing_documents
  pending_approval
  approved
  active
  suspended
  extended
  closed
  rejected
  cancelled
  expired
  archived
}
```

| Status | UI label | Meaning | Who can set | Editable? | Audit event | Level |
|---|---|---|---|---|---|---|
| `draft` | Черновик | Permit record is created but not checked | Author / БиОТ / responsible user | Full editing | `PERMIT_DRAFT_CREATED` | `PRODUCT_RECOMMENDATION` |
| `pending_precheck` | На проверке документов | Precheck is running or waiting | Author / system | Limited editing | `PRECHECK_STARTED` | `DERIVED_COMPLIANCE_LOGIC` |
| `missing_documents` | Не хватает документов | Precheck failed due to missing/invalid data | System / БиОТ | Can fix missing documents/data | `PRECHECK_FAILED` | `DERIVED_COMPLIANCE_LOGIC` |
| `pending_approval` | На согласовании | All prechecks passed, approval requested | System after submit | No direct editing of key fields | `APPROVAL_REQUESTED` | `DERIVED_COMPLIANCE_LOGIC` |
| `approved` | Согласован | Responsible parties approved/signed as required | Assigned approvers | Signed payload locked | `PERMIT_APPROVED` | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` |
| `active` | Активен | Work admission is active | Admitter / authorized role | Key fields locked | `PERMIT_ACTIVATED` | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` |
| `suspended` | Приостановлен | Work admission paused due to violation/risk/missing valid document | БиОТ / ПБ / responsible manager | Only reason/resolution fields | `PERMIT_SUSPENDED` | `DERIVED_COMPLIANCE_LOGIC` |
| `extended` | Продлён | Permit was extended where applicable | Issuer / responsible manager | Only extension block | `PERMIT_EXTENDED` | `DIRECT_LEGAL_REQUIREMENT` for some types / `DERIVED_COMPLIANCE_LOGIC` |
| `closed` | Закрыт | Work is completed and permit closed | Work producer / responsible manager / issuer | Read-only | `PERMIT_CLOSED` | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` |
| `rejected` | Отклонён | Approval rejected | Approver | Can create new draft/revise if allowed | `PERMIT_REJECTED` | `DERIVED_COMPLIANCE_LOGIC` |
| `cancelled` | Отменён | Work cancelled before start or by authorized role | Author / responsible manager | Read-only after cancellation | `PERMIT_CANCELLED` | `PRODUCT_RECOMMENDATION` |
| `expired` | Истёк | End date passed without valid closure/extension | System | Read-only except close/archive workflow | `PERMIT_EXPIRED` | `DERIVED_COMPLIANCE_LOGIC` |
| `archived` | В архиве | Permit and evidence archived | System / archivist | Read-only | `PERMIT_ARCHIVED` | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` |

## Status constraints

- After `approved`, do not change signed payload.
- After `active`, do not change key admission conditions.
- `closed` and `archived` are read-only.
- `extended` may exist in enum in MVP, but the full extension UI can remain P1.

---

# 10. Core PermitEntry Fields

| Field | UI label | Type | Required | Input component | Dropdown source | Level | Notes |
|---|---|---|---|---|---|---|---|
| `id` | ID | UUID | Yes | readonly | n/a | `PRODUCT_RECOMMENDATION` | Technical ID |
| `tenantId` | Tenant ID | UUID | Yes | hidden | n/a | `PRODUCT_RECOMMENDATION` | Multi-tenant isolation |
| `companyId` | Компания | UUID | Yes | select | Companies | `PRODUCT_RECOMMENDATION` | Company scope |
| `journalId` | Журнал | UUID | Yes | hidden/select | PermitJournal | `DERIVED_COMPLIANCE_LOGIC` | Usually one current journal per company/context |
| `permitNumber` | № наряда-допуска | string | Yes | text | n/a | `FORM_FROM_ADILET` | Human-readable permit number |
| `journalRegistrationNumber` | № записи в журнале | string | Yes | text/auto | n/a | `FORM_FROM_ADILET` | Registration number in journal |
| `permitType` | Тип допуска | enum | Yes | select | `PermitType` | `DERIVED_COMPLIANCE_LOGIC` | Main process type |
| `workType` | Вид работ | enum/string | Yes | select | `PermitWorkType` | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` | Drives checks |
| `status` | Статус | enum | Yes | status badge | `PermitStatus` | `DERIVED_COMPLIANCE_LOGIC` | System-controlled |
| `workDescription` | Описание работ | text | Yes | textarea | n/a | `FORM_FROM_ADILET` | Signed field |
| `workplace` | Место выполнения работ | string | Yes | text | n/a | `FORM_FROM_ADILET` | Signed field |
| `workZoneId` | Зона работ | UUID | Recommended / required for contractors | select/map | WorkZone | `DERIVED_COMPLIANCE_LOGIC` | Required for contractor/OPO access |
| `departmentId` | Подразделение | UUID | Yes | select | Departments | `DERIVED_COMPLIANCE_LOGIC` | Scope and responsibility |
| `startAt` | Дата и время начала | datetime | Yes | datetime picker | n/a | `FORM_FROM_ADILET` | Signed field |
| `endAt` | Дата и время окончания | datetime | Yes | datetime picker | n/a | `FORM_FROM_ADILET` | Signed field |
| `validUntil` | Действует до | datetime | Yes | computed/readonly | n/a | `DERIVED_COMPLIANCE_LOGIC` | Used for expiration monitoring |
| `contractorId` | Подрядчик | UUID | If contractor | select | Contractors | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` | Required for `CONTRACTOR_ACCESS` |
| `contractorRepresentativeId` | Представитель подрядчика | UUID | If contractor | select | Contractor employees/users | `DERIVED_COMPLIANCE_LOGIC` | Contractor responsible person |
| `issuerId` | Выдающий наряд | UUID | Yes | select | Users/employees | `FORM_FROM_ADILET` | Signed/responsibility role |
| `responsibleManagerId` | Ответственный руководитель работ | UUID | Yes | select | Users/employees | `FORM_FROM_ADILET` | Required before approval |
| `workProducerId` | Производитель работ | UUID | Yes | select | Users/employees | `FORM_FROM_ADILET` | Required before approval |
| `admitterId` | Допускающий | UUID | By type | select | Users/employees | `FORM_FROM_ADILET` | Required for many permit workflows |
| `observerId` | Наблюдающий | UUID | By type | select | Users/employees | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` | Useful for electrical/confined/dangerous works |
| `crewMemberIds` | Исполнители / члены бригады | UUID[] | Yes | multi-select | Employees/contractor employees | `FORM_FROM_ADILET` | Locked after approval |
| `hazardFactors` | Опасные факторы | json/string[] | Yes | tags/multi-select | HazardFactor | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` | Important for OPO/contractors |
| `safetyMeasures` | Меры безопасности | text/json | Yes | textarea/checklist | templates | `FORM_FROM_ADILET` | Signed field |
| `ppeRequirements` | Требуемые СИЗ | json | Yes for risky works | checklist | PPE norms | `DERIVED_COMPLIANCE_LOGIC` | Derived from work type |
| `ppeIssuedSnapshot` | Снимок выдачи СИЗ | json | Yes before approval | generated status card | PPE module | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` | Evidence at time of permit |
| `trainingCheckSnapshot` | Снимок обучения | json | Yes before approval | generated status card | Training/Testing | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` | Evidence at time of permit |
| `briefingCheckSnapshot` | Снимок инструктажа | json | Yes before approval | generated status card | Instruction journals | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` | Includes target briefing if linked |
| `certificateCheckSnapshot` | Снимок удостоверений | json | By work type | generated status card | Certificates | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` | Required for PТМ/electrical/etc. |
| `medicalCheckSnapshot` | Снимок медосмотра | json | If required | generated status card | Medical documents/status | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` | Do not store diagnosis |
| `requiredDocumentSnapshot` | Снимок обязательных документов | json | Yes before approval | generated list | Documents/contracts | `DERIVED_COMPLIANCE_LOGIC` | Contractor docs, schemes, instructions |
| `attachments` | Вложения | relation | Optional/by type | file list/upload | Documents | `DERIVED_COMPLIANCE_LOGIC` | Schemes, scans, photos, gas analysis, docs |
| `checklistId` | Чек-лист | UUID | Yes | select/generated | PermitChecklist | `DERIVED_COMPLIANCE_LOGIC` | Pre-admission checklist |
| `approvalStatus` | Статус согласования | enum | Yes | badge/workflow | Approval statuses | `DERIVED_COMPLIANCE_LOGIC` | Separate from lifecycle status |
| `signatureStatus` | Статус подписи | enum | Yes | badge/workflow | Signature statuses | `DERIVED_COMPLIANCE_LOGIC` | Separate from legal status |
| `rejectionReason` | Причина отказа | text | If rejected | textarea | n/a | `DERIVED_COMPLIANCE_LOGIC` | Required on reject |
| `suspensionReason` | Причина приостановки | text | If suspended | textarea | n/a | `DERIVED_COMPLIANCE_LOGIC` | Required on suspend |
| `closure` | Закрытие допуска | relation/json | If closed | closure form | PermitClosure | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` | Closing snapshot and signatures |
| `legalBasis` | Нормативное основание | json/list | Yes | multi-select | Legal basis registry | `DERIVED_COMPLIANCE_LOGIC` | Required before submit |
| `legalBasisVersion` | Версия правового основания | string | Yes | readonly | Legal basis registry | `DERIVED_COMPLIANCE_LOGIC` | Required due to changing legal basis |
| `legalBasisEffectiveDate` | Дата действия правового основания | date | Yes | readonly | Legal basis registry | `DERIVED_COMPLIANCE_LOGIC` | Must be stored with evidence |
| `signedPayloadHash` | Хэш подписанного payload | string | For signed permits | readonly | n/a | `DERIVED_COMPLIANCE_LOGIC` | Do not edit manually |
| `documentVersionHash` | Хэш версии документа | string | For signing/versioning | readonly | n/a | `DERIVED_COMPLIANCE_LOGIC` | Changes with signed data |
| `archivedAt` | Дата архивации | datetime | After archive | readonly | n/a | `DERIVED_COMPLIANCE_LOGIC` | Archive timestamp |
| `retentionUntil` | Хранить до | datetime | Yes when archived | computed/readonly | Retention policy | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` | Do not hardcode one value globally |
| `createdById` | Создал | UUID | Yes | readonly | Users | `PRODUCT_RECOMMENDATION` | Audit context |
| `createdAt` | Создано | datetime | Yes | readonly | n/a | `PRODUCT_RECOMMENDATION` | Technical timestamp |
| `updatedAt` | Обновлено | datetime | Yes | readonly | n/a | `PRODUCT_RECOMMENDATION` | Technical timestamp |

---

# 11. Participant Roles Dropdown

```ts
enum PermitParticipantRole {
  ADMIN
  BIOT_SPECIALIST
  FIRE_SAFETY_RESPONSIBLE
  INDUSTRIAL_SAFETY_RESPONSIBLE
  DEPARTMENT_HEAD
  RESPONSIBLE_MANAGER
  WORK_PRODUCER
  ISSUER
  ADMITTER
  OBSERVER
  EXECUTOR
  EMPLOYEE
  CONTRACTOR
  CONTRACTOR_REPRESENTATIVE
  AUDITOR
}
```

| Enum | UI label | Can create | Can approve | Can sign | Can close | Notes |
|---|---|---:|---:|---:|---:|---|
| `ADMIN` | Администратор компании | Yes | If assigned | If assigned | If assigned | Technical/admin role; signed payload still locked |
| `BIOT_SPECIALIST` | Специалист БиОТ | Yes | Yes | Yes | If assigned | Controls БиОТ checks, training, briefings, PPE |
| `FIRE_SAFETY_RESPONSIBLE` | Ответственный за пожарную безопасность | Yes for fire-related | Yes | Yes | If assigned | Fire/PТМ/hot work contexts |
| `INDUSTRIAL_SAFETY_RESPONSIBLE` | Ответственный за промышленную безопасность | Yes for OPO | Yes | Yes | If assigned | OPO, hazardous factors, work boundaries |
| `DEPARTMENT_HEAD` | Руководитель подразделения | Yes/request | Yes | Yes if assigned | If assigned | Confirms operational need |
| `RESPONSIBLE_MANAGER` | Ответственный руководитель работ | Yes/complete data | Yes | Yes | Yes if assigned | Key permit role |
| `WORK_PRODUCER` | Производитель работ | Edit assigned parts | Yes/confirm readiness | Yes | Yes | Starts/ends work context |
| `ISSUER` | Выдающий наряд | Yes | Yes | Yes | Yes | Issues permit-order |
| `ADMITTER` | Допускающий | No / assigned actions | Yes for admission | Yes | If assigned | Activates/admission confirmation |
| `OBSERVER` | Наблюдающий | No | No | Optional | No | Can record observations/stop events if enabled |
| `EXECUTOR` | Исполнитель | No | No | Acknowledgement only | No | Performs work; may confirm ознакомление |
| `EMPLOYEE` | Сотрудник | No | No | Acknowledgement only | No | Own permits visibility |
| `CONTRACTOR` | Подрядчик | Upload/request docs | No, except contractor-side confirmation | Contractor-side signature if assigned | No | Organization-level actor |
| `CONTRACTOR_REPRESENTATIVE` | Представитель подрядчика | Upload contractor crew/docs | Contractor readiness | Yes | Contractor-side closure if assigned | Preserves contractor-specific logic |
| `AUDITOR` | Аудитор | No | No | No | No | Read-only audit/evidence access |

---

# 12. Precheck Rules

Before transition to `pending_approval`, the system checks:

1. `employee.active === true`
2. `instruction.valid === true`
3. `training.valid === true`
4. `certificate.valid for selected workType`
5. `medicalExam.valid if required`
6. `ppe.issued === true`
7. `contractor.documents.valid if contractor`
8. `workZone.defined === true`
9. `responsibleManager.assigned === true`
10. `workProducer.assigned === true`
11. `crew.notEmpty === true`
12. `startAt < endAt`
13. `legalBasis.selected === true`

| Rule key | UI text if failed | Blocks status | Applies to | Level |
|---|---|---|---|---|
| `employee.active` | Сотрудник не активен | `pending_approval`, `approved`, `active` | Employee/crew members | `DERIVED_COMPLIANCE_LOGIC` |
| `instruction.valid` | Нет действующего инструктажа | `pending_approval`, `approved`, `active` | All relevant permits | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` |
| `training.valid` | Нет обучения или проверки знаний | `pending_approval`, `approved`, `active` | БиОТ/training-dependent permits | `DIRECT_LEGAL_REQUIREMENT` |
| `certificate.valid` | Нет действующего удостоверения для выбранного вида работ | `pending_approval`, `approved`, `active` | Electrical, fire/PТМ, height, special works | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` |
| `medicalExam.valid` | Нет действующего медосмотра | `pending_approval`, `approved`, `active` | Professions/work types requiring medical exam | `DIRECT_LEGAL_REQUIREMENT` |
| `ppe.issued` | Не подтверждена выдача СИЗ | `pending_approval`, `approved`, `active` | Risky works / PPE-required jobs | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` |
| `contractor.documents.valid` | У подрядчика не хватает документов | `pending_approval`, `approved`, `active` | Contractor access | `DERIVED_COMPLIANCE_LOGIC` |
| `workZone.defined` | Не указана зона работ | `pending_approval`, `approved`, `active` | All; mandatory for contractor/OPO | `DERIVED_COMPLIANCE_LOGIC` |
| `responsibleManager.assigned` | Не назначен ответственный руководитель работ | `pending_approval`, `approved`, `active` | Permit-order workflows | `FORM_FROM_ADILET` |
| `workProducer.assigned` | Не назначен производитель работ | `pending_approval`, `approved`, `active` | Permit-order workflows | `FORM_FROM_ADILET` |
| `crew.notEmpty` | Не добавлены исполнители / члены бригады | `pending_approval`, `approved`, `active` | Permit-order workflows | `FORM_FROM_ADILET` |
| `startAt < endAt` | Дата начала должна быть раньше даты окончания | `pending_approval`, `approved`, `active` | All permits | `DERIVED_COMPLIANCE_LOGIC` |
| `legalBasis.selected` | Не выбрано нормативное основание | `pending_approval`, `approved`, `active` | All permits | `DERIVED_COMPLIANCE_LOGIC` |

---

# 13. Check Snapshots

Snapshots are required because training, certificates, medical status, PPE, and documents may change later. The permit must preserve the state at the moment of approval/signing/activation.

## `trainingCheckSnapshot`

| Aspect | Value |
|---|---|
| Purpose | Freeze employee/crew training and knowledge-check state at the permit moment |
| Minimum fields | `employeeId`, `trainingId`, `courseName`, `protocolId`, `result`, `checkedAt`, `validUntil`, `sourceDocumentId`, `sourceHash` |
| Do not store | Irrelevant course data not connected to selected `workType` |
| Show in UI | Status card: valid / expired / missing, protocol link, valid-until date |
| Level | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` |

## `briefingCheckSnapshot`

| Aspect | Value |
|---|---|
| Purpose | Freeze instruction/briefing state, including target briefing tied to this permit if applicable |
| Minimum fields | `employeeId`, `briefingType`, `journalEntryId`, `briefedById`, `briefedAt`, `valid`, `sourceHash` |
| Do not store | Editable freeform replacement for actual journal entry |
| Show in UI | Validity card with journal link and briefing type |
| Level | `DIRECT_LEGAL_REQUIREMENT` / `FORM_FROM_ADILET` / `DERIVED_COMPLIANCE_LOGIC` |

## `certificateCheckSnapshot`

| Aspect | Value |
|---|---|
| Purpose | Freeze certificate/qualification status required by selected work type |
| Minimum fields | `employeeId`, `certificateId`, `certificateType`, `number`, `issuedAt`, `validUntil`, `status`, `sourceHash` |
| Do not store | Unrelated certificates |
| Show in UI | Certificate status, type, number, valid-until, source link |
| Level | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` |

## `medicalCheckSnapshot`

| Aspect | Value |
|---|---|
| Purpose | Freeze admission-relevant medical exam status without exposing diagnosis |
| Minimum fields | `status`, `validUntil`, `documentId`, `documentHash`, `checkedAt` |
| Allowed statuses | `valid`, `expired`, `missing`, `contraindicated` |
| Do not store | Diagnoses, detailed health data, unnecessary medical notes |
| Show in UI | Only status, valid-until date, document/evidence reference |
| Level | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` |

## `ppeIssuedSnapshot`

| Aspect | Value |
|---|---|
| Purpose | Freeze PPE issue state for relevant employees/crew |
| Minimum fields | `employeeId`, `ppeItems`, `issuedAt`, `validUntil`, `status`, `sourceDocumentId`, `sourceHash` |
| Do not store | Unverified manual claims without evidence |
| Show in UI | PPE checklist with missing/issued/expired state |
| Level | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` |

## `requiredDocumentSnapshot`

| Aspect | Value |
|---|---|
| Purpose | Freeze required documents at the moment of permit submission/approval/signing |
| Minimum fields | `documentId`, `documentType`, `title`, `version`, `hash`, `validUntil`, `checkedAt`, `status` |
| Do not store | Mutable links without version/hash |
| Show in UI | Checklist of required docs: valid/missing/expired |
| Level | `DERIVED_COMPLIANCE_LOGIC` |

---

# 14. Legal Basis Selector

UI must allow selecting multiple legal basis records.

## Legal basis object

```ts
type LegalBasisRef = {
  key: string;
  title: string;
  adiletId: string;
  direction: string;
  effectiveDate?: string;
  revisionDate?: string;
  level: 'DIRECT_LEGAL_REQUIREMENT' | 'FORM_FROM_ADILET' | 'DERIVED_COMPLIANCE_LOGIC' | 'PRODUCT_RECOMMENDATION';
  comment?: string;
}
```

## MVP prefilled legal basis

| Adilet marker | UI title | Direction | Level | Notes |
|---|---|---|---|---|
| `V2000021151` | Наряды-допуски на работы повышенной опасности | Работы повышенной опасности | `DIRECT_LEGAL_REQUIREMENT` / `FORM_FROM_ADILET` | Main MVP basis |
| `V1500012665` | Обучение, инструктаж, проверка знаний БиОТ | БиОТ | `DIRECT_LEGAL_REQUIREMENT` / `FORM_FROM_ADILET` | Precheck basis |
| `V2000021443` | Медосмотры | Медосмотры | `DIRECT_LEGAL_REQUIREMENT` | Medical precheck |
| `V1500012627` | СИЗ | СИЗ | `DIRECT_LEGAL_REQUIREMENT` | PPE precheck |
| `V2300033339` | Документирование / ЭДО | Документирование | `DIRECT_LEGAL_REQUIREMENT` | Document/evidence/export discipline |
| `Z030000370_` | ЭДО / ЭЦП | ЭЦП | `DIRECT_LEGAL_REQUIREMENT` | Signature/evidence basis, not universal paperless claim |
| `K2600000255` | Цифровой кодекс | ЭЦП / цифровое регулирование | `DIRECT_LEGAL_REQUIREMENT` | Use if applicable; preserve version/effective date |

---

# 15. UI Text Templates

Style requirements:

- Short.
- Legally careful.
- No marketing.
- No “we guarantee compliance with law”.
- No claim that electronic form universally replaces paper.

| UI context | Text | Level |
|---|---|---|
| Empty state | `Записей допуска пока нет. Создайте допуск или наряд-допуск, чтобы запустить проверку документов, согласование и подписание.` | `PRODUCT_RECOMMENDATION` |
| Create page hint | `Заполните тип допуска, вид работ, место, сроки, ответственных лиц и состав исполнителей. Перед согласованием система проверит обучение, инструктажи, удостоверения, медосмотры, СИЗ и документы подрядчика, если они применимы.` | `DERIVED_COMPLIANCE_LOGIC` |
| Universal form warning | `Единая государственная форма “Журнал допусков” для всех видов допуска не выявлена. В системе используется цифровой журнал, объединяющий несколько нормативных процессов: наряды-допуски, акты-допуски, допуски после обучения, инструктажа, медосмотров, СИЗ и удостоверений.` | `DERIVED_COMPLIANCE_LOGIC` |
| Precheck error summary | `Допуск нельзя отправить на согласование: есть незакрытые проверки. Исправьте ошибки и запустите проверку повторно.` | `DERIVED_COMPLIANCE_LOGIC` |
| Before approved | `После согласования ключевые условия допуска будут заблокированы. Изменение вида работ, сроков, состава бригады, опасных факторов, мер безопасности и правового основания потребует новой версии или отмены допуска.` | `DERIVED_COMPLIANCE_LOGIC` |
| Before active | `Активация означает фактический допуск к работам по указанным условиям. Проверьте сроки, место работ, состав исполнителей, меры безопасности и подписи.` | `DERIVED_COMPLIANCE_LOGIC` |
| Before suspend | `Укажите причину приостановки. Запись останется в журнале, а событие будет сохранено в аудите.` | `DERIVED_COMPLIANCE_LOGIC` |
| Before close | `Закрытие допуска фиксирует завершение работ и состояние документа на момент закрытия. После закрытия запись становится недоступной для обычного редактирования.` | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` |
| Before archive | `Архивация сохранит финальный снимок допуска, PDF, подписи, precheck snapshots, вложения, закрытие, audit trail и нормативное основание.` | `DERIVED_COMPLIANCE_LOGIC` |
| Signature/evidence | `ЭЦП evidence хранится для подтверждения факта подписания и версии подписанного документа. Применимость электронной формы зависит от конкретного документа и правового основания.` | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` |
| Read-only after signing | `Подписанные данные доступны только для просмотра. Изменение подписанных условий требует новой версии, отмены или отдельного сценария продления/повторного допуска.` | `DERIVED_COMPLIANCE_LOGIC` |

---

# 16. Edit Lock Rules

After `approved`, these fields are locked:

- `workType`
- `crewMemberIds`
- `startAt`
- `endAt`
- `hazardFactors`
- `safetyMeasures`
- `responsibleManagerId`
- `workProducerId`
- `issuerId`
- `admitterId`
- `legalBasis`
- `checkSnapshots`
- `signedPayloadHash`
- `documentVersionHash`

Any changes after `approved` must use:

- new version;
- cancellation and new draft;
- P1 extension/repeated admission workflow.

| Field | Editable in `draft` | Editable in `missing_documents` | Editable in `pending_approval` | Editable after `approved` | Notes |
|---|---:|---:|---:|---:|---|
| `permitNumber` | Yes | Yes | No | No | Signed/registered identifier |
| `journalRegistrationNumber` | Yes/auto | Yes/auto | No | No | Journal registration field |
| `permitType` | Yes | Yes | No | No | Changing process changes checks |
| `workType` | Yes | Yes | No | No | Signed key condition |
| `workDescription` | Yes | Yes | No | No | Signed field |
| `workplace` | Yes | Yes | No | No | Signed field |
| `workZoneId` | Yes | Yes | No | No | Especially locked for contractor/OPO |
| `departmentId` | Yes | Yes | No | No | Scope field |
| `startAt` | Yes | Yes | No | No | Signed field |
| `endAt` | Yes | Yes | No | No | Signed field; extension via P1 workflow |
| `validUntil` | Computed | Computed | No | No | Derived from dates/rules |
| `contractorId` | Yes | Yes | No | No | Contractor-specific workflow |
| `contractorRepresentativeId` | Yes | Yes | No | No | Signed participant |
| `issuerId` | Yes | Yes | No | No | Signed participant |
| `responsibleManagerId` | Yes | Yes | No | No | Signed participant |
| `workProducerId` | Yes | Yes | No | No | Signed participant |
| `admitterId` | Yes | Yes | No | No | Signed participant |
| `observerId` | Yes | Yes | No | No | Signed participant if set |
| `crewMemberIds` | Yes | Yes | No | No | Signed crew list |
| `hazardFactors` | Yes | Yes | No | No | Signed safety basis |
| `safetyMeasures` | Yes | Yes | No | No | Signed safety measures |
| `ppeRequirements` | Yes | Yes | No | No | Signed requirements |
| `checkSnapshots` | Generated | Regenerated | No | No | Must preserve state |
| `legalBasis` | Yes | Yes | No | No | Legal basis of signed record |
| `attachments` | Yes | Yes | Limited | No, except append-only evidence if allowed | Append-only after approval if implemented |
| `rejectionReason` | No | No | Yes if rejecting | Read-only | Required on reject |
| `suspensionReason` | No | No | No | Yes only when suspending | Required on suspend |
| `closure` | No | No | No | Yes only in close workflow | Closure is separate final block |
| `signedPayloadHash` | No | No | Generated | No | Never manually edit |
| `documentVersionHash` | Generated | Generated | Generated | No | Changes only through versioning |

---

# 17. Signature Payload

Do not sign “just the PDF”. PDF is a representation. The signed source of truth is a normalized payload with stable hashes.

```json
{
  "permitId": "...",
  "permitNumber": "...",
  "permitType": "...",
  "workType": "...",
  "workDescription": "...",
  "workplace": "...",
  "startAt": "...",
  "endAt": "...",
  "participants": [],
  "hazardFactors": [],
  "safetyMeasures": [],
  "checkSnapshots": {},
  "legalBasis": [],
  "documentVersionHash": "..."
}
```

Rules:

- PDF is a view/export of the document.
- Signed payload is the legal/technical evidence of document state at signing time.
- `documentVersionHash` must change when signed data changes.
- `signedPayloadHash` must refer to the exact normalized payload.
- After signing/approval, signed payload fields are immutable except via new version/cancel/re-issue/extension mechanics.

---

# 18. PermitSignature / Evidence

```ts
type PermitSignature = {
  id: string;
  permitId: string;
  signerUserId: string;
  signerRole: string;
  signerIin: string;
  signerBin?: string;
  certificateSerial: string;
  signedAt: string;
  signatureRaw: string;
  signedPayloadHash: string;
  documentVersionHash: string;
  legalBasisVersion: string;
  ncaLayerResponse: unknown;
  verificationResult: unknown;
  ipAddress: string;
  userAgent: string;
}
```

| Field | UI label | Required | Show in UI | Level | Notes |
|---|---|---:|---:|---|---|
| `id` | ID подписи | Yes | No/basic debug | `PRODUCT_RECOMMENDATION` | Technical ID |
| `permitId` | ID допуска | Yes | No | `PRODUCT_RECOMMENDATION` | Link to permit |
| `signerUserId` | Подписант | Yes | Yes | `DERIVED_COMPLIANCE_LOGIC` | User/person who signed |
| `signerRole` | Роль подписанта | Yes | Yes | `DERIVED_COMPLIANCE_LOGIC` | Must match workflow role |
| `signerIin` | ИИН подписанта | Yes | Restricted | `DERIVED_COMPLIANCE_LOGIC` | Sensitive identifier; show carefully |
| `signerBin` | БИН | Optional | Restricted | `DERIVED_COMPLIANCE_LOGIC` | If org certificate context exists |
| `certificateSerial` | Серийный номер сертификата | Yes | Yes | `DERIVED_COMPLIANCE_LOGIC` | Evidence metadata |
| `signedAt` | Дата подписания | Yes | Yes | `DERIVED_COMPLIANCE_LOGIC` | Timestamp |
| `signatureRaw` | Сырая подпись | Yes | No | `DERIVED_COMPLIANCE_LOGIC` | Store, do not show by default |
| `signedPayloadHash` | Хэш подписанного payload | Yes | Yes | `DERIVED_COMPLIANCE_LOGIC` | Verifies exact payload |
| `documentVersionHash` | Хэш версии документа | Yes | Yes | `DERIVED_COMPLIANCE_LOGIC` | Verifies document version |
| `legalBasisVersion` | Версия правового основания | Yes | Yes | `DERIVED_COMPLIANCE_LOGIC` | Required due to changing EDO/ECP basis |
| `ncaLayerResponse` | Ответ NCALayer | Yes | Debug/admin only | `DERIVED_COMPLIANCE_LOGIC` | Technical evidence |
| `verificationResult` | Результат проверки | Yes | Yes | `DERIVED_COMPLIANCE_LOGIC` | Verification status |
| `ipAddress` | IP-адрес | Yes | Admin/audit only | `PRODUCT_RECOMMENDATION` | Technical audit evidence |
| `userAgent` | User-Agent | Yes | Admin/audit only | `PRODUCT_RECOMMENDATION` | Technical audit evidence |

Important UI/legal text:

> ЭЦП evidence хранится для подтверждения факта подписания и версии подписанного документа. Применимость электронной формы зависит от конкретного документа и правового основания.

Forbidden claim:

> Do not write: “ЭЦП всегда заменяет бумагу во всех случаях.”

---

# 19. Archive Requirements

| Artifact | Required | Source | Level | Notes |
|---|---:|---|---|---|
| Final `PermitEntry` snapshot | Yes | Permit data | `DERIVED_COMPLIANCE_LOGIC` | Immutable final state |
| PDF | Yes | Generated representation | `PRODUCT_RECOMMENDATION` | Not signed source of truth by itself |
| Signed payload | Yes | Signature workflow | `DERIVED_COMPLIANCE_LOGIC` | Normalized payload used for hashes |
| All signatures | Yes | `PermitSignature` | `DERIVED_COMPLIANCE_LOGIC` | Include verification results |
| All approval events | Yes | `PermitApproval` / audit | `DERIVED_COMPLIANCE_LOGIC` | Approval chain evidence |
| All precheck snapshots | Yes | Precheck engine | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` | Training, briefing, cert, medical, PPE, docs |
| Attachments | Yes if present | Documents/files | `DERIVED_COMPLIANCE_LOGIC` | Preserve hashes/versions |
| Closure | Yes if closed | `PermitClosure` | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` | Work completion evidence |
| Audit trail | Yes | `PermitAuditEvent` | `DERIVED_COMPLIANCE_LOGIC` | Lifecycle trail |
| Legal basis snapshot | Yes | Legal basis registry | `DERIVED_COMPLIANCE_LOGIC` | Preserve legal basis version/date |
| `retentionUntil` | Yes | Retention rules | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` | Must be per document type |

## Retention rule

- Do not hardcode one retention period for every document.
- For closed permit-orders under Rules № 344, the research fixed a storage period of **one year from closing date**.
- Instruction journals, fire journals, archival documents, and other documents may have different periods.
- `retentionUntil` must be calculated based on document type and legal basis, not a single global value.

---

# 20. API Canonical Draft

| Endpoint | Purpose | Request body summary | Allowed statuses | Resulting status | Audit event |
|---|---|---|---|---|---|
| `GET /api/permits` | List permits | filters, pagination, sorting | all | no change | optional `PERMIT_LIST_VIEWED` if implemented |
| `POST /api/permits` | Create permit draft | base fields: type, work type, dates, participants | n/a | `draft` | `PERMIT_DRAFT_CREATED` |
| `GET /api/permits/:id` | Read permit | n/a | all | no change | optional view event if required |
| `PATCH /api/permits/:id` | Edit permit | editable fields only | `draft`, `missing_documents`, `rejected` | no lifecycle change | optional `PERMIT_UPDATED` if implemented |
| `POST /api/permits/:id/precheck` | Run precheck | n/a or force flag | `draft`, `missing_documents`, `rejected` | `pending_precheck`, then `missing_documents` or ready for submit | `PRECHECK_STARTED`, `PRECHECK_FAILED`/`PRECHECK_PASSED` |
| `POST /api/permits/:id/submit` | Submit to approval | optional comment | `draft`, `missing_documents` with passed precheck | `pending_approval` | `APPROVAL_REQUESTED` |
| `POST /api/permits/:id/approve` | Approve permit | approver role, comment | `pending_approval` | `approved` when required approvals complete | `PERMIT_APPROVED` |
| `POST /api/permits/:id/reject` | Reject permit | `rejectionReason` | `pending_approval` | `rejected` | `PERMIT_REJECTED` |
| `POST /api/permits/:id/sign` | Sign normalized payload | signature payload / NCALayer result | `pending_approval`, `approved` depending workflow | status unchanged or `approved` when all signatures complete | `PERMIT_SIGNED` |
| `POST /api/permits/:id/activate` | Activate permit | activation comment, admitter confirmation | `approved` | `active` | `PERMIT_ACTIVATED` |
| `POST /api/permits/:id/suspend` | Suspend active permit | `suspensionReason` | `active` | `suspended` | `PERMIT_SUSPENDED` |
| `POST /api/permits/:id/close` | Close permit | closure result, comments, inspection, signatures | `active`, `suspended` if allowed | `closed` | `PERMIT_CLOSED` |
| `POST /api/permits/:id/archive` | Archive permit | archive comment/retention data if needed | `closed`, `cancelled`, `expired` | `archived` | `PERMIT_ARCHIVED` |
| `GET /api/permits/:id/audit` | Get audit trail | n/a | all | no change | optional `PERMIT_AUDIT_VIEWED` if implemented |
| `GET /api/permits/:id/evidence` | Get evidence package | n/a | all, restricted roles | no change | `PERMIT_EVIDENCE_VIEWED` |
| `GET /api/permits/:id/pdf` | Export PDF | n/a | all except empty draft | no change | `PERMIT_PDF_EXPORTED` |

Do not create additional endpoints in MVP unless needed by existing repo patterns.

---

# 21. Audit Events

```ts
enum PermitAuditEventType {
  PERMIT_DRAFT_CREATED
  PRECHECK_STARTED
  PRECHECK_FAILED
  PRECHECK_PASSED
  APPROVAL_REQUESTED
  PERMIT_APPROVED
  PERMIT_REJECTED
  PERMIT_SIGNED
  PERMIT_ACTIVATED
  PERMIT_SUSPENDED
  PERMIT_EXTENDED
  PERMIT_CLOSED
  PERMIT_CANCELLED
  PERMIT_EXPIRED
  PERMIT_ARCHIVED
  PERMIT_PDF_EXPORTED
  PERMIT_EVIDENCE_VIEWED
}
```

| Event | UI label | Trigger | Required payload | Level |
|---|---|---|---|---|
| `PERMIT_DRAFT_CREATED` | Черновик создан | Permit created | `permitId`, `createdById`, `createdAt` | `PRODUCT_RECOMMENDATION` |
| `PRECHECK_STARTED` | Проверка запущена | Precheck requested | `permitId`, `startedById`, `startedAt` | `DERIVED_COMPLIANCE_LOGIC` |
| `PRECHECK_FAILED` | Проверка не пройдена | One or more rules failed | `permitId`, `failedRules`, `checkedAt` | `DERIVED_COMPLIANCE_LOGIC` |
| `PRECHECK_PASSED` | Проверка пройдена | All required rules passed | `permitId`, `snapshots`, `checkedAt` | `DERIVED_COMPLIANCE_LOGIC` |
| `APPROVAL_REQUESTED` | Отправлено на согласование | Submit action | `permitId`, `requestedById`, `approvers` | `DERIVED_COMPLIANCE_LOGIC` |
| `PERMIT_APPROVED` | Допуск согласован | Approval completed | `permitId`, `approvedById`, `role`, `approvedAt` | `DERIVED_COMPLIANCE_LOGIC` |
| `PERMIT_REJECTED` | Допуск отклонён | Reject action | `permitId`, `rejectedById`, `rejectionReason` | `DERIVED_COMPLIANCE_LOGIC` |
| `PERMIT_SIGNED` | Допуск подписан | Signature completed | `permitId`, `signerUserId`, `signerRole`, `signedPayloadHash`, `documentVersionHash` | `DERIVED_COMPLIANCE_LOGIC` |
| `PERMIT_ACTIVATED` | Допуск активирован | Activation action | `permitId`, `admitterId`, `activatedAt` | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` |
| `PERMIT_SUSPENDED` | Допуск приостановлен | Suspend action | `permitId`, `suspendedById`, `suspensionReason` | `DERIVED_COMPLIANCE_LOGIC` |
| `PERMIT_EXTENDED` | Допуск продлён | Extension action | `permitId`, `extendedById`, `oldEndAt`, `newEndAt`, `reason` | `DIRECT_LEGAL_REQUIREMENT` for some types / `DERIVED_COMPLIANCE_LOGIC` |
| `PERMIT_CLOSED` | Допуск закрыт | Closure action | `permitId`, `closedById`, `closure`, `closedAt` | `DIRECT_LEGAL_REQUIREMENT` / `DERIVED_COMPLIANCE_LOGIC` |
| `PERMIT_CANCELLED` | Допуск отменён | Cancel action | `permitId`, `cancelledById`, `reason` | `PRODUCT_RECOMMENDATION` |
| `PERMIT_EXPIRED` | Срок допуска истёк | System expiration job | `permitId`, `expiredAt`, `validUntil` | `DERIVED_COMPLIANCE_LOGIC` |
| `PERMIT_ARCHIVED` | Допуск архивирован | Archive action/job | `permitId`, `archivedAt`, `retentionUntil` | `DERIVED_COMPLIANCE_LOGIC` |
| `PERMIT_PDF_EXPORTED` | PDF экспортирован | PDF export | `permitId`, `exportedById`, `exportedAt`, `documentVersionHash` | `PRODUCT_RECOMMENDATION` |
| `PERMIT_EVIDENCE_VIEWED` | Evidence просмотрен | Evidence access | `permitId`, `viewedById`, `viewedAt` | `PRODUCT_RECOMMENDATION` |

---

# 22. MVP / P1 / P2 Boundary

## MVP includes

- Unified `PermitJournal`.
- `PermitEntry`.
- Наряд-допуск as main scenario.
- Contractor act/admission / `contractor access`.
- Link to employees.
- Link to contractors.
- Link to certificates.
- Link to instruction journals.
- Link to training/testing.
- Link to documents.
- Precheck.
- Approvals.
- Signatures / ECP evidence.
- Status lifecycle.
- Closure.
- Audit trail.
- PDF/print export.
- Archive.

## P1 includes

- Specialized hot work form.
- Specialized gas hazardous work form.
- Electrical installations: наряд + распоряжение + журнал работ.
- Repeated admission.
- Permit extension.
- QR permit check.
- Contractor portal.
- Expiration calendar.
- Notifications.
- Bulk crew check.
- Link to commission protocols.
- Link to orders appointing responsible persons.

## P2 includes

- Risk scoring.
- Access control system integration (`СКУД`).
- IoT / gas analysis / telemetry.
- Automatic permit blocking when certificate expires.
- Violation analytics.
- Dangerous work classification by objects.
- Industry templates: gas, energy, mines, construction, chemical, metallurgy.

---

# 23. Explicit Anti-Hallucination Rules For Codex

## Anti-hallucination rules

1. Do not invent new permit types.
2. Do not invent new Adilet legal acts.
3. Do not convert product recommendation into legal requirement.
4. Do not add industry-specific forms to MVP unless explicitly requested.
5. Do not store medical diagnoses in `PermitEntry`.
6. Do not make signed fields editable after `approved`.
7. Do not treat PDF as the signed source of truth.
8. Do not hardcode one retention period for all documents.
9. Do not claim universal paperless legality for all permit types.
10. Do not rename `PermitJournal` / `PermitEntry` without explicit instruction.
11. Do not remove `legalBasisVersion` / `legalBasisEffectiveDate`.
12. Do not skip audit trail for lifecycle transitions.
13. Do not skip snapshots for training, briefing, certificate, medical, PPE checks.
14. Do not merge contractor access into employee admission without preserving contractor-specific fields.
15. Do not build P1/P2 industry templates in MVP.
16. Do not store raw medical diagnoses, detailed health descriptions, or unnecessary sensitive health data.
17. Do not add a universal claim that the module itself guarantees legal compliance.
18. Do not silently mutate approved/signed records; use versioning/cancel/reissue/extension mechanics.
19. Do not collapse `permitType` and `workType`; both are required.
20. Do not remove `signedPayloadHash` or `documentVersionHash` from signature/evidence flow.

---

# 24. Final Codex Usage Note

This file is the canonical UI/data/legal context for implementing Permit Journal. Future implementation prompts must follow this file unless a newer canonical file explicitly replaces it.

When implementing from this file:

- create code only when an implementation prompt explicitly asks for code;
- keep MVP narrow;
- preserve legal/product levels;
- use Russian UI labels;
- use English enum values exactly as specified;
- preserve snapshots, evidence, audit, archive, and edit-lock rules.
