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
import { annulProtocolAction, prepareProtocolForSigningAction } from "@/actions/protocol";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { apiFetch } from "@/lib/api";
import { requireRoleAccess } from "@/lib/auth";
import { getAuditActionLabel } from "@/lib/labels";

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

export default async function ProtocolDetailPage({
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

  const protocol = await apiFetch<{
    id: string;
    organizationId: string;
    number: string;
    date: string;
    protocolType: string;
    basis: string;
    status: string;
    decision: string;
    notes: string | null;
    signedAt: string | null;
    canonicalStatus: string | null;
    documentEnvelopeId: string | null;
    documentEnvelopeStatus: string | null;
    documentVersionStatus: string | null;
    currentVersionNo: number | null;
    isSigned: boolean;
    replacesProtocolId: string | null;
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
    employees: Array<{
      employeeId: string;
      fullName: string;
      employeeNumber?: string | null;
      jobTitle?: string | null;
      departmentName?: string | null;
    }>;
    commission: Array<{
      role: "CHAIRMAN" | "MEMBER";
      fullName: string;
      jobTitle?: string | null;
    }>;
    complianceImpact: Array<{
      employeeId: string;
      fullName: string;
      admissionStatus?: string | null;
      decisionCode?: string | null;
      evaluatedAt?: string | null;
      basisLabel: string;
    }>;
  }>(`protocols/${id}`);
  const effectiveCompanyId = companyId ?? protocol.organizationId;
  const companyQuery = buildCompanyQuery(effectiveCompanyId);
  const chairman = protocol.commission.find((member) => member.role === "CHAIRMAN") ?? null;
  const members = protocol.commission.filter((member) => member.role === "MEMBER");

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Карточка протокола</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">{protocol.number}</h1>
          <p className="mt-2 text-sm text-slate-500">{protocol.basis}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href={`/api/protocols/${protocol.id}/download`}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
          >
            Скачать PDF
          </a>
          {protocol.allowedActions.canEditDraft ? (
            <Link
              href={`/protocols/${protocol.id}/edit${companyQuery}`}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
            >
              Редактировать черновик
            </Link>
          ) : null}
          {protocol.allowedActions.canSign ? (
            <Link
              href={`/protocols/${protocol.id}/sign${companyQuery}`}
              className="rounded-xl bg-[var(--surface-strong)] px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--surface-strong-hover)]"
            >
              Подписать
            </Link>
          ) : null}
          {protocol.allowedActions.canReplace ? (
            <Link
              href={`/protocols/new?companyId=${effectiveCompanyId}&replaceProtocolId=${protocol.id}`}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
            >
              Заменить
            </Link>
          ) : null}
        </div>
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-[24px]">
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">Сводка протокола</h2>
            <StatusBadge value={protocol.status} />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Идентификация</p>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p>Тип: {protocol.protocolType}</p>
                  <p>Дата: {formatDate(protocol.date)}</p>
                  <p>Текущая версия: {protocol.currentVersionNo ?? "Не задана"}</p>
                  <p>Подписан: {protocol.signedAt ? formatDateTime(protocol.signedAt) : "Не подписан"}</p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Область</p>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p>Филиал: {protocol.branch?.name ?? "Не назначено"}</p>
                  <p>Подразделение: {protocol.department?.name ?? "Не назначено"}</p>
                  <p>Объект: {protocol.workSite?.name ?? "Не назначено"}</p>
                  <p>Местоположение: {protocol.workSite?.location ?? "Не назначено"}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Решение</p>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{protocol.decision}</p>
              <p className="mt-4 text-xs uppercase tracking-[0.14em] text-slate-400">Примечания</p>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
                {protocol.notes ?? "Примечаний нет"}
              </p>
              {protocol.replacesProtocolId ? (
                <p className="mt-4 text-sm text-slate-500">
                  Источник замены: {protocol.replacesProtocolId}
                </p>
              ) : null}
            </div>

            <Card className="rounded-[20px] border border-slate-200 shadow-none">
              <CardHeader>
                <h3 className="text-base font-semibold text-slate-950">Сотрудники</h3>
              </CardHeader>
              <CardContent className="p-0">
                <TableWrapper className="border-0">
                  <Table>
                    <thead>
                      <tr>
                        <Th>Сотрудник</Th>
                        <Th>Подразделение</Th>
                        <Th>Допуск</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {protocol.employees.map((employee) => {
                        const impact =
                          protocol.complianceImpact.find((entry) => entry.employeeId === employee.employeeId) ?? null;

                        return (
                          <tr key={employee.employeeId} className="border-t border-slate-100">
                            <Td>
                              <div>
                                <Link
                                  href={`/employees/${employee.employeeId}${companyQuery}`}
                                  className="font-medium text-slate-900"
                                >
                                  {employee.fullName}
                                </Link>
                                <p className="mt-1 text-xs text-slate-500">
                                  {employee.employeeNumber ?? "Без номера"}
                                  {employee.jobTitle ? ` • ${employee.jobTitle}` : ""}
                                </p>
                              </div>
                            </Td>
                            <Td>{employee.departmentName ?? "Не назначено"}</Td>
                            <Td>
                              <div className="space-y-1">
                                {impact?.admissionStatus ? (
                                  <StatusBadge value={impact.admissionStatus} />
                                ) : (
                                  <span className="text-sm text-slate-500">Оценка отсутствует</span>
                                )}
                                <p className="text-xs text-slate-500">
                                  {impact?.decisionCode ?? "Код решения отсутствует"}
                                </p>
                              </div>
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </TableWrapper>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-medium text-slate-900">Председатель</p>
                {chairman ? (
                  <div className="mt-3 space-y-1 text-sm text-slate-700">
                    <p>{chairman.fullName}</p>
                    <p>{chairman.jobTitle ?? "Должность не указана"}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">Председатель не назначен.</p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-medium text-slate-900">Члены</p>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  {members.length ? (
                    members.map((member) => (
                      <div key={`${member.role}-${member.fullName}`} className="rounded-xl bg-slate-50 px-3 py-2">
                        <p>{member.fullName}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {member.jobTitle ?? "Должность не указана"}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500">Дополнительные члены не назначены.</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-[24px]">
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">Действия</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              {protocol.allowedActions.canPrepareSign ? (
                <form action={prepareProtocolForSigningAction}>
                  <input type="hidden" name="protocolId" value={protocol.id} />
                  <input type="hidden" name="companyId" value={effectiveCompanyId} />
                  <SubmitButton label="Подготовить к подписанию" pendingLabel="Подготовка..." className="w-full" />
                </form>
              ) : null}

              {protocol.allowedActions.canAnnul ? (
                <form action={annulProtocolAction} className="space-y-3">
                  <input type="hidden" name="protocolId" value={protocol.id} />
                  <input type="hidden" name="companyId" value={effectiveCompanyId} />
                  <input
                    type="hidden"
                    name="reason"
                    value="Протокол аннулирован со страницы карточки администратором."
                  />
                  <SubmitButton
                    label="Аннулировать протокол"
                    pendingLabel="Аннулирование..."
                    variant="danger"
                    className="w-full"
                  />
                </form>
              ) : null}

              {protocol.allowedActions.canDownloadEvidence && protocol.documentEnvelopeId ? (
                <a
                  href={`/api/document-envelopes/${protocol.documentEnvelopeId}/evidence-package`}
                  className="inline-flex w-full justify-center rounded-md border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50"
                >
                  Скачать пакет доказательств
                </a>
              ) : null}

              {protocol.allowedActions.canViewArchive ? (
                <a
                  href="#archive-summary"
                  className="inline-flex w-full justify-center rounded-md border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50"
                >
                  Показать сводку архива
                </a>
              ) : null}

              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                {protocol.isSigned
                  ? "Подписанная редакция неизменяема. Используйте замену или аннулирование вместо редактирования черновика."
                  : "Черновик остаётся редактируемым, пока протокол не подписан."}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px]">
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">Жизненный цикл</h2>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <span>Статус протокола</span>
                <StatusBadge value={protocol.status} />
              </div>
              <div className="flex items-center justify-between">
                <span>Канонический статус</span>
                {protocol.canonicalStatus ? (
                  <StatusBadge value={protocol.canonicalStatus} />
                ) : (
                  <span className="text-slate-500">Не привязано</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span>Состояние конверта</span>
                {protocol.documentEnvelopeStatus ? (
                  <StatusBadge value={protocol.documentEnvelopeStatus} />
                ) : (
                  <span className="text-slate-500">Не привязано</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span>Состояние версии</span>
                {protocol.documentVersionStatus ? (
                  <StatusBadge value={protocol.documentVersionStatus} />
                ) : (
                  <span className="text-slate-500">Не привязано</span>
                )}
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Сводка аудита</p>
                <div className="mt-3 space-y-2">
                  <p>Событий: {protocol.historySummary.totalEvents}</p>
                  <p>
                    Последнее действие:{" "}
                    {protocol.historySummary.lastAction ? getAuditActionLabel(protocol.historySummary.lastAction) : "История отсутствует"}
                  </p>
                  <p>
                    Последнее время:{" "}
                    {protocol.historySummary.lastAt ? formatDateTime(protocol.historySummary.lastAt) : "История отсутствует"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px]">
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">Проверка / доказательства</h2>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {protocol.latestSignature ? (
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="font-medium text-slate-900">{protocol.latestSignature.signerName}</p>
                  <p className="mt-1">Провайдер: {protocol.latestSignature.provider}</p>
                  <p className="mt-1">{protocol.latestSignature.signerIinMasked}</p>
                  <p className="mt-1">{protocol.latestSignature.certificateSerial}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Подписано:{" "}
                    {protocol.latestSignature.signedAt ? formatDateTime(protocol.latestSignature.signedAt) : "Недоступно"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Проверено:{" "}
                    {protocol.latestSignature.verifiedAt ? formatDateTime(protocol.latestSignature.verifiedAt) : "Не проверено"}
                  </p>
                  {protocol.latestSignature.verificationResult ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Проверка: {protocol.latestSignature.verificationResult}
                      {protocol.latestSignature.chainStatus ? ` • ${protocol.latestSignature.chainStatus}` : ""}
                      {protocol.latestSignature.revocationStatus ? ` • ${protocol.latestSignature.revocationStatus}` : ""}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  Запись подписи пока недоступна.
                </div>
              )}
            </CardContent>
          </Card>

          <Card id="archive-summary" className="rounded-[24px]">
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">Сводка архива</h2>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {protocol.archiveRecordSummary ? (
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p>Статус: {protocol.archiveRecordSummary.status}</p>
                  <p className="mt-1">Хранение: {protocol.archiveRecordSummary.retentionCode}</p>
                  <p className="mt-1">Источник: {getRetentionSourceLabel(protocol.archiveRecordSummary.retentionSource)}</p>
                  <p className="mt-1">
                    Запечатан:{" "}
                    {protocol.archiveRecordSummary.sealedAt
                      ? formatDateTime(protocol.archiveRecordSummary.sealedAt)
                      : "Не запечатан"}
                  </p>
                  <p className="mt-1">
                    В архиве:{" "}
                    {protocol.archiveRecordSummary.archivedAt
                      ? formatDateTime(protocol.archiveRecordSummary.archivedAt)
                      : "Не заархивирован"}
                  </p>
                  <p className="mt-1">
                    Срок уничтожения:{" "}
                    {protocol.archiveRecordSummary.disposalEligibleAt
                      ? formatDateTime(protocol.archiveRecordSummary.disposalEligibleAt)
                      : "Не назначен"}
                  </p>
                  <p className="mt-1">
                    Хранилище: {protocol.archiveRecordSummary.storageUri ?? "Не назначено"}
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  Запись архива появится после запечатывания подписанного протокола.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
