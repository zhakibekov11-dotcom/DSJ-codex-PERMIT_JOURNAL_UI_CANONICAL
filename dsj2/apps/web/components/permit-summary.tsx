import Link from "next/link";
import { Card, CardContent, CardHeader } from "@dsj/ui";
import { formatDate, formatDateTime } from "@dsj/utils";
import { StatusBadge } from "@/components/status-badge";
import {
  getEffectivePermitStatus,
  getPermitEntry,
  getPermitStatusLabel,
  getPermitTypeLabel,
  getPermitWorkTypeLabel,
  isPermitLocked,
  legalBasisOptions,
  type PermitEntry,
  type PermitRecord,
} from "@/lib/permits";

type PermitSummaryProps = {
  permit: PermitRecord;
  companyId: string | null;
  readOnly?: boolean;
};

function display(value: string | null | undefined) {
  return value && value.trim().length ? value : "—";
}

function legalBasisLabel(key: string) {
  const basis = legalBasisOptions.find((item) => item.key === key);
  return basis ? `${basis.label} (${basis.marker})` : key;
}

export function PermitWorkflowNav({ permitId, companyId }: { permitId: string; companyId: string | null }) {
  const query = companyId ? `?companyId=${companyId}` : "";
  const items = [
    ["/precheck", "Precheck"],
    ["/approvals", "Согласования"],
    ["/signatures", "Подписи"],
    ["/closure", "Закрытие"],
    ["/audit", "Аудит"],
  ];

  return (
    <div className="flex flex-wrap gap-2">
      <Link className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" href={`/permits/${permitId}${query}`}>
        Карточка
      </Link>
      {items.map(([suffix, label]) => (
        <Link
          key={suffix}
          className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          href={`/permits/${permitId}${suffix}${query}`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

export function PermitSummary({ permit, companyId, readOnly = false }: PermitSummaryProps) {
  const entry = getPermitEntry(permit);
  const status = getEffectivePermitStatus(permit);
  const query = companyId ? `?companyId=${companyId}` : "";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-slate-400">PermitEntry</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">
                {entry?.permitNumber ?? permit.permitCode}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {entry ? getPermitTypeLabel(entry.permitType) : "Канонический payload не найден"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value={status} />
              <StatusBadge value={permit.status} />
              {!readOnly && !isPermitLocked(permit) ? (
                <Link
                  href={`/permits/${permit.id}/edit${query}`}
                  className="rounded-md bg-[var(--surface-strong)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--surface-strong-hover)]"
                >
                  Редактировать
                </Link>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Fact label="Вид работ" value={entry ? getPermitWorkTypeLabel(entry.workType) : permit.permitType} />
          <Fact label="№ записи в журнале" value={entry?.journalRegistrationNumber} />
          <Fact label="Место работ" value={entry?.workplace} />
          <Fact label="Срок" value={entry?.startAt ? `${formatDateTime(entry.startAt)} - ${entry.endAt ? formatDateTime(entry.endAt) : "—"}` : "—"} />
          <Fact label="Подразделение" value={entry?.departmentId ?? permit.departmentId} />
          <Fact label="Объект" value={permit.workSite?.name ?? entry?.workZoneId ?? permit.workSiteId} />
          <Fact label="Ответственный руководитель" value={entry?.responsibleManagerId} />
          <Fact label="Производитель работ" value={entry?.workProducerId} />
        </CardContent>
      </Card>

      {entry ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">Условия допуска</h2>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <TextBlock label="Описание работ" value={entry.workDescription} />
            <TextBlock label="Меры безопасности" value={entry.safetyMeasures} />
            <TextBlock label="Опасные факторы" value={entry.hazardFactors.join(", ")} />
            <TextBlock label="СИЗ" value={entry.ppeRequirements ?? "—"} />
            <TextBlock
              label="Нормативное основание"
              value={entry.legalBasis.length ? entry.legalBasis.map(legalBasisLabel).join("\n") : "—"}
            />
            <TextBlock
              label="Подписанный payload"
              value={[
                `documentVersionHash: ${entry.documentVersionHash ?? "не создан"}`,
                `signedPayloadHash: ${entry.signedPayloadHash ?? "не создан"}`,
              ].join("\n")}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">Lifecycle</h2>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ["Черновик", "draft"],
              ["Precheck", entry?.precheckSummary?.result === "PASS" ? "active" : "missing_documents"],
              ["Согласование", status === "approved" || status === "active" || status === "closed" ? "approved" : "pending_approval"],
              ["Архив", status === "archived" ? "archived" : "draft"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 p-4">
                <p className="text-sm text-slate-500">{label}</p>
                <div className="mt-2">
                  <StatusBadge value={value} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-500">
            Текущий статус: {getPermitStatusLabel(status)}. После согласования ключевые поля
            допуска недоступны для прямого редактирования.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function PermitPrecheckList({ entry }: { entry: PermitEntry | null }) {
  const checks = entry?.precheckChecks ?? [];

  if (!checks.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Precheck ещё не запускался.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {checks.map((check) => (
        <div key={check.code} className="rounded-lg border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium text-slate-950">{check.label}</p>
              <p className="mt-1 text-sm text-slate-500">{check.message}</p>
            </div>
            <StatusBadge value={check.result === "PASS" ? "active" : "blocked"} />
          </div>
          {check.evidence.length ? (
            <p className="mt-3 text-xs text-slate-500">Evidence: {check.evidence.join(", ")}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-950">{display(value)}</p>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-sm font-medium text-slate-900">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{display(value)}</p>
    </div>
  );
}
