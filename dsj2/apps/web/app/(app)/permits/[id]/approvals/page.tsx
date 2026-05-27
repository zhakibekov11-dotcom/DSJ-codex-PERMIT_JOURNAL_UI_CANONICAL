import { Card, CardContent, CardHeader, PageHeader, Textarea } from "@dsj/ui";
import { approvePermitAction, submitPermitAction } from "@/actions/permits";
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

export default async function PermitApprovalsPage({
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
  const precheckPassed = entry?.precheckSummary?.result === "PASS";

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
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Согласования</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">{permit.permitCode}</h1>
          <p className="mt-2 text-sm text-slate-500">
            Согласование блокирует ключевые signed fields. Перед отправкой нужен успешный
            precheck.
          </p>
        </div>
        <PermitWorkflowNav permitId={permit.id} companyId={companyId ?? permit.organizationId} />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">Состояние согласования</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <State label="Precheck" value={precheckPassed ? "active" : "blocked"} />
              <State label="Workflow" value={status} />
              <State label="Backend" value={permit.status} />
            </div>
            <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
              Ответственные роли берутся из PermitEntry: выдающий наряд, ответственный
              руководитель, производитель работ, допускающий и состав бригады. Полный
              многошаговый approval route не имитируется, пока backend не создал отдельный
              approval artifact.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">Действия</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {["draft", "missing_documents"].includes(status) ? (
              <form action={submitPermitAction} className="space-y-3">
                <input type="hidden" name="permitId" value={permit.id} />
                <input type="hidden" name="companyId" value={companyId ?? permit.organizationId} />
                <Textarea name="comment" placeholder="Комментарий к отправке на согласование" />
                <SubmitButton label="Отправить на согласование" pendingLabel="Отправка..." disabled={!precheckPassed} />
                {!precheckPassed ? (
                  <p className="text-xs text-rose-700">Сначала выполните успешный precheck.</p>
                ) : null}
              </form>
            ) : null}

            {status === "pending_approval" || permit.status === "IN_APPROVAL" ? (
              <form action={approvePermitAction}>
                <input type="hidden" name="permitId" value={permit.id} />
                <input type="hidden" name="companyId" value={companyId ?? permit.organizationId} />
                <SubmitButton label="Согласовать допуск" pendingLabel="Согласование..." />
              </form>
            ) : null}

            {status === "approved" ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Допуск согласован. Подписанные поля заблокированы.
              </div>
            ) : null}
          </CardContent>
        </Card>
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
