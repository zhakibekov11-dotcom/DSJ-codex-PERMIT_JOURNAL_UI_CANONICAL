# Digital Safety Journal / Current Functionality Audit

## 0. NCALayer Signing Status (2026-04-10)

This section supersedes older MVP/mock-only wording lower in the audit.

- confirmed: SIGNING_PROVIDER=NCALAYER now works across admin signing, employee self-service signing, and public invite signing.
- confirmed: the web client uses one signing contract for mock and NCALayer flows and talks to the local bridge for health/sign operations.
- confirmed: the API validates the canonical documentHash, CMS certificate metadata, signing timestamp, and signer IIN against the employee record, then stores provider-specific payload in Signature.payload.
- confirmed: the repo now contains apps/ncalayer-bridge, a transport-only local service with /health and /sign; it does not persist business data.
- external dependency: signer machines still need the installed NCALayer desktop runtime and a locally started bridge process reachable at NCALAYER_BRIDGE_URL.
- explicit env: SIGNING_PROVIDER, NCALAYER_BRIDGE_URL, NCALAYER_BRIDGE_TIMEOUT_MS, and SIGNING_TEST_MODE are required to select the active runtime behavior; ALLOW_PUBLIC_INVITE_MOCK_SIGNING remains a non-production fallback gate.

## 1. Executive Summary

Проект представляет собой многоарендную систему для цифрового ведения процессов по охране труда. По текущему коду это не только "журнал инструктажей", а более широкий контур: управление компаниями и сотрудниками, ведение инструктажей и подписаний, обучение и тестирование, реестр внутренних документов, исходящая переписка, BIOT/PTM/PB/PS-генерация удостоверений и протоколов, а также фоновые напоминания и аудит действий.

Подтверждённые пользовательские зоны:

- административный и корпоративный кабинет с разграничением ролей;
- реестр компаний, подрядчиков, подразделений и сотрудников;
- журнал инструктажей с пакетным созданием, PDF-экспортом, приглашениями на подпись и кабинетом сотрудника;
- обучение, тестирование и автоматическое создание артефактов по итогам обучения;
- реестры документов компании, переписки и BIOT-ориентированных сертификатов/удостоверений;
- журнал аудита и фоновая очередь напоминаний.

Текущая зрелость функционала выглядит неравномерной:

- зрелые зоны: журнал инструктажей, сотрудники, обучение/экзамены, BIOT-генерация, разграничение ролей, аудит;
- частично реализованные зоны: уведомления и отправка писем наружу, публичное подписание, часть документных сценариев;
- подозрительные/недоведённые зоны: управление `Site`, обычный CRUD по сертификатам вне BIOT-экрана, UI для ручного создания employee documents.

Основные точки подтверждения: `apps/web`, `apps/api`, `apps/worker`, `packages/database/prisma/schema.prisma`, `scripts/*`.

## 2. Product Scope

### Основное назначение

Система предназначена для цифрового сопровождения процессов по охране труда и смежным комплаенс-сценариям в компании:

- учёт сотрудников, подрядчиков и организационной структуры;
- проведение и фиксация инструктажей;
- подготовка данных к подписанию и фиксация подписей;
- контроль просроченных или неподписанных записей;
- обучение, проверка знаний и выпуск связанных документов;
- подготовка внутренних документов и исходящей переписки;
- специализированная генерация удостоверений, протоколов, реестров и witness-документов для направлений BIOT/PTM/PB/PS.

### Предполагаемые типы пользователей

- `SUPER_ADMIN`: межкомпанейный доступ, управление компаниями, просмотр всех зон;
- `COMPANY_ADMIN`: администрирование данных своей компании, BIOT-заявок, журналов, обучения и документов;
- `SAFETY_ENGINEER`: операционная работа по охране труда внутри компании;
- `EMPLOYEE_SIGNER`: кабинет сотрудника для инструктажей, документов, сертификатов, обучения и тестирования;
- внешний получатель по invite-link: ограниченный публичный сценарий просмотра и, при флаге, mock-подписания.

### Ключевые продуктовые зоны

- Access and tenancy
- Org structure and workforce management
- Safety briefing journal and signing
- Employee self-service cabinet
- Training, exams, and generated compliance artifacts
- Company documents and outgoing correspondence
- BIOT/PTM/PB/PS certificate and protocol generation
- Monitoring, reminders, and audit

## 3. Confirmed Functional Areas

### 3.1 Authentication & Access

- Логин выполняется через backend auth API и хранит JWT в `httpOnly` cookie.
- Доступ к страницам и API ограничивается ролями и company scope.
- Для `SUPER_ADMIN` подтверждён межкомпанейный переключатель контекста.
- Для `EMPLOYEE_SIGNER` есть отдельный набор экранов и другая стартовая страница.

**Evidence:** `apps/api/src/auth/auth.controller.ts`, `apps/api/src/auth/auth.service.ts`, `apps/api/src/common/guards/jwt-auth.guard.ts`, `apps/api/src/common/guards/roles.guard.ts`, `apps/api/src/common/utils/tenant-scope.ts`, `apps/web/lib/api.ts`, `apps/web/lib/auth.ts`, `apps/web/lib/company-context.ts`, `apps/web/components/app-shell.tsx`

### 3.2 Company, Department, Contractor, and Employee Management

- Есть управление компаниями, включая создание первичного администратора компании.
- Есть реестр подразделений и реестр подрядных организаций.
- Есть полноценный реестр сотрудников с фильтрацией, архивированием и опциональным созданием персонального аккаунта.
- Для сотрудников обрабатываются чувствительные данные: ИИН шифруется и хэшируется; фото нормализуется на web-слое.
- В BIOT-контуре можно создать "certificate-only" сотрудника как техническую запись без полноценного профиля.

**Evidence:** `apps/api/src/companies/*`, `apps/api/src/departments/*`, `apps/api/src/contractor-companies/*`, `apps/api/src/employees/*`, `apps/web/app/(app)/companies/page.tsx`, `apps/web/app/(app)/departments/page.tsx`, `apps/web/app/(app)/contractors/page.tsx`, `apps/web/app/(app)/employees/*`, `apps/web/actions/employee.ts`, `packages/database/prisma/schema.prisma`

### 3.3 Briefing Journal, Signing, and Employee Instruction Flows

- Есть журнал инструктажей с фильтрами, деталкой, редактированием и пакетным созданием записей.
- Поддерживаются batch-сценарии через `BriefingBatch`.
- При переводе записи в `READY_FOR_SIGNING` генерируются invite-link и уведомления в очередь.
- Сотрудник может открыть инструктаж, подтвердить ознакомление и подписать его в своём кабинете.
- Есть отдельный админский mock-signing экран и публичная invite-страница.
- Доступен экспорт PDF как отдельной записи, так и отфильтрованного журнала.

**Evidence:** `apps/api/src/briefing-records/*`, `apps/api/src/signatures/*`, `apps/api/src/pdf/pdf.service.ts`, `apps/web/app/(app)/journal/*`, `apps/web/app/(app)/my-instructions/*`, `apps/web/app/invite/[token]/page.tsx`, `apps/web/app/api/journal/pdf/route.ts`

### 3.4 Dashboard, Notifications, and Audit

- Dashboard агрегирует ключевые метрики: сотрудники, подписанные записи, ожидающие подписи, overdue repeated briefings, reminders.
- Есть отдельный экран аудита.
- Есть список notification jobs.
- Worker регулярно сканирует неподписанные и повторные инструктажи и создаёт напоминания/джобы.

**Evidence:** `apps/api/src/dashboard/*`, `apps/api/src/notifications/*`, `apps/api/src/audit/*`, `apps/worker/src/main.ts`, `apps/web/app/(app)/dashboard/page.tsx`, `apps/web/app/(app)/audit/page.tsx`

### 3.5 Training, Exams, and Generated Artifacts

- Есть создание программ обучения с назначением группе сотрудников.
- Есть прохождение материала сотрудником, запуск экзамена и сдача теста.
- Успешное прохождение экзамена или завершение программы может автоматически создать employee document и/или safety certificate.
- Для сотрудника есть отдельные кабинеты `my-training` и `my-testing`.

**Evidence:** `apps/api/src/training-programs/*`, `apps/api/src/exams/*`, `apps/web/app/(app)/training/page.tsx`, `apps/web/app/(app)/testing/page.tsx`, `apps/web/app/(app)/my-training/*`, `apps/web/app/(app)/my-testing/*`

### 3.6 Company Documents, Employee Documents, and Certificates

- Есть реестр внутренних документов компании с созданием записей, PDF- и DOCX-выгрузкой.
- Есть кабинет сотрудника для просмотра своих документов и сертификатов.
- Есть API и бизнес-логика для employee documents и safety certificates.
- Активная админская точка входа по сертификатам сейчас ведёт не в классический CRUD, а в BIOT-экран.

**Evidence:** `apps/api/src/company-documents/*`, `apps/api/src/employee-documents/*`, `apps/api/src/safety-certificates/*`, `apps/web/app/(app)/documents/page.tsx`, `apps/web/app/(app)/my-documents/*`, `apps/web/app/(app)/my-certificates/*`, `apps/web/app/(app)/certificates/page.tsx`, `scripts/generate_company_document_docx.py`

### 3.7 BIOT / PTM / PB / PS Certificate Production

- В системе есть крупный специализированный контур генерации удостоверений, протоколов, реестров и witness-документов.
- Поддерживаются типы `BIOT`, `PTM`, `PB`, `PS` и режимы `WORKER_CARD` / `ITR_CERTIFICATE`.
- Есть сохранение заявок, повторное редактирование, batch-генерация и экспорт в DOCX/XLSX.
- Эта зона активна в UI, несмотря на пометку `biot-experimental` в роуте и шаблонах.

**Evidence:** `apps/api/src/biot-cards/*`, `apps/web/app/(app)/certificates/biot-experimental/page.tsx`, `apps/web/app/(app)/certificates/requests/[id]/edit/page.tsx`, `apps/web/components/biot-card-generator.tsx`, `scripts/generate_biot_card.py`, `scripts/generate_biot_mail_merge_bundle.py`, `scripts/export_card_request_registry.py`, `scripts/generate_ps_witness_certificate.py`, `docs/experimental/*`

### 3.8 Outgoing Correspondence and AI Assistance

- Есть реестр исходящей переписки: деловые письма и коммерческие предложения.
- В UI можно собрать письмо, указать нескольких получателей, сохранить его в реестр и скачать PDF.
- Для части компаний доступна DOCX-выгрузка по специализированному шаблону.
- Есть AI-assisted draft/improve/analyze endpoint с fallback-логикой при отсутствии OpenAI API key.
- Функция "send to all" существует, но по коду не подтверждена интеграция с внешним почтовым провайдером.

**Evidence:** `apps/api/src/correspondence/*`, `apps/web/app/(app)/correspondence/page.tsx`, `apps/web/components/correspondence-editor.tsx`, `apps/web/actions/correspondence.ts`, `apps/web/app/api/correspondence/ai/route.ts`, `scripts/generate_correspondence_docx.py`, `docs/experimental/correspondence/stroy-company-2030-letter-template.docx`

### 3.9 Translation Helper

- Есть вспомогательный продуктовый сценарий перевода должностей с русского на казахский на базе ETKS-данных и overrides.
- Он встроен в форму сотрудника, то есть используется не как отдельная утилита, а как часть реального пользовательского потока.

**Evidence:** `apps/api/src/translations/*`, `apps/web/components/job-title-translation-fields.tsx`, `apps/web/lib/job-title-translation.ts`

## 4. Detailed Feature Inventory

### 4.1 Access and Tenancy

| Feature name | Status | Who uses it | What it does | Entry points | Core files | Dependencies / integrations | Notes / limitations |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Auth login and session cookie | confirmed | All authenticated roles | Выполняет логин, получает профиль, хранит JWT в cookie | Web `/login`, API `/v1/auth/login`, `/v1/auth/me` | `apps/api/src/auth/*`, `apps/web/lib/api.ts`, `apps/web/lib/auth.ts` | JWT, cookie config, `COOKIE_NAME` | Отдельного logout-контроллера в подтверждённом UI не анализировалось, но session flow подтверждён |
| Role-based access and route segmentation | confirmed | Super admin, company admin, safety engineer, employee signer | Ограничивает доступ к страницам и API, меняет навигацию и landing page | App shell, server pages, Nest guards | `apps/api/src/common/guards/*`, `apps/web/components/app-shell.tsx`, `apps/web/lib/auth.ts` | Role guards | `SUPER_ADMIN` обходится через глобальную логику роли |
| Company-scoped multi-tenancy | confirmed | Super admin, internal staff roles | Ограничивает данные рамками компании, позволяет super admin переключать компанию | Web query-scoped pages, backend service list endpoints | `apps/api/src/common/utils/tenant-scope.ts`, `apps/web/lib/company-context.ts` | Query param `companyId` | Не все страницы одинаково явно показывают текущий tenant context |
| Public invite signing via unified contract | confirmed | Invite recipient, admin during testing | Routes invite signing through the same provider-aware contract used by the other flows | Web `/invite/[token]`, API `/v1/signatures/public/briefing-invites/:inviteToken/sign` | `apps/api/src/signatures/signatures.service.ts`, `apps/web/app/invite/[token]/page.tsx` | `SIGNING_PROVIDER`, NCALayer bridge, `ALLOW_PUBLIC_INVITE_MOCK_SIGNING` for mock fallback | NCALayer is the primary configured path; public mock signing stays gated for non-production fallback only |

### 4.2 Organization and Workforce

| Feature name | Status | Who uses it | What it does | Entry points | Core files | Dependencies / integrations | Notes / limitations |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Company registry and company admin bootstrap | confirmed | Super admin | Создаёт компании и первичного администратора, показывает базовые счётчики | Web `/companies`, API `/v1/companies` | `apps/api/src/companies/*`, `apps/web/app/(app)/companies/page.tsx` | Prisma | Удаление компании разрушительное внутри её scope |
| Department registry | confirmed | Company admin, safety engineer | Создаёт и просматривает подразделения компании | Web `/departments`, API `/v1/departments` | `apps/api/src/departments/*`, `apps/web/app/(app)/departments/page.tsx` | Prisma | Подтверждены list/create; update/delete не подтверждены |
| Contractor company registry | confirmed | Company admin, safety engineer | Ведёт справочник подрядчиков со статусом и CRUD-операциями | Web `/contractors`, API `/v1/contractor-companies` | `apps/api/src/contractor-companies/*`, `apps/web/app/(app)/contractors/page.tsx` | Prisma | Полноценный CRUD подтверждён |
| Employee registry, archive, and signer account creation | confirmed | Company admin, safety engineer | Создаёт сотрудников, связывает их с аккаунтом signer, архивирует, фильтрует и редактирует | Web `/employees`, `/employees/new`, `/employees/[id]/edit`, API `/v1/employees` | `apps/api/src/employees/*`, `apps/web/app/(app)/employees/*`, `apps/web/actions/employee.ts` | Prisma, field encryption, `sharp` | ИИН хранится в зашифрованном виде; фото проходит нормализацию |
| Certificate-only employee creation | confirmed | Company admin, BIOT operator | Создаёт технического сотрудника для генерации удостоверения без полноценного профиля | Web BIOT editor, API `/v1/employees/certificate-only` | `apps/api/src/employees/employees.service.ts`, `apps/web/components/biot-card-generator.tsx` | Prisma | Нишевой сценарий, но реально подключён |
| Site management surface | inactive | Internal staff | В модели и сервисах есть поддержка `siteId` | Backend validation paths, schema, seed | `packages/database/prisma/schema.prisma`, `apps/api/src/employees/employees.service.ts`, `apps/api/src/briefing-records/briefing-records.service.ts` | Prisma | Активного UI и отдельного CRUD по `Site` не подтверждено |

### 4.3 Briefings and Signing

| Feature name | Status | Who uses it | What it does | Entry points | Core files | Dependencies / integrations | Notes / limitations |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Briefing journal with filtering and PDF export | confirmed | Company admin, safety engineer | Показывает реестр инструктажей, статус, фильтры и выгрузку журнала в PDF | Web `/journal`, API `/v1/briefing-records`, `/v1/briefing-records/export/journal.pdf` | `apps/api/src/briefing-records/*`, `apps/web/app/(app)/journal/page.tsx`, `apps/web/app/api/journal/pdf/route.ts` | PDF service | Реальный рабочий центр продукта |
| Batch briefing creation | confirmed | Company admin, safety engineer | Создаёт одну или несколько записей инструктажа одним действием | Web `/journal/new`, API create briefing record | `apps/api/src/briefing-records/briefing-records.service.ts`, `apps/web/app/(app)/journal/new/page.tsx`, `apps/web/components/briefing-participant-picker.tsx` | Prisma | Для batch-сценария используется `BriefingBatch` |
| Briefing detail, editing, archive, prepare-for-signing | confirmed | Company admin, safety engineer | Позволяет просматривать запись, редактировать поля, архивировать и подготовить к подписи | Web `/journal/[id]`, `/journal/[id]/edit`, API patch/prepare/archive/open/acknowledge | `apps/api/src/briefing-records/*`, `apps/web/app/(app)/journal/[id]/*` | Audit, notifications | У batch-записи состав участников после создания не меняется |
| Employee instruction self-service | confirmed | Employee signer | Позволяет открыть инструктаж, подтвердить ознакомление, подписать и скачать PDF | Web `/my-instructions`, `/my-instructions/[id]`, API `/v1/briefing-records/my`, employee sign | `apps/web/app/(app)/my-instructions/*`, `apps/api/src/briefing-records/*`, `apps/api/src/signatures/*` | JWT session, PDF service | Последовательность open -> acknowledge -> sign подтверждена |
| Admin signing page via unified contract | confirmed | Company admin, safety engineer | Uses the shared signing form and the same provider-aware `/sign` endpoint as the other flows | Web `/journal/[id]/sign` | `apps/web/app/(app)/journal/[id]/sign/page.tsx`, `apps/api/src/signatures/signatures.service.ts` | `SIGNING_PROVIDER`, optional NCALayer bridge | Mock remains clearly marked fallback when it is explicitly selected |
| Real NCALayer signing via local bridge | confirmed | Company admin, safety engineer, employee signer, invite recipient | Uses the canonical `documentHash`, local bridge transport, and server-side digest/IIN validation | Web signing flows, API `/v1/signatures/*`, bridge `/health` + `/sign` | `apps/api/src/signatures/*`, `apps/web/components/signing-form.tsx`, `apps/ncalayer-bridge/src/*` | Installed NCALayer runtime, local bridge process | Requires explicit env config and the external NCALayer runtime on the signer machine |

### 4.4 Monitoring, Notifications, and Audit

| Feature name | Status | Who uses it | What it does | Entry points | Core files | Dependencies / integrations | Notes / limitations |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard summary | confirmed | Internal staff roles | Показывает ключевые operational/compliance метрики и recent briefings | Web `/dashboard`, API `/v1/dashboard/summary` | `apps/api/src/dashboard/*`, `apps/web/app/(app)/dashboard/page.tsx` | Prisma | Используется как оперативная сводка, а не как BI reporting |
| Audit log view | confirmed | Internal staff roles | Отображает события аудита по ключевым действиям | Web `/audit`, API `/v1/audit-logs` | `apps/api/src/audit/*`, `apps/web/app/(app)/audit/page.tsx` | Prisma | Полезно для traceability и расследования действий |
| Reminder and notification queue | partial | System, internal staff | Создаёт reminders и notification jobs для неподписанных и повторных инструктажей | Worker cron loops, API `/v1/notifications/jobs` | `apps/worker/src/main.ts`, `apps/api/src/notifications/*` | Redis, BullMQ, Prisma | Очередь и статусы есть, но внешняя доставка не подтверждена |
| External notification delivery | inactive | Intended employees / recipients | Должна отправлять email/in-app уведомления наружу | Notification jobs | `apps/api/src/notifications/notifications.service.ts`, `apps/worker/src/main.ts` | Potential email channel | Worker меняет статусы job/reminder, но реального провайдера email/SMS не видно |

### 4.5 Training, Exams, and Artifact Generation

| Feature name | Status | Who uses it | What it does | Entry points | Core files | Dependencies / integrations | Notes / limitations |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Training program assignment | confirmed | Company admin, safety engineer | Создаёт программу обучения и назначает её группе сотрудников | Web `/training`, API `/v1/training-assignments` | `apps/api/src/training-programs/*`, `apps/web/app/(app)/training/page.tsx` | Prisma | Подтверждены создание и просмотр; редактирование не подтверждено |
| Employee training completion | confirmed | Employee signer | Позволяет начать обучение, пройти материал и завершить его | Web `/my-training`, `/my-training/[id]`, API training assignment actions | `apps/web/app/(app)/my-training/*`, `apps/api/src/training-programs/training-programs.service.ts` | Prisma | При `requiresExam` завершение материала не закрывает assignment полностью |
| Exam creation and passing | confirmed | Internal staff, employee signer | Создаёт тест, запускает попытку, проверяет ответы и считает результат | Web `/testing`, `/my-testing`, API `/v1/exams` | `apps/api/src/exams/*`, `apps/web/app/(app)/testing/page.tsx`, `apps/web/app/(app)/my-testing/*` | Prisma | Вопросы и варианты ответов хранятся в БД |
| Auto-generated document/certificate after training | confirmed | Employee signer, internal staff | После завершения программы или экзамена создаёт employee document и/или safety certificate | Internal service flow from training/exam completion | `apps/api/src/training-programs/training-programs.service.ts`, `apps/api/src/employee-documents/*`, `apps/api/src/safety-certificates/*` | Prisma, PDF service | Бизнес-артефакт подтверждён, но полный отдельный админский CRUD по этим сущностям не везде подключён в UI |

### 4.6 Documents, Certificates, and Correspondence

| Feature name | Status | Who uses it | What it does | Entry points | Core files | Dependencies / integrations | Notes / limitations |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Company document registry and template authoring | confirmed | Company admin, safety engineer | Ведёт реестр внутренних документов компании и экспортирует их в PDF/DOCX | Web `/documents`, API `/v1/company-documents` | `apps/api/src/company-documents/*`, `apps/web/app/(app)/documents/page.tsx`, `apps/web/actions/document.ts` | Python DOCX generator | Это активный документный реестр; не путать с employee documents |
| Employee document cabinet | confirmed | Employee signer | Показывает выданные сотруднику документы и их PDF | Web `/my-documents`, `/my-documents/[id]`, API `/v1/employee-documents/my` | `apps/api/src/employee-documents/*`, `apps/web/app/(app)/my-documents/*` | PDF service | Пользовательский кабинет подтверждён |
| Manual employee document creation UI | inactive | Intended internal staff | Server action и backend create есть, но активного экрана не найдено | Action/API only | `apps/web/actions/document.ts`, `apps/api/src/employee-documents/*` | Prisma | Выглядит как непривязанный или отложенный сценарий |
| Safety certificate API and employee cabinet | partial | Employee signer, internal staff | Хранит и показывает сертификаты, даёт PDF и расчёт эффективного статуса | Web `/my-certificates`, API `/v1/safety-certificates` | `apps/api/src/safety-certificates/*`, `apps/web/app/(app)/my-certificates/*` | PDF service | Активный админский список/CRUD по сертификатам в UI не подтверждён |
| Outgoing correspondence registry | confirmed | Company admin, safety engineer | Создаёт письма/КП, хранит их в реестре и позволяет скачать PDF | Web `/correspondence`, API `/v1/correspondence` | `apps/api/src/correspondence/*`, `apps/web/app/(app)/correspondence/page.tsx`, `apps/web/components/correspondence-editor.tsx` | PDF service | Поддерживает нескольких получателей на один документ |
| AI drafting and analysis for correspondence | confirmed | Company admin, safety engineer | Генерирует черновик, улучшает текст или анализирует письмо | UI buttons -> Next proxy -> API `ai-assist` | `apps/web/app/api/correspondence/ai/route.ts`, `apps/api/src/correspondence/correspondence.service.ts` | OpenAI Responses API, env fallback | При отсутствии `OPENAI_API_KEY` возвращается локальный fallback |
| DOCX export for correspondence | partial | Company admin, safety engineer | Генерирует Word-файл исходящего письма | Web correspondence registry -> docx link | `apps/api/src/correspondence/correspondence.service.ts`, `scripts/generate_correspondence_docx.py`, `docs/experimental/correspondence/*` | Python, `python-docx` | По коду жёстко привязан к компании с именем вроде `Stroy Company 2030` |
| Send correspondence to recipients | partial | Company admin, safety engineer | Переводит получателей в sent/failed и фиксирует статус отправки | Web `/correspondence` -> `sendCorrespondenceAction`, API `/v1/correspondence/:id/send` | `apps/web/actions/correspondence.ts`, `apps/api/src/correspondence/*` | Potential email delivery | Внешний mail transport не подтверждён; send выглядит как статусный процесс |

### 4.7 BIOT and Specialized Certificate Generation

| Feature name | Status | Who uses it | What it does | Entry points | Core files | Dependencies / integrations | Notes / limitations |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BIOT/PTM/PB/PS editor | confirmed | Company admin, safety engineer | Даёт интерфейс пакетной подготовки данных для удостоверений/протоколов | Web `/certificates/biot-experimental` | `apps/web/app/(app)/certificates/biot-experimental/page.tsx`, `apps/web/components/biot-card-generator.tsx` | API, Python generators, templates | Это фактическая активная certificates-зона |
| Saved request lifecycle | confirmed | Company admin, super admin | Сохраняет, открывает, редактирует и удаляет заявки генерации | Web `/certificates/requests/[id]/edit`, API request endpoints | `apps/api/src/biot-cards/*`, `apps/web/app/(app)/certificates/requests/[id]/edit/page.tsx` | Prisma | Управление сохранёнными заявками ограничено ролями |
| Batch export of cards/protocols/registry/witness docs | confirmed | Company admin, safety engineer | Выпускает DOCX/XLSX артефакты для пакета участников | BIOT request exports and generate endpoints | `apps/api/src/biot-cards/biot-cards.service.ts`, `scripts/export_card_request_registry.py`, `scripts/generate_biot_card.py`, `scripts/generate_biot_mail_merge_bundle.py`, `scripts/generate_ps_witness_certificate.py` | Python, `openpyxl`, `python-docx`, local templates | Зависит от файлов шаблонов в `docs/experimental` |
| Standard non-BIOT certificates landing | partial | Company admin, safety engineer | Раздел `/certificates` существует, но сразу редиректит в BIOT UI | Web `/certificates` | `apps/web/app/(app)/certificates/page.tsx` | Next redirect | Это признак смещения продукта в сторону BIOT-контура |

### 4.8 Translation Helper

| Feature name | Status | Who uses it | What it does | Entry points | Core files | Dependencies / integrations | Notes / limitations |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Job title translation RU -> KZ | confirmed | Company admin, safety engineer | Подсказывает перевод должности и профессии в форме сотрудника | Employee editor, API `/v1/translations/job-title` | `apps/api/src/translations/*`, `apps/web/components/job-title-translation-fields.tsx` | ETKS dataset | Это прикладной helper, встроенный в пользовательский сценарий |

## 5. User and System Flows

### 5.1 Администратор компании настраивает рабочий контур

1. Выбирает свою компанию или, если это `SUPER_ADMIN`, переключает tenant context.
2. Создаёт подразделения и подрядчиков.
3. Добавляет сотрудников, при необходимости сразу создаёт им аккаунт `EMPLOYEE_SIGNER`.
4. Дальше эти сущности используются в журналах, обучении, документах и BIOT-заявках.

**Evidence:** `apps/web/app/(app)/companies/page.tsx`, `apps/web/app/(app)/departments/page.tsx`, `apps/web/app/(app)/contractors/page.tsx`, `apps/web/app/(app)/employees/*`

### 5.2 Специалист по ОТ создаёт инструктаж и готовит его к подписи

1. Открывает `/journal/new`.
2. Выбирает одного или нескольких сотрудников.
3. Заполняет тему, даты, инструктора, материалы и начальный статус.
4. Система создаёт `BriefingRecord` или `BriefingBatch`.
5. При статусе `READY_FOR_SIGNING` формируются invite token, срок действия приглашения и notification jobs.
6. Запись попадает в журнал и на dashboard.

**Evidence:** `apps/web/app/(app)/journal/new/page.tsx`, `apps/api/src/briefing-records/briefing-records.service.ts`, `apps/api/src/notifications/notifications.service.ts`

### 5.3 Сотрудник проходит инструктаж в личном кабинете

1. Открывает `/my-instructions`.
2. Заходит в конкретную запись.
3. Сначала открывает запись, затем подтверждает ознакомление.
4. После этого подписывает инструктаж.
5. Система сохраняет подпись, переводит запись в `SIGNED`, закрывает reminders и пишет audit event.

**Evidence:** `apps/web/app/(app)/my-instructions/*`, `apps/api/src/briefing-records/briefing-records.service.ts`, `apps/api/src/signatures/signatures.service.ts`

### 5.4 Система без участия пользователя отслеживает просрочки и неподписанные записи

1. Worker по расписанию сканирует repeated briefings и записи в ожидании подписи.
2. Создаёт reminders и notification jobs.
3. Отдельный цикл помечает jobs как обработанные и переводит reminders в sent/resolved при нужных условиях.
4. Dashboard и notification list читают эти данные.

**Evidence:** `apps/worker/src/main.ts`, `apps/api/src/dashboard/dashboard.service.ts`, `apps/api/src/notifications/notifications.service.ts`

**Status note:** внешний канал доставки по email/SMS не подтверждён; процесс подтверждён как внутренняя очередь и статусная автоматизация.

### 5.5 Администратор назначает обучение, сотрудник сдаёт экзамен, система выпускает артефакты

1. В `/training` создаётся программа с материалами и списком сотрудников.
2. При необходимости в `/testing` создаётся экзамен для программы.
3. Сотрудник проходит материал в `/my-training`.
4. Если экзамен обязателен, сотрудник идёт в `/my-testing`, проходит тест и получает результат.
5. После успешного завершения assignment система может автоматически создать employee document и/или safety certificate.

**Evidence:** `apps/web/app/(app)/training/page.tsx`, `apps/web/app/(app)/testing/page.tsx`, `apps/web/app/(app)/my-training/*`, `apps/web/app/(app)/my-testing/*`, `apps/api/src/training-programs/training-programs.service.ts`, `apps/api/src/exams/exams.service.ts`

### 5.6 Компания готовит внутренние документы и исходящую переписку

1. В `/documents` создаются записи внутренних документов по категориям.
2. Их можно выгружать в PDF и DOCX.
3. В `/correspondence` формируется письмо или коммерческое предложение с несколькими получателями.
4. При необходимости используется AI draft/improve/analyze.
5. Документ сохраняется в реестр, далее его можно скачать и инициировать send flow.

**Evidence:** `apps/web/app/(app)/documents/page.tsx`, `apps/web/app/(app)/correspondence/page.tsx`, `apps/web/components/correspondence-editor.tsx`, `apps/api/src/company-documents/*`, `apps/api/src/correspondence/*`

**Status note:** подтверждён реестр, сохранение и экспорт; полноценная внешняя отправка писем остаётся частичной.

### 5.7 Оператор готовит BIOT/PTM/PB/PS пакет документов

1. Открывает `/certificates/biot-experimental`.
2. Выбирает тип удостоверения/протокола и сотрудников или training assignments.
3. При необходимости создаёт certificate-only employee.
4. Сохраняет заявку либо сразу запускает batch generation.
5. Скачивает реестр, DOCX-удостоверения, протокол и witness-документы.
6. Позже может открыть сохранённую заявку на редактирование.

**Evidence:** `apps/web/app/(app)/certificates/biot-experimental/page.tsx`, `apps/web/app/(app)/certificates/requests/[id]/edit/page.tsx`, `apps/web/components/biot-card-generator.tsx`, `apps/api/src/biot-cards/*`, `scripts/*biot*`

## 6. Data Model and Business Entities

### Центральные сущности

- `Company`: главный tenant, к которому привязаны пользователи, сотрудники, подразделения, журналы, документы, обучение и генерация артефактов.
- `User`: учётная запись с ролью и привязкой к компании.
- `Employee`: основной носитель кадровых и комплаенс-данных; может быть связан с `User`.
- `Department`, `ContractorCompany`, `Site`: организационный контекст сотрудника и инструктажей.

### Сущности инструктажей и подписаний

- `BriefingRecord`: отдельная запись инструктажа.
- `BriefingBatch`: группирует пакетные записи инструктажей.
- `Signature`: хранит факт и метаданные подписи.
- `Reminder` и `NotificationJob`: обеспечивают внутренний контур напоминаний и очереди.
- `AuditLog`: фиксирует ключевые действия системы и пользователей.

### Сущности обучения и проверки знаний

- `TrainingProgram`: определяет материал, issuer и правила завершения.
- `TrainingAssignment`: назначение программы конкретному сотруднику.
- `Exam`, `ExamQuestion`, `ExamOption`, `ExamAttempt`: модель тестирования знаний.

### Документные сущности

- `EmployeeDocument`: персональный документ сотрудника.
- `SafetyCertificate`: сертификат/удостоверение, в том числе создаваемый из обучения.
- `CompanyDocument`: внутренний документ компании.
- `Correspondence` и `CorrespondenceRecipient`: исходящие письма/КП и список получателей.

### BIOT-контур

- `CardGenerationRequest` и `CardGenerationRequestItem`: сохранённые наборы данных для пакетной генерации удостоверений, протоколов и сопутствующих документов.

### Подтверждённые связи

- компания является сквозной границей доступа почти для всех сущностей;
- сотрудник может иметь аккаунт `EMPLOYEE_SIGNER`;
- инструктаж связан с сотрудником, компанией, подразделением и подписями;
- обучение связано с сотрудником и программой, а экзамен связан с программой;
- завершение обучения может породить документ и сертификат;
- correspondence имеет одного автора и несколько получателей;
- BIOT generation request хранит пакет участников и данные для повторных экспортов.

**Evidence:** `packages/database/prisma/schema.prisma`, `apps/api/src/*/*.service.ts`

## 7. API and Service Surface

### Public / semi-public surface

- `/v1/auth/login`, `/v1/auth/me`: аутентификация и профиль.
- Public invite flow для подписи инструктажа без логина: реализован через public methods в signatures service и web route `/invite/[token]`.
- Next.js proxy routes в `apps/web/app/api/*` проксируют бинарные выгрузки и AI/certificate helper endpoints в backend.

### Internal authenticated business API

- Companies, departments, contractor companies, employees: управление справочниками и персоналом.
- Briefing records and signatures: журнал, batch creation, prepare-signing, open/acknowledge/sign, PDF export.
- Dashboard, notifications, audit: summary, queue view, traceability.
- Training assignments and exams: создание, назначение, прохождение, проверка.
- Company documents, employee documents, safety certificates: реестры, чтение, скачивание, часть create-операций.
- Correspondence: create, send, PDF/DOCX export, AI assist.
- Biot cards: defaults, generate, generate-batch, saved requests CRUD, registry/cards/protocol/witness exports.
- Translations: job title translation helper.

### Background / service surface

- Worker queues:
  - compliance scan every 15 minutes;
  - notification processing every 5 minutes.
- PDF service: серверная генерация PDF для journal, briefing record, employee document, company document, safety certificate, BIOT ITR certificate, correspondence.
- Python runtime scripts: DOCX/XLSX generation for company docs, correspondence, BIOT bundle, PS witness certificate.

**Evidence:** `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/web/app/api/*`, `apps/worker/src/main.ts`, `apps/api/src/pdf/pdf.service.ts`, `scripts/*`

## 8. Integrations and External Dependencies

| Integration / dependency | Purpose | Where it appears | Confirmation level | Notes |
| --- | --- | --- | --- | --- |
| PostgreSQL + Prisma | Основное хранение данных, миграции, связи сущностей | `packages/database/prisma/schema.prisma`, `apps/api/src/database/prisma.service.ts`, worker and API services | confirmed | Это основной persistence layer |
| Redis + BullMQ | Очередь фоновых задач и периодические сканы | `apps/worker/src/main.ts` | confirmed | Используется для напоминаний и notification jobs |
| OpenAI Responses API | AI-помощник для переписки | `apps/api/src/correspondence/correspondence.service.ts`, `.env.example` | confirmed | При отсутствии `OPENAI_API_KEY` есть fallback |
| Python runtime + `python-docx` + `openpyxl` | Генерация DOCX/XLSX-документов и реестров | `scripts/requirements-runtime.txt`, `scripts/*.py`, соответствующие backend services | confirmed | Критично для company-documents, correspondence DOCX и BIOT exports |
| Local DOCX/XLSX templates under `docs/experimental` | Шаблоны удостоверений, протоколов, witness и писем | `docs/experimental/*`, BIOT/correspondence services | confirmed | Несмотря на имя каталога, шаблоны участвуют в активных сценариях |
| JWT cookies | Session/auth layer | `apps/web/lib/api.ts`, auth module | confirmed | Внешний SSO/IdP не подтверждён |
| Field encryption key | Защита чувствительных персональных данных | `.env.example`, employees service usage | confirmed | Применяется к ИИН |
| External email provider | Потенциальная отправка уведомлений/писем | Notification and correspondence send flows | not confirmed | В коде нет подтверждённого mail transport |
| Local NCALayer runtime + bridge | Local legal-signature transport for DSJ signing flows | `apps/ncalayer-bridge`, `apps/api/src/signatures/*`, `apps/web/lib/ncalayer-bridge.ts`, env examples | confirmed in repo, external runtime still required on signer machine | Bridge implementation is now in-repo; installed NCALayer desktop runtime and end-user certificate estate remain external dependencies |

## 9. Feature Flags, Restricted Logic, and Environment-Dependent Behavior

- Signing runtime configuration:
  - `SIGNING_PROVIDER` must be explicitly set to `NCALAYER` or `MOCK_NCALAYER`; when unset the signing UI/API stay unavailable instead of silently falling back.
  - `NCALAYER_BRIDGE_URL` is required when `SIGNING_PROVIDER=NCALAYER` and points to the local bridge, not directly to the NCALayer websocket.
  - `NCALAYER_BRIDGE_TIMEOUT_MS` controls bridge health/sign request timeouts.
  - `SIGNING_TEST_MODE` is explicit and only changes test affordances and NCALayer test-signer selection.
- `ALLOW_PUBLIC_INVITE_MOCK_SIGNING=false` в `.env.example`:
  - публичное mock-подписание по invite token выключено по умолчанию;
  - это подтверждённый feature-flagged сценарий.
- `OPENAI_API_KEY` и `OPENAI_MODEL`:
  - AI-помощник для переписки работает полноценно только при наличии ключа;
  - без ключа backend возвращает fallback-ответ.
- `SEED_ALLOW_DESTRUCTIVE_RESET=false` и отдельные `SEED_*` переменные:
  - seed защищён от случайного destructive запуска;
  - дополнительно проверяется локальная БД и запрет запуска в production.
- Role restrictions:
  - `SUPER_ADMIN` имеет кросс-компанейный доступ;
  - `COMPANY_ADMIN` и `SAFETY_ENGINEER` покрывают большую часть операционного UI;
  - `EMPLOYEE_SIGNER` имеет отдельный self-service кабинет;
  - некоторые BIOT-операции по сохранённым заявкам ограничены ролью `COMPANY_ADMIN`.
- Environment-dependent document generation:
  - DOCX-сценарии зависят от установленного Python runtime и библиотек из `scripts/requirements-runtime.txt`;
  - correspondence Word export зависит ещё и от специализированного шаблона.
- Company-name restricted logic:
  - Word-экспорт переписки активируется по коду только для компании, чьё имя совпадает с ожидаемым шаблоном `Stroy Company 2030`.

**Evidence:** `.env.example`, `packages/database/prisma/seed.ts`, `apps/api/src/signatures/signatures.service.ts`, `apps/api/src/correspondence/correspondence.service.ts`, `apps/web/lib/auth.ts`, `scripts/requirements-runtime.txt`

## 10. Incomplete / Suspicious / Dormant Functionality

- `Site` как продуктовая сущность:
  - модель, seed-данные и backend validation есть;
  - отдельного UI, меню и подтверждённого CRUD нет;
  - выглядит как начатая, но не доведённая функциональная зона.
- NCALayer signing runtime:
  - repo-local bridge and provider implementation are now confirmed;
  - actual signing still depends on the external NCALayer desktop runtime and a locally running bridge process;
  - legal and operational acceptance now depends on runtime deployment and certificate operations outside this repository.
- Уведомления наружу:
  - reminders и notification jobs реально создаются и обрабатываются;
  - доставка через email/SMS/in-app outside queue-state не подтверждена.
- Send flow для correspondence:
  - статусы `SENT` / `FAILED` у получателей проставляются;
  - интеграции с внешним transport не видно;
  - выглядит как частично доведённый процесс.
- Manual employee document creation UI:
  - server action и backend create имеются;
  - активной страницы или формы не найдено.
- Safety certificate admin surface:
  - backend и employee cabinet подтверждены;
  - админский раздел `/certificates` редиректит в `biot-experimental`;
  - классический UI-реестр сертификатов по аналогии с `/documents` не подтверждён.
- "Experimental" assets in active flow:
  - BIOT и correspondence DOCX шаблоны лежат в `docs/experimental`;
  - при этом используются в реальных сценариях;
  - это признак незакрытого переходного состояния, а не чисто выключенной фичи.
- Package-level lint/test commands:
  - в активном `dsj2/package.json` `pnpm lint` и `pnpm test` намеренно падают сообщением, что package-level tasks не настроены;
  - реальным build gate служит `pnpm verify`;
  - это не продуктовая фича, но важный сигнал о зрелости engineering-процесса.

## 11. Gaps in Documentation

- Нужна отдельная документация по BIOT/PTM/PB/PS бизнес-правилам:
  - правила нумерации удостоверений, протоколов и witness-документов;
  - различия между `WORKER_CARD` и `ITR_CERTIFICATE`.
- Нужна явная карта ролей и permission matrix по страницам, API и операциям.
- Нужна документация по реальному expected production path для EDS, email delivery и worker runtime.
- Нужна документация по deployment prerequisites:
  - Redis;
  - Python runtime;
  - наличие шаблонов в `docs/experimental`;
  - OpenAI key для AI assist.
- Нужна документация по жизненному циклу employee documents и safety certificates:
  - какие сущности должны создаваться вручную;
  - какие только автоматически из обучения;
  - какой UI считается основным.
- Нужна документация по tenant model и политике удаления/архивирования компаний, сотрудников и связанных сущностей.

## 12. Presentation-Ready Summary

- Система уже покрывает основной цифровой контур охраны труда: сотрудники, инструктажи, подписи, контроль просрочек и аудит.
- Есть разделение ролей и tenant-scoped работа по компаниям, включая супер-админский межкомпанейный режим.
- Журнал инструктажей реализован как полноценный рабочий модуль: batch creation, invite links, кабинет сотрудника, PDF-выгрузки.
- Контур обучения уже связан с тестированием и может автоматически выпускать документы и сертификаты по результатам прохождения.
- Помимо комплаенс-ядра, система включает рабочие реестры внутренних документов и исходящей переписки.
- BIOT/PTM/PB/PS генерация удостоверений и протоколов является крупным и реально активным модулем, а не прототипом на уровне модели.
- Сильная сторона проекта: сочетание продуктового UI, backend-логики, фоновых процессов и файловой генерации в одном контуре.
- Основные ограничения сейчас: нет подтверждённой production-интеграции реального EDS, внешней отправки уведомлений и единого зрелого UI для всех видов сертификатов/employee documents.
- Часть важных сценариев зависит от окружения: Redis, Python runtime, локальные шаблоны и, для AI assist, OpenAI API key.



