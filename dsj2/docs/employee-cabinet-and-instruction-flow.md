# Личный кабинет сотрудника и прохождение инструктажей

## Что добавлено

- Связь `User` ↔ `Employee` для личных кабинетов сотрудников без отдельной таблицы аккаунтов.
- Employee-facing прогресс инструктажа поверх существующей модели журнала:
  - `ASSIGNED`
  - `OPENED`
  - `ACKNOWLEDGED`
  - `SIGNED`
  - `OVERDUE` как вычисляемое отображение по `completionDueAt`
- Материал инструктажа в записи журнала:
  - `materialContent`
  - `materialFileName`
  - `materialFileUrl`
- Самостоятельное прохождение сотрудником через кабинет:
  - открыть инструктаж
  - подтвердить ознакомление
  - подписать запись
- Фиксация подписи с IP и user-agent для MVP-аудита.

## Почему без отдельной таблицы assignment

В текущем продукте уже существует сущность `BriefingRecord`, которая по факту и является назначением инструктажа сотруднику.

Поэтому employee-flow встроен прямо в неё:

- админский статус записи остаётся в `status`
- шаг сотрудника хранится в `employeeStatus`
- история прохождения опирается на ту же запись журнала

Это позволило расширить продукт без смены основной архитектуры и без дублирования данных.

## Ограничения текущего MVP

- ЭЦП/NCALayer подключаются через отдельный local bridge на тестовом контуре, а mock self-sign flow остаётся fallback для demo/dev.
- `OVERDUE` сейчас вычисляется по `completionDueAt`, а не синхронизируется воркером в БД.
- Создание личного кабинета сотрудника добавлено в сценарий создания сотрудника; полноценное управление аккаунтом сотрудника из отдельной карточки — следующий шаг.
- Материалы инструктажа поддерживаются как текст и ссылка на файл; полноценный upload-флоу не добавлялся.

## Что логично делать дальше

1. Вынести управление employee-аккаунтом в отдельную карточку сотрудника.
2. Добавить напоминания сотруднику по `completionDueAt`.
3. Local bridge/NCALayer ??? ?????????? ????? ?????????? ??????? signature provider; ?????? ????? ????? ?????? ???????? ??????? runtime rollout ? ???????????? ??????????.
4. Добавить тесты/вопросы как опциональный слой перед подписью, не ломая базовый журнал.
5. Добавить выпуск персонального документа после завершения инструктажа.

## Current Signing Status

This section supersedes the older roadmap note about connecting NCALayer later.

- Employee self-service signing now uses the same provider-aware /sign contract as admin signing and public invite signing.
- In SIGNING_PROVIDER=NCALAYER the web client submits bridge payload containing documentHash digest, CMS, certificate metadata, and signedAt.
- The API validates digest match, certificate metadata, certificate validity window, and signer IIN against the employee record before completing the signature.
- In SIGNING_PROVIDER=MOCK_NCALAYER the employee self-sign flow still falls back to the server-side mock path for local/demo use.
- No provider chooser was added to the UI; the active branch is controlled only by explicit environment configuration.


