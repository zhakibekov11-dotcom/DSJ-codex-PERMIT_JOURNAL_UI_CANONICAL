import { Card, CardContent, CardHeader, PageHeader, Textarea } from "@dsj/ui";
import {
  closePermitAction,
  resumePermitAction,
  suspendPermitAction,
} from "@/actions/permits";
import { PermitWorkflowNav } from "@/components/permit-summary";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { requireRoleAccess } from "@/lib/auth";
import { fetchPermit } from "@/lib/permit-queries";
import { getEffectivePermitStatus } from "@/lib/permits";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export default async function PermitClosurePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  await requireRoleAccess([
    "SUPER_ADMIN",
    "COMPANY_ADMIN",
    "SAFETY_ENGINEER",
    "EMPLOYEE_SIGNER",
  ]);
  const { id } = await params;
  const query = await searchParams;
  const companyId = firstString(query.companyId);
  const permit = await fetchPermit(id);
  const status = getEffectivePermitStatus(permit);
  const hidden = (
    <>
      <input type="hidden" name="permitId" value={permit.id} />
      <input
        type="hidden"
        name="companyId"
        value={companyId ?? permit.organizationId}
      />
    </>
  );

  return (
    <div className="space-y-6">
      {firstString(query.error) ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {firstString(query.error)}
        </div>
      ) : null}
      {firstString(query.success) ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {firstString(query.success)}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
            Приостановка и закрытие
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            {permit.permitCode}
          </h1>
        </div>
        <PermitWorkflowNav
          permitId={permit.id}
          companyId={companyId ?? permit.organizationId}
        />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">
              Текущее состояние
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <State label="Lifecycle" value={status} />
              <State label="Backend" value={permit.status} />
            </div>
            <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
              {permit.closure ? (
                <pre className="whitespace-pre-wrap break-words text-xs">
                  {JSON.stringify(permit.closure, null, 2)}
                </pre>
              ) : (
                "Артефакт закрытия ещё не создан."
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {status === "active" ? (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-slate-950">
                  Приостановить
                </h2>
              </CardHeader>
              <CardContent>
                <form action={suspendPermitAction} className="space-y-3">
                  {hidden}
                  <Textarea
                    name="reason"
                    required
                    placeholder="Причина приостановки"
                  />
                  <SubmitButton
                    label="Приостановить"
                    pendingLabel="Приостановка..."
                  />
                </form>
              </CardContent>
            </Card>
          ) : null}

          {status === "suspended" ? (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-slate-950">
                  Возобновить
                </h2>
              </CardHeader>
              <CardContent>
                <form action={resumePermitAction} className="space-y-3">
                  {hidden}
                  <Textarea
                    name="comment"
                    placeholder="Комментарий к возобновлению"
                  />
                  <SubmitButton
                    label="Возобновить"
                    pendingLabel="Возобновление..."
                  />
                </form>
              </CardContent>
            </Card>
          ) : null}

          {["active", "suspended"].includes(status) ? (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-slate-950">
                  Закрыть
                </h2>
              </CardHeader>
              <CardContent>
                <form action={closePermitAction} className="space-y-3">
                  {hidden}
                  <Textarea
                    name="result"
                    required
                    placeholder="Результат работ"
                  />
                  <Textarea
                    name="inspection"
                    required
                    placeholder="Результат осмотра места работ"
                  />
                  <Textarea
                    name="comment"
                    placeholder="Комментарий к закрытию"
                  />
                  <SubmitButton
                    label="Закрыть допуск"
                    pendingLabel="Закрытие..."
                  />
                </form>
              </CardContent>
            </Card>
          ) : null}
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
