# Экспериментальный BIOT-генератор

Это отдельный admin-only модуль для генерации карточек/удостоверений BIOT и связанных DOCX-артефактов. Он живёт рядом с основным журналом инструктажей, но сейчас уже используется как активная рабочая поверхность, а не просто прототип.

## Что делает

- берёт шаблон [`biot-card-template.docx`](./biot-card-template.docx)
- подставляет значения в `MERGEFIELD`
- удаляет внешнюю mail merge-связь с Excel
- поддерживает таблицу на несколько сотрудников
- автоматически предлагает следующий номер удостоверения и протокола
- отдаёт готовый `.docx` на скачивание или `.zip`, если сотрудников несколько

## Где доступно

- страница администратора `/certificates/biot-experimental`
- API `POST /v1/biot-cards/generate`
- API `GET /v1/biot-cards/defaults`
- API `POST /v1/biot-cards/generate-batch`
- web proxy `POST /api/biot-cards/generate`
- web proxy `GET /api/biot-cards/defaults`
- web proxy `POST /api/biot-cards/requests`

## Текущие артефакты в каталоге

- `biot-card-reference.xlsx`
- `biot-card-template.docx`
- `biot-itr-certificate-background.jpg`
- `biot-itr-certificate-template.docx`
- `biot-protocol-template.docx`

## Почему сделано отдельно

- чтобы протестировать UX и шаблон без миграций и без влияния на реестр удостоверений
- чтобы при необходимости удалить функцию изолированно, без каскадных изменений в ядре продукта

## Текущие ограничения

- генерация идёт только в `.docx` и `.zip` из `.docx`
- PDF-конвертация не подключена
- поля на казахском пока подставляются вручную или копируются из русских значений
- выпуск документа пока не сохраняется в БД как отдельная сущность

## Следующий шаг, если функция подтвердится

- привязать выпуск к `SafetyCertificate` / `EmployeeDocument`
- добавить batch-генерацию на группу сотрудников
- вынести DOCX/PDF-генерацию в worker
