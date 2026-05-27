import { Card, CardContent, CardHeader, PageHeader, Textarea } from "@dsj/ui";
import { closePermitAction, suspendPermitAction } from "@/actions/permits";
import { PermitWorkflowNav } from "@/components/permit-summary";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { requireRoleAccess } from "@/lib/auth";
import { fetchPermit } from "@/lib/permit-queries";
import { getEffectivePermitStatus, getPermitEntry } from "@/lib/permits";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" && value.length ? value : null;
}

export default async function PermitClosurePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  await requireRoleAccess(["SUPER_ADMIN", "COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const { id } = await params;
  const rawSearchParams = await searchParams;
  const companyId = firstString(rawSearchParams.companyId);
  const errorMessage = firstString(rawSearchParams.error);
  const successMessage = firstString(rawSearchParams.success);
  const permit = await fetchPermit(id);
  const entry = getPermitEntry(permit);
  const status = getEffectivePermitStatus(permit);
  const canSuspend = status === "active";
  const canClose = status === "active" || status === "suspended";

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
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Закрытие допуска</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">{permit.permitCode}</h1>
          <p className="mt-2 text-sm text-slate-500">
            Закрытие фиксирует завершение работ и финальное состояние PermitEntry.
          </p>
        </div>
        <PermitWorkflowNav permitId={permit.id} companyId={companyId ?? permit.organizationId} />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">Текущее состояние</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <State label="Lifecycle" value={status} />
              <State label="Backend" value={permit.status} />
              <State label="Precheck" value={entry?.precheckSummary?.result === "PASS" ? "active" : "blocked"} />
            </div>
            <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
              {entry?.closure ? (
                <pre className="whitespace-pre-wrap break-words text-xs">{JSON.stringify(entry.closure, null, 2)}</pre>
              ) : (
                "Closure snapshot ещё не создан."
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">Приостановка</h2>
            </CardHeader>
            <CardContent>
              {canSuspend ? (
                <form action={suspendPermitAction} className="space-y-3">
                  <input type="hidden" name="permitId" value={permit.id} />
                  <input type="hidden" name="companyId" value={companyId ?? permit.organizationId} />
                  <Textarea name="reason" required placeholder="Причина приостановки" />
                  <SubmitButton label="Приостановить" pendingLabel="Приостановка..." />
                </form>
              ) : (
                <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Приостановить можно только активный допуск.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">Закрытие</h2>
            </CardHeader>
            <CardContent>
              {canClose ? (
                <form action={closePermitAction} className="space-y-3">
                  <input type="hidden" name="permitId" value={permit.id} />
                  <input type="hidden" name="companyId" value={companyId ?? permit.organizationId} />
                  <Textarea name="result" required placeholder="Результат работ" />
                  <Textarea name="inspection" placeholder="Осмотр места работ после завершения" />
                  <Textarea name="comment" placeholder="Комментарий к закрытию" />
                  <SubmitButton label="Закрыть допуск" pendingLabel="Закрытие..." />
                </form>
              ) : (
                <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Закрыть можно только активный или приостановленный допуск.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function State({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <div className="mt-2">
        <StatusBadge value={value} />
      </div>
    </div>
  );
}
