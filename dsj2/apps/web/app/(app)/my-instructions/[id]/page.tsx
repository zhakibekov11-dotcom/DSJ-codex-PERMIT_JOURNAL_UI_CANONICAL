import type { BriefingJournalEntry } from "@dsj/types";
import { Card, CardContent, CardHeader, EmptyState, PageHeader } from "@dsj/ui";
import { formatDate, formatDateTime } from "@dsj/utils";
import { signMyInstructionAction } from "@/actions/my-instructions";
import { SigningForm } from "@/components/signing-form";
import { StatusBadge } from "@/components/status-badge";
import { apiFetch } from "@/lib/api";
import { requireRoleAccess } from "@/lib/auth";
import {
  briefingJournalKindLabels,
  briefingTypeLabels,
  getBriefingSignerRoleLabel,
} from "@/lib/labels";
import { getSigningConfig } from "@/lib/signing-config";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function signingProgress(record: BriefingJournalEntry) {
  const instructor = record.pendingSigners.find((signer) => signer.role === "BRIEFING_INSTRUCTOR");
  const employee = record.pendingSigners.find((signer) => signer.role === "BRIEFED_EMPLOYEE");
  const instructorSigned = instructor?.status === "SIGNED";
  const employeeSigned = employee?.status === "SIGNED";

  if (instructorSigned && employeeSigned) {
    return "Полностью подписано";
  }

  if (instructorSigned && !employeeSigned) {
    return "Ожидается подпись сотрудника";
  }

  if (!instructorSigned && employeeSigned) {
    return "Ожидается подпись инструктора";
  }

    return "Ожидает подписи инструктора";
}

export default async function MyInstructionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  await requireRoleAccess(["EMPLOYEE_SIGNER"]);
  const signingConfig = getSigningConfig();
  const { id } = await params;
  const rawSearchParams = await searchParams;
  const errorMessage = typeof rawSearchParams.error === "string" ? rawSearchParams.error : null;
  const record = await apiFetch<BriefingJournalEntry>(`briefing-records/${id}`);
  const signingConfigError = signingConfig.isConfigured ? null : signingConfig.configError;
  const canSign = record.allowedActions.canEmployeeSign;

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
            Моя запись инструктажа
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            {record.registrationNo ?? `Запись #${record.id.slice(0, 8)}`}
          </h1>
          <p className="mt-2 text-sm text-slate-500">{record.topic}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge value={record.status} />
          {record.allowedActions.canDownloadEvidence && record.documentEnvelopeId ? (
            <a
              href={`/api/document-envelopes/${record.documentEnvelopeId}/evidence-package`}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
            >
              Пакет доказательств
            </a>
          ) : null}
        </div>
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-[24px]">
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">
              Содержание инструктажа
            </h2>
            <span className="text-sm text-slate-500">{signingProgress(record)}</span>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                Программа
              </p>
              {record.program ? (
                <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
                  {record.program}
                </p>
              ) : (
                <p className="mt-2 text-sm text-slate-600">
                  Программа инструктажа не добавлена.
                </p>
              )}
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                Примечания
              </p>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
                {record.notes ?? "Дополнительных примечаний нет."}
              </p>
              {record.basis ? (
                <p className="mt-3 text-sm text-slate-600">Основание: {record.basis}</p>
              ) : null}
              {record.unscheduledReason ? (
                <p className="mt-1 text-sm text-slate-600">
                  Причина: {record.unscheduledReason}
                </p>
              ) : null}
            </div>

            {record.status === "SIGNED" ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                Инструктаж подписан обеими сторонами. Доказательства и архивная
                связка доступны в этой карточке.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {canSign ? (
            <Card id="signing-card" className="rounded-[24px]">
              <CardHeader>
                <h2 className="text-lg font-semibold text-slate-950">
                  Подписать инструктаж
                </h2>
              </CardHeader>
              <CardContent>
                {signingConfig.isConfigured ? (
                  <SigningForm
                    mode={signingConfig.provider}
                    action={signMyInstructionAction}
                    hiddenFields={[{ name: "briefingId", value: record.id }]}
                    digest={record.signingDigest ?? null}
                    bridgeUrl={signingConfig.bridgeUrl ?? ""}
                    bridgeTimeoutMs={signingConfig.bridgeTimeoutMs}
                    bridgeContext={{
                      briefingJournalEntryId: record.id,
                      registrationNo: record.registrationNo ?? null,
                    }}
                    title="Подпись сотрудника"
                    description="Бэкенд сохранит каноническую подпись с signerRole=BRIEFED_EMPLOYEE."
                    submitLabel="Подписать"
                    pendingLabel="Подписание..."
                    mockHint="Режим mock подпишет эту запись инструктажа без дополнительных полей."
                    bridgeHint="Bridge запросит локальный сертификат и отправит CMS/PKCS#7 на сервер."
                    testMode={signingConfig.testMode}
                  />
                ) : (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {signingConfigError}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-[24px]">
              <CardHeader>
                <h2 className="text-lg font-semibold text-slate-950">
                  Подпись сотрудника
                </h2>
              </CardHeader>
              <CardContent>
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  {record.status === "SIGNED"
                    ? "Запись уже полностью подписана."
                    : "Подпись сотрудника станет доступна после подписи инструктора."}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-[24px]">
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">Сводка</h2>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">
                  {briefingJournalKindLabels[record.journalKind] ?? record.journalKind}
                </p>
                <p className="mt-1">
                  {briefingTypeLabels[record.briefingType] ?? record.briefingType}
                </p>
                <p className="mt-1">Дата: {formatDate(record.briefingDate)}</p>
                <p className="mt-1">Инструктор: {record.instructor.fullName}</p>
                <p className="mt-1">Подразделение: {record.department?.name ?? "не назначено"}</p>
                <p className="mt-1">Площадка: {record.workSite?.name ?? "не назначена"}</p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p>Дайджест: {record.signingDigest ?? "ожидает"}</p>
                <p>
                  Доказательства: {record.evidenceAvailable ? "доступны" : "ожидают"}
                </p>
                <p>
                  Архив:{" "}
                  {record.archiveRecordSummary
                    ? `${record.archiveRecordSummary.status} / ${record.archiveRecordSummary.retentionCode}`
                    : "не запечатано"}
                </p>
                <p>
                  Окончательная подпись:{" "}
                  {record.finalSignedAt ? formatDateTime(record.finalSignedAt) : "пока нет"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px]">
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">
                Подписи
              </h2>
            </CardHeader>
            <CardContent className="space-y-3">
              {record.pendingSigners.length ? (
                record.pendingSigners.map((signer) => (
                  <div
                    key={signer.role}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {getBriefingSignerRoleLabel(signer.role)}
                      </p>
                      <StatusBadge value={signer.status} />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {signer.signerName ?? "ожидает"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {signer.signedAt ? formatDateTime(signer.signedAt) : "не подписано"}
                    </p>
                  </div>
                ))
              ) : (
                <EmptyState>Подписи пока не подготовлены.</EmptyState>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
