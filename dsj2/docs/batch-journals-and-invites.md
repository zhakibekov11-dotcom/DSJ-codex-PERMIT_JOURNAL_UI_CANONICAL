# Batch-журналы и персональные ссылки

## Что добавлено

- Один инструктаж теперь может создаваться сразу на нескольких сотрудников.
- Для группового инструктажа создаётся `BriefingBatch`.
- Каждый участник batch получает отдельную запись `BriefingRecord`.
- У каждой записи хранится собственный `inviteToken`, срок действия ссылки и отметка о завершении регистрации.

## Как это работает

1. Пользователь создаёт инструктаж и выбирает нескольких сотрудников.
2. Backend создаёт общий `BriefingBatch` и отдельный `BriefingRecord` на каждого участника.
3. Если инструктаж сразу переводится в `READY_FOR_SIGNING`, для каждого участника:
   - считается `documentHash`
   - создаётся `inviteToken`
   - формируется персональная ссылка `/invite/{token}`
   - в `NotificationJob` ставится задача `SIGNING_LINK_INVITE`
4. Участник открывает публичную ссылку, подтверждает контакты и выполняет mock-подписание.
5. Подпись сохраняется в `Signature`, а запись получает `SIGNED` и `registrationCompletedAt`.

## Новые сущности и поля

- `ContractorCompany`
- `BriefingBatch`
- `Employee.contractorCompanyId`
- `Employee.employeeKind`
- `BriefingRecord.briefingBatchId`
- `BriefingRecord.inviteToken`
- `BriefingRecord.inviteTokenExpiresAt`
- `BriefingRecord.inviteSentAt`
- `BriefingRecord.registrationCompletedAt`

## Ограничения MVP

- Редактирование состава участников после создания batch пока не поддерживается.
- Отправка ссылки реализована через очередь уведомлений и mock delivery payload, без реального email/SMS провайдера.
- ????????? ?????????? ?????? ?????????? ??? ?? provider-aware signing contract, ??? ? ????????? flows; mock ???????? ?????? explicit non-production fallback.

## NCALayer Runtime Status

This section supersedes earlier MVP/mock-only wording in this document.

- Admin signing, employee self-service signing, and public invite signing now submit one signing contract.
- The public invite page renders the signing form only when the backend returns signingAvailable=true; there is no extra provider switch in the UI.
- In NCALayer mode the browser talks to the local bridge for /health and /sign, receives CMS plus certificate metadata plus signedAt, and submits that provider payload to the DSJ API.
- The API re-checks documentHash, validates certificate metadata, and matches signer IIN against the employee record before the signature is persisted.
- ALLOW_PUBLIC_INVITE_MOCK_SIGNING remains only a non-production fallback path.
- External dependency: the signer machine still needs the installed NCALayer desktop runtime and a local bridge process reachable at NCALAYER_BRIDGE_URL.


