# DSJ Technical Debt Audit

Актуально на: 2026-03-31

Этот документ фиксирует результаты forensic-style аудита репозитория `dsj2/` с фокусом на:

- security / tenant isolation / auth
- Prisma / migrations / generated client
- worker / queue / notifications
- document generation / binary proxy routes
- runtime / deploy / verification drift
- structural maintenance debt

## Executive Summary

- Главный риск проекта: система местами утверждает `SIGNED` и `SENT` без внешне доказуемого события.
- Самая опасная зона: public signing flow в `apps/api/src/signatures/*` и `apps/web/app/invite/[token]/page.tsx`.
- Главная structural weakness: tenant invariants не зафиксированы жёстко на уровне DB relations для `departmentId` / `siteId`.
- Главный bottleneck развития: отсутствует доверенный verification path. `pnpm typecheck` падает, `pnpm test` и `pnpm lint` не исполняют реальные tasks.

## Top Critical Problems

### 1. Public signing flow фактически forgeable

- Severity: Critical
- Type: security risk / current bug
- Evidence:
  - `apps/api/src/signatures/signatures.controller.ts:52`
  - `apps/api/src/signatures/signatures.controller.ts:58`
  - `apps/api/src/signatures/signatures.service.ts:293`
  - `apps/api/src/signatures/signatures.service.ts:341`
  - `apps/api/src/signatures/providers/mock-signing.provider.ts:28`
  - `apps/web/actions/public-invite.ts:25`
  - `apps/web/app/invite/[token]/page.tsx:163`
- Why it matters:
  - публичный invite token даёт доступ к PII и позволяет завершить подпись через mock-provider
  - unauthenticated flow дополнительно меняет `employee.email` и `employee.phone`
  - это создаёт ложный compliance/security invariant

### 2. Public invite response может leak-ить signature metadata

- Severity: Critical
- Type: security risk
- Evidence:
  - `apps/api/src/signatures/signatures.service.ts:99`
  - `apps/api/src/signatures/signatures.service.ts:321`
  - `packages/database/prisma/schema.prisma:670`
  - `packages/database/prisma/schema.prisma:680`
  - `packages/database/prisma/schema.prisma:683`
- Why it matters:
  - публичный DTO возвращает `record.signatures`
  - модель `Signature` содержит `certificateSerial`, `ipAddress`, `userAgent`, `payload`

### 3. Cross-tenant integrity не enforce-ится в schema

- Severity: Critical
- Type: design debt / security risk
- Evidence:
  - `packages/database/prisma/schema.prisma:216`
  - `packages/database/prisma/schema.prisma:286`
  - `packages/database/prisma/schema.prisma:370`
  - `packages/database/prisma/migrations/202603211430_init/migration.sql:288`
  - `packages/database/prisma/migrations/202603211430_init/migration.sql:297`
- Why it matters:
  - `User`, `Employee`, `BriefingRecord` ссылаются на `Department(id)` и `Site(id)` без composite tenant constraint
  - БД допускает structurally valid cross-tenant links

### 4. Service layer принимает cross-tenant `departmentId/siteId`

- Severity: Critical
- Type: current bug / security risk
- Evidence:
  - `apps/api/src/employees/employees.service.ts:219`
  - `apps/api/src/employees/employees.service.ts:422`
  - `apps/api/src/briefing-records/briefing-records.service.ts:766`
  - `apps/api/src/briefing-records/briefing-records.service.ts:885`
- Why it matters:
  - даже без schema fix сейчас можно записать bad foreign references
  - это может привести к leaks, broken reports и inconsistent access behavior

### 5. Notification dispatch симулирует delivery

- Severity: Critical
- Type: operational risk / current bug
- Evidence:
  - `apps/worker/src/main.ts:167`
  - `apps/worker/src/main.ts:181`
  - `apps/worker/src/main.ts:191`
  - `apps/api/src/notifications/notifications.service.ts:65`
- Why it matters:
  - worker переводит jobs в `processing` и затем `sent` без transport call
  - failure между update-ами оставляет stuck/inconsistent state

### 6. Correspondence `send()` не отправляет письмо

- Severity: Critical
- Type: correctness risk / operational risk
- Evidence:
  - `apps/api/src/correspondence/correspondence.service.ts:354`
  - `apps/api/src/correspondence/correspondence.service.ts:380`
  - `apps/api/src/correspondence/correspondence.service.ts:391`
- Why it matters:
  - если у recipient есть email, запись просто помечается как `SENT`
  - статус письма перестаёт соответствовать реальному миру

### 7. Reminder/job dedup race-prone

- Severity: High
- Type: latent bug / operational risk
- Evidence:
  - `apps/worker/src/main.ts:37`
  - `apps/worker/src/main.ts:52`
  - `apps/api/src/notifications/notifications.service.ts:38`
  - `apps/api/src/notifications/notifications.service.ts:53`
  - `apps/api/src/notifications/notifications.service.ts:85`
- Why it matters:
  - логика dedup это `findFirst` + `create`
  - под конкуренцией появятся duplicate reminders и duplicate notification jobs

### 8. Seed destructive-by-default

- Severity: High
- Type: operational risk
- Evidence:
  - `packages/database/prisma/seed.ts:15`
  - `packages/database/prisma/seed.ts:34`
  - `packages/database/prisma/seed.ts:36`
  - `.env.example:12`
  - `.env.example:13`
- Why it matters:
  - seed удаляет почти все core tables
  - script не защищён от запуска вне disposable DB
  - дефолтные admin credentials небезопасны

### 9. Typecheck baseline уже broken

- Severity: High
- Type: current bug / operability risk
- Evidence:
  - `pnpm typecheck` падает в `@dsj/api`
  - после `pnpm --filter @dsj/database db:generate` ошибки остаются
  - ошибки включают Prisma namespace drift и массовый `implicit any`
- Why it matters:
  - репозиторий нельзя считать защищённым от регрессий
  - любые refactor/security fixes будут делаться поверх already-broken baseline

### 10. Document pipeline зависит от machine/runtime assumptions

- Severity: High
- Type: operational risk / runtime drift
- Evidence:
  - `apps/api/src/pdf/pdf.service.ts:173`
  - `apps/api/src/pdf/pdf.service.ts:507`
  - `apps/api/src/correspondence/correspondence.service.ts:44`
  - `apps/api/src/company-documents/company-documents.service.ts:108`
- Why it matters:
  - PDF использует macOS font paths
  - correspondence template лежит в `docs/experimental`
  - DOCX generation требует `python3` subprocess и workspace layout assumptions

## Top Maintenance Debts

1. `apps/api/src/biot-cards/biot-cards.service.ts` стал risky god-module.
2. `apps/api/src/briefing-records/briefing-records.service.ts` совмещает слишком много разных обязанностей.
3. Notification logic размазана между API и worker.
4. Web binary proxy routes копипастят несовместимые стратегии forwarding.
5. Web auth/session layer использует manual local shapes вместо shared DTO.
6. Prisma generated-client drift не контролируется надёжным process/gate.
7. Production runtime assets лежат под `docs/experimental`.
8. Request-driven `companyId` слишком широко распространён по controllers/services.
9. Side-effectful domains не имеют outbox/provider abstraction.
10. Нет document/queue/security smoke fixtures для безопасных изменений.

## Quick Wins

### Immediate

- Отключить public `mock-sign` в production через env flag.
- Перестать использовать `SENT` без реального transport/delivery receipt.
- Добавить hard guard в seed: abort unless explicit destructive flag.
- Добавить минимальный CI gate на `db:generate` + `typecheck`.
- Вынести единый helper для binary proxy routes.

## No-Autonomy Zones for Codex

- Tenant-related Prisma migrations и relation rewiring.
- Auth/public invite/signature/encryption flows.
- Seed/reset/bootstrap scripts.
- Worker idempotency and notification status semantics.
- Runtime/deploy changes для Docker, Python, fonts, templates и external providers.

## Practical Remediation Roadmap

### 24 hours

- Закрыть public `mock-sign` и урезать public invite DTO до минимального набора полей.
- Убрать ложные `SENT` semantics в worker и correspondence.
- Защитить seed script от destructive misfire.
- Зафиксировать broken verification baseline и завести минимальный CI.

### 7 days

- Добавить same-company validation для `departmentId/siteId` во всех create/update путях.
- Ввести unique constraints / upsert для reminder/job dedup.
- Починить Prisma/client/typecheck drift.
- Унифицировать binary proxy forwarding.

### 30 days

- Спроектировать DB-level tenant hardening migration.
- Перевести delivery flows на real outbound architecture.
- Перестроить public signing на verified one-time flow.
- Завести smoke suite для document generation и worker flows.

## Validation Gaps

- Не подтверждено наличие bad rows в живой БД без runtime data audit.
- Не проверен live transport для email/signature providers вне audited code paths.
- Не выполнен full document smoke run на production-like runtime/fonts/templates.
- Не проверено поведение worker под нагрузкой с реальным Redis contention.
- Не проверен live deploy path на Vercel/Railway.
