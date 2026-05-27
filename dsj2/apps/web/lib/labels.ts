export const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Суперадминистратор",
  COMPANY_ADMIN: "Администратор компании",
  SAFETY_ENGINEER: "Инженер по охране труда",
  EMPLOYEE_SIGNER: "Сотрудник",
};

export const briefingTypeLabels: Record<string, string> = {
  INTRODUCTORY: "Вводный",
  PRIMARY: "Первичный",
  REPEATED: "Повторный",
  UNSCHEDULED: "Внеплановый",
  TARGETED: "Целевой",
};

export const briefingJournalKindLabels: Record<string, string> = {
  INTRODUCTORY: "Журнал вводных инструктажей",
  WORKPLACE: "Журнал инструктажей на рабочем месте",
};

export const briefingSignerRoleLabels: Record<string, string> = {
  BRIEFING_INSTRUCTOR: "Инструктирующий",
  BRIEFED_EMPLOYEE: "Инструктируемый сотрудник",
};

export const responsibilityTypeLabels: Record<string, string> = {
  OCCUPATIONAL_SAFETY_RESPONSIBLE: "Ответственный за охрану труда",
  FIRE_SAFETY_RESPONSIBLE: "Ответственный за пожарную безопасность",
  DEPARTMENT_RESPONSIBLE: "Ответственный по подразделению",
  OBJECT_RESPONSIBLE: "Ответственный по объекту",
  INSTRUCTOR_APPOINTMENT: "Назначение инструктора",
  BRIEFING_AUTHORIZED_PERSON: "Уполномоченное лицо по инструктажу",
  PERMIT_ISSUER_AUTHORIZED_PERSON: "Уполномоченное лицо по наряду-допуску",
  RESPONSIBLE_WORK_MANAGER: "Ответственный руководитель работ",
};

export const statusLabels: Record<string, string> = {
  DRAFT: "Черновик",
  SUBMITTED: "Отправлено",
  IN_APPROVAL: "На согласовании",
  APPROVED: "Согласовано",
  READY_TO_SEND: "Готово к отправке",
  PARTIALLY_SENT: "Частично отправлено",
  READY_FOR_SIGNING: "Готово к подписанию",
  SIGNED: "Подписано",
  CLOSED: "Закрыто",
  SUSPENDED: "Приостановлено",
  ARCHIVED: "В архиве",
  ACTIVE: "Действует",
  EXPIRING: "Истекает",
  EXPIRED: "Истёк",
  EXPIRING_SOON: "Скоро истекает",
  ASSIGNED: "Назначен",
  OPENED: "Открыт",
  ACKNOWLEDGED: "Ознакомлен",
  IN_PROGRESS: "В процессе",
  COMPLETED: "Завершено",
  OVERDUE: "Просрочен",
  AVAILABLE: "Доступен",
  NOT_STARTED: "Не начат",
  PASSED: "Сдан",
  FAILED: "Не сдан",
  account_enabled: "Кабинет создан",
  account_disabled: "Нет кабинета",
  queued: "В очереди",
  processing: "В обработке",
  sent: "Отправлено",
  failed: "Ошибка",
  skipped: "Пропущено",
  pending: "Ожидает",
  PENDING: "Ожидает отправки",
  VERIFIED: "Проверено",
  REJECTED: "Отклонено",
  admitted: "Допущен",
  limited: "Ограничен",
  blocked: "Заблокирован",
  draft: "Черновик",
  pending_precheck: "На проверке документов",
  missing_documents: "Не хватает документов",
  pending_approval: "На согласовании",
  on_approval: "На согласовании",
  approved: "Утверждено",
  signed: "Подписано",
  suspended: "Приостановлено",
  extended: "Продлено",
  closed: "Закрыто",
  rejected: "Отклонено",
  cancelled: "Отменено",
  annulled: "Аннулировано",
  replaced: "Заменено",
  expired: "Истёк",
  archived: "В архиве",
  resolved: "Закрыто",
  active: "Активен",
  inactive: "Неактивен",
  SIGNING_READY: "Готово к подписанию",
  PARTIALLY_SIGNED: "Частично подписано",
  ANNULLED: "Аннулировано",
  SUPERSEDED: "Заменено",
};

export const employeeKindLabels: Record<string, string> = {
  INTERNAL: "Штатный сотрудник",
  CONTRACTOR: "Подрядчик",
};

export const documentTypeLabels: Record<string, string> = {
  CERTIFICATE: "Сертификат",
  PROTOCOL: "Протокол",
  STATEMENT: "Справка",
  COMPLETION_CONFIRMATION: "Подтверждение прохождения",
  SAFETY_CERTIFICATE: "Удостоверение",
};

export const companyDocumentCategoryLabels: Record<string, string> = {
  LOCAL_ACT: "Локальные акты",
  ORDER: "Приказы",
  INSTRUCTION: "Инструкции",
  JOURNAL: "Журналы",
  TRAINING_CERTIFICATION: "Обучение и аттестация",
};

export const notificationTypeLabels: Record<string, string> = {
  UNSIGNED_RECORD_PENDING: "Ожидается подпись",
  REPEATED_BRIEFING_OVERDUE: "Просрочен повторный инструктаж",
  SIGNING_LINK_INVITE: "Ссылка на регистрацию и подписание",
};

export const auditActionLabels: Record<string, string> = {
  "company.created": "Компания создана",
  "company.deleted": "Компания удалена",
  "contractor_company.created": "Подрядная компания создана",
  "contractor_company.updated": "Подрядная компания обновлена",
  "contractor_company.deleted": "Подрядная компания удалена",
  "department.created": "Подразделение создано",
  "employee.created": "Сотрудник создан",
  "employee.updated": "Данные сотрудника обновлены",
  "employee.archived": "Сотрудник уволен и отправлен в архив",
  "briefing.created": "Запись инструктажа создана",
  "briefing.updated": "Запись инструктажа обновлена",
  "briefing.opened": "Инструктаж открыт сотрудником",
  "briefing.acknowledged": "Ознакомление подтверждено",
  "briefing.ready_for_signing": "Запись подготовлена к подписанию",
  "briefing.archived": "Запись отправлена в архив",
  "briefing.signed": "Запись подписана",
  "document.created": "Документ сотрудника создан",
  "company_document.created": "Документ компании создан",
  "certificate.created": "Удостоверение создано",
  "correspondence.created": "Письмо или КП создано",
  "correspondence.sent": "Письмо отправлено по реестру",
  "training.created": "Обучение назначено",
  "training.started": "Обучение начато",
  "training.material_completed": "Материал обучения изучен",
  "training.completed": "Обучение завершено",
  "exam.created": "Тест создан",
  "exam.started": "Тест начат",
  "exam.submitted": "Тест завершён",
  "protocol.created": "Протокол создан",
  "protocol.updated": "Протокол обновлен",
  "protocol.ready_for_signing": "Протокол подготовлен к подписанию",
  "protocol.signed": "Протокол подписан",
  "protocol.annulled": "Протокол аннулирован",
  "protocol.superseded": "Протокол заменен",
  "protocol.replacement_created": "Создан черновик замены протокола",
  "responsibility_order.created": "Приказ о назначении ответственных создан",
  "responsibility_order.updated": "Приказ о назначении ответственных обновлен",
  "responsibility_order.ready_for_signing": "Приказ о назначении ответственных подготовлен к подписанию",
  "responsibility_order.signed": "Приказ о назначении ответственных подписан",
  "responsibility_order.annulled": "Приказ о назначении ответственных аннулирован",
  "responsibility_order.superseded": "Приказ о назначении ответственных заменен",
  "responsibility_order.replacement_created": "Создан черновик замены приказа",
  "work_permit.created": "Допуск создан",
  "work_permit.updated": "Допуск обновлен",
  "work_permit_version.created": "Версия допуска создана",
  "brigade.created": "Бригада допуска создана",
  "brigade_member.created": "Участник бригады добавлен",
  "work_permit.precheck_passed": "Precheck допуска пройден",
  "work_permit.precheck_failed": "Precheck допуска не пройден",
  "work_permit.submitted": "Допуск отправлен на согласование",
  "work_permit.approved": "Допуск согласован",
  "work_permit.signed": "Допуск подписан",
  "work_permit.activated": "Допуск активирован",
  "work_permit.suspended": "Допуск приостановлен",
  "work_permit.closed": "Допуск закрыт",
  "work_permit.annulled": "Допуск отменён",
};

export const entityTypeLabels: Record<string, string> = {
  Company: "Компания",
  ContractorCompany: "Подрядная компания",
  Department: "Подразделение",
  Employee: "Сотрудник",
  BriefingRecord: "Запись инструктажа",
  EmployeeDocument: "Документ сотрудника",
  CompanyDocument: "Документ компании",
  SafetyCertificate: "Удостоверение по ТБ",
  Correspondence: "Письмо или КП",
  TrainingProgram: "Программа обучения",
  TrainingAssignment: "Назначенное обучение",
  Exam: "Тест",
  ExamAttempt: "Попытка теста",
  WorkPermit: "Допуск",
  WorkPermitVersion: "Версия допуска",
  Brigade: "Бригада",
  BrigadeMember: "Участник бригады",
};

export function getStatusLabel(value: string) {
  return statusLabels[value] ?? value;
}

export function getBriefingJournalKindLabel(value: string) {
  return briefingJournalKindLabels[value] ?? value;
}

export function getBriefingSignerRoleLabel(value: string) {
  return briefingSignerRoleLabels[value] ?? value;
}

export function getResponsibilityTypeLabel(value: string) {
  return responsibilityTypeLabels[value] ?? value;
}

export function getNotificationTypeLabel(value: string) {
  return notificationTypeLabels[value] ?? value;
}

export function getEmployeeKindLabel(value: string) {
  return employeeKindLabels[value] ?? value;
}

export function getDocumentTypeLabel(value: string) {
  return documentTypeLabels[value] ?? value;
}

export function getAuditActionLabel(value: string) {
  return auditActionLabels[value] ?? value;
}

export function getEntityTypeLabel(value: string) {
  return entityTypeLabels[value] ?? value;
}
