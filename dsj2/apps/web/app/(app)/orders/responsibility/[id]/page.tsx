import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  PageHeader,
  Table,
  TableWrapper,
  Td,
  Th,
} from "@dsj/ui";
import { formatDate, formatDateTime } from "@dsj/utils";
import { annulResponsibilityOrderAction, prepareResponsibilityOrderForSigningAction } from "@/actions/responsibility-order";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { apiFetch } from "@/lib/api";
import { requireRoleAccess } from "@/lib/auth";
import { getAuditActionLabel, getResponsibilityTypeLabel } from "@/lib/labels";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === "string" && value.length ? value : null;
}

function buildCompanyQuery(companyId: string | null) {
  return companyId ? `?companyId=${companyId}` : "";
}

function getRetentionSourceLabel(value: "configured" | "baseline") {
  return value === "configured" ? "настроен" : "базовый";
}

export default async function ResponsibilityOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  await requireRoleAccess(["COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const { id } = await params;
  const rawSearchParams = await searchParams;
  const errorMessage = firstString(rawSearchParams.error);
  const successMessage = firstString(rawSearchParams.success);
  const companyId = firstString(rawSearchParams.companyId);

  const order = await apiFetch<{
    id: string;
    organizationId: string;
    number: string;
    date: string;
    responsibilityType: string;
    title: string;
    basis: string;
    notes: string | null;
    status: string;
    signedAt: string | null;
    canonicalStatus: string | null;
    documentEnvelopeId: string | null;
    documentEnvelopeStatus: string | null;
    documentVersionStatus: string | null;
    currentVersionNo: number | null;
    isSigned: boolean;
    replacesOrderId: string | null;
    branch?: { id: string; code?: string | null; name: string } | null;
    department?: { id: string; code?: string | null; name: string } | null;
    workSite?: { id: string; code?: string | null; name: string; location?: string | null } | null;
    latestSignature?: {
      provider: string;
      status: string;
      signerName: string;
      signerIinMasked: string;
      certificateSerial: string;
      signedAt?: string | null;
      verifiedAt?: string | null;
      verificationResult?: string | null;
      chainStatus?: string | null;
      revocationStatus?: string | null;
    } | null;
    archiveRecordSummary?: {
      id: string;
      status: string;
      sealedAt?: string | null;
      archivedAt?: string | null;
      disposalEligibleAt?: string | null;
      retentionCode: string;
      retentionSource: "configured" | "baseline";
      storageUri?: string | null;
    } | null;
    historySummary: {
      totalEvents: number;
      lastAction: string | null;
      lastAt: string | null;
    };
    allowedActions: {
      canEditDraft: boolean;
      canPrepareSign: boolean;
      canSign: boolean;
      canAnnul: boolean;
      canReplace: boolean;
      canDownloadEvidence: boolean;
      canViewArchive: boolean;
    };
    appointments: Array<{
      id: string;
      employeeId: string;
      effectiveFrom: string;
      effectiveTo?: string | null;
      zoneOfResponsibility?: string | null;
      roleNotes?: string | null;
      derivedStatus: string;
      employee: {
        fullName: string;
        employeeNumber?: string | null;
        jobTitle?: string | null;
        departmentName?: string | null;
      };
    }>;
    conflictSummary: {
      blocking: boolean;
      count: number;
      items: Array<{
        blocking: boolean;
        conflictingOrderId: string;
        conflictingOrderNumber: string;
        conflictingOrderStatus: string;
        sourceEmployeeName: string;
        message: string;
      }>;
    };
  }>(`responsibility-orders/${id}`);
  const effectiveCompanyId = companyId ?? order.organizationId;
  const companyQuery = buildCompanyQuery(effectiveCompanyId);

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Карточка приказа</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">{order.number}</h1>
          <p className="mt-2 text-sm text-slate-500">{order.title}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href={`/api/responsibility-orders/${order.id}/download`}
            className="rounded-md border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
          >
            Скачать PDF
          </a>
          {order.allowedActions.canEditDraft ? (
            <Link
              href={`/orders/responsibility/${order.id}/edit${companyQuery}`}
              className="rounded-md border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
            >
              Редактировать черновик
            </Link>
          ) : null}
          {order.allowedActions.canSign ? (
            <Link
              href={`/orders/responsibility/${order.id}/sign${companyQuery}`}
              className="rounded-md bg-[var(--surface-strong)] px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--surface-strong-hover)]"
            >
              Подписать
            </Link>
          ) : null}
          {order.allowedActions.canReplace ? (
            <Link
              href={`/orders/responsibility/new?companyId=${effectiveCompanyId}&replaceOrderId=${order.id}`}
              className="rounded-md border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
            >
              Заменить
            </Link>
          ) : null}
        </div>
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">Сводка приказа</h2>
            <StatusBadge value={order.status} />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Идентификация</p>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p>Тип: {getResponsibilityTypeLabel(order.responsibilityType)}</p>
                  <p>Дата: {formatDate(order.date)}</p>
                  <p>Текущая версия: {order.currentVersionNo ?? "Не задана"}</p>
                  <p>Подписан: {order.signedAt ? formatDateTime(order.signedAt) : "Не подписан"}</p>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Область</p>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p>Филиал: {order.branch?.name ?? "На уровне организации"}</p>
                  <p>Подразделение: {order.department?.name ?? "Не назначено"}</p>
                  <p>Объект: {order.workSite?.name ?? "Не назначено"}</p>
                  <p>Местоположение: {order.workSite?.location ?? "Не назначено"}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Основание</p>
              <p className="mt-2 text-sm text-slate-700">{order.basis}</p>
              <p className="mt-4 text-xs uppercase tracking-[0.14em] text-slate-400">Примечания</p>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
                {order.notes ?? "Примечаний нет"}
              </p>
              {order.replacesOrderId ? (
                <p className="mt-4 text-sm text-slate-500">Источник замены: {order.replacesOrderId}</p>
              ) : null}
            </div>

            <Card className="border border-slate-200 shadow-none">
              <CardHeader>
                <h3 className="text-base font-semibold text-slate-950">Назначения</h3>
              </CardHeader>
              <CardContent className="p-0">
                <TableWrapper className="border-0">
                  <Table>
                    <thead>
                      <tr>
                        <Th>Сотрудник</Th>
                        <Th>Период действия</Th>
                        <Th>Заметки по зоне</Th>
                        <Th>Статус</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.appointments.map((appointment) => (
                        <tr key={appointment.id} className="border-t border-slate-100">
                          <Td>
                            <div>
                              <Link
                                href={`/employees/${appointment.employeeId}${companyQuery}`}
                                className="font-medium text-slate-900"
                              >
                                {appointment.employee.fullName}
                              </Link>
                              <p className="mt-1 text-xs text-slate-500">
                                {appointment.employee.employeeNumber ?? "Без номера"}
                                {appointment.employee.jobTitle ? ` • ${appointment.employee.jobTitle}` : ""}
                              </p>
                            </div>
                          </Td>
                          <Td>
                            <div className="text-sm text-slate-700">
                              <p>{formatDate(appointment.effectiveFrom)}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {appointment.effectiveTo ? `по ${formatDate(appointment.effectiveTo)}` : "без срока"}
                              </p>
                            </div>
                          </Td>
                          <Td>
                            <div className="space-y-1 text-xs text-slate-500">
                              <p>{appointment.zoneOfResponsibility ?? "Зона не указана"}</p>
                              <p>{appointment.roleNotes ?? "Примечания отсутствуют"}</p>
                            </div>
                          </Td>
                          <Td>
                            <StatusBadge value={appointment.derivedStatus} />
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrapper>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">Действия</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.allowedActions.canPrepareSign ? (
                <form action={prepareResponsibilityOrderForSigningAction}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="companyId" value={effectiveCompanyId} />
                  <SubmitButton label="Подготовить к подписанию" pendingLabel="Подготовка..." className="w-full" />
                </form>
              ) : null}

              {order.allowedActions.canAnnul ? (
                <form action={annulResponsibilityOrderAction} className="space-y-3">
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="companyId" value={effectiveCompanyId} />
                  <input
                    type="hidden"
                    name="reason"
                    value="Приказ аннулирован с карточки приказа администратором."
                  />
                  <SubmitButton
                    label="Аннулировать приказ"
                    pendingLabel="Аннулирование..."
                    variant="danger"
                    className="w-full"
                  />
                </form>
              ) : null}

              {order.allowedActions.canDownloadEvidence && order.documentEnvelopeId ? (
                <a
                  href={`/api/document-envelopes/${order.documentEnvelopeId}/evidence-package`}
                  className="inline-flex w-full justify-center rounded-md border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50"
                >
                  Скачать пакет доказательств
                </a>
              ) : null}

              <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                {order.isSigned
                  ? "Подписанный приказ неизменяем. Используйте замену или аннулирование вместо редактирования черновика."
                  : "Черновик остаётся редактируемым, пока приказ не подписан."}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">Жизненный цикл</h2>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <span>Статус приказа</span>
                <StatusBadge value={order.status} />
              </div>
              <div className="flex items-center justify-between">
                <span>Канонический статус</span>
                {order.canonicalStatus ? (
                  <StatusBadge value={order.canonicalStatus} />
                ) : (
                  <span className="text-slate-500">Не привязано</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span>Состояние конверта</span>
                {order.documentEnvelopeStatus ? (
                  <StatusBadge value={order.documentEnvelopeStatus} />
                ) : (
                  <span className="text-slate-500">Не привязано</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span>Состояние версии</span>
                {order.documentVersionStatus ? (
                  <StatusBadge value={order.documentVersionStatus} />
                ) : (
                  <span className="text-slate-500">Не привязано</span>
                )}
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Сводка аудита</p>
                <div className="mt-3 space-y-2">
                  <p>Событий: {order.historySummary.totalEvents}</p>
                  <p>
                    Последнее действие:{" "}
                    {order.historySummary.lastAction ? getAuditActionLabel(order.historySummary.lastAction) : "История отсутствует"}
                  </p>
                  <p>
                    Последнее время:{" "}
                    {order.historySummary.lastAt ? formatDateTime(order.historySummary.lastAt) : "История отсутствует"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">Конфликтная сводка</h2>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <span>Блокирует</span>
                <StatusBadge value={order.conflictSummary.blocking ? "FAILED" : "ACTIVE"} />
              </div>
              <div className="flex items-center justify-between">
                <span>Конфликты</span>
                <span>{order.conflictSummary.count}</span>
              </div>
              {order.conflictSummary.items.length ? (
                <div className="space-y-2">
                  {order.conflictSummary.items.map((item) => (
                    <div key={`${item.conflictingOrderId}-${item.sourceEmployeeName}`} className="rounded-lg border border-slate-200 p-3">
                      <p className="font-medium text-slate-900">
                        {item.conflictingOrderNumber} • {item.sourceEmployeeName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{item.message}</p>
                      <p className="mt-1 text-xs text-slate-500">Статус: {item.conflictingOrderStatus}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                  Конфликтующих подписанных назначений не найдено.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">Проверка / доказательства</h2>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {order.latestSignature ? (
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="font-medium text-slate-900">{order.latestSignature.signerName}</p>
                  <p className="mt-1">Провайдер: {order.latestSignature.provider}</p>
                  <p className="mt-1">{order.latestSignature.signerIinMasked}</p>
                  <p className="mt-1">{order.latestSignature.certificateSerial}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Подписано:{" "}
                    {order.latestSignature.signedAt ? formatDateTime(order.latestSignature.signedAt) : "Недоступно"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Проверено:{" "}
                    {order.latestSignature.verifiedAt ? formatDateTime(order.latestSignature.verifiedAt) : "Не проверено"}
                  </p>
                  {order.latestSignature.verificationResult ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Проверка: {order.latestSignature.verificationResult}
                      {order.latestSignature.chainStatus ? ` • ${order.latestSignature.chainStatus}` : ""}
                      {order.latestSignature.revocationStatus ? ` • ${order.latestSignature.revocationStatus}` : ""}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                  Запись подписи пока недоступна.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">Сводка архива</h2>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {order.archiveRecordSummary ? (
                <div className="rounded-lg border border-slate-200 p-4">
                  <p>Статус: {order.archiveRecordSummary.status}</p>
                  <p className="mt-1">Хранение: {order.archiveRecordSummary.retentionCode}</p>
                  <p className="mt-1">Источник: {getRetentionSourceLabel(order.archiveRecordSummary.retentionSource)}</p>
                  <p className="mt-1">
                    Запечатан:{" "}
                    {order.archiveRecordSummary.sealedAt
                      ? formatDateTime(order.archiveRecordSummary.sealedAt)
                      : "Не запечатан"}
                  </p>
                  <p className="mt-1">
                    В архиве:{" "}
                    {order.archiveRecordSummary.archivedAt
                      ? formatDateTime(order.archiveRecordSummary.archivedAt)
                      : "Не заархивирован"}
                  </p>
                  <p className="mt-1">
                    Срок уничтожения:{" "}
                    {order.archiveRecordSummary.disposalEligibleAt
                      ? formatDateTime(order.archiveRecordSummary.disposalEligibleAt)
                      : "Не назначен"}
                  </p>
                  <p className="mt-1">
                    Хранилище: {order.archiveRecordSummary.storageUri ?? "Не назначено"}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                  Запись архива появится после запечатывания подписанного приказа.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
