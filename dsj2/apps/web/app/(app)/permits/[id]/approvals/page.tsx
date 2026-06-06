import { Card, CardContent, CardHeader, PageHeader, Textarea } from "@dsj/ui";
import { formatDateTime } from "@dsj/utils";
import {
  approvePermitAction,
  confirmPermitAction,
  rejectPermitAction,
  submitPermitAction,
} from "@/actions/permits";
import { PermitWorkflowNav } from "@/components/permit-summary";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { requireRoleAccess } from "@/lib/auth";
import { fetchPermit } from "@/lib/permit-queries";
import { getEffectivePermitStatus, getPermitEntry } from "@/lib/permits";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export default async function PermitApprovalsPage({
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
  const entry = getPermitEntry(permit);
  const status = getEffectivePermitStatus(permit);
  const precheckPassed = entry?.precheckSummary?.result === "PASS";
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
            Маршрут согласования
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            {permit.permitCode}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Производитель подтверждает условия, ответственный руководитель
            согласует, выдающий подписывает, допускающий активирует.
          </p>
        </div>
        <PermitWorkflowNav
          permitId={permit.id}
          companyId={companyId ?? permit.organizationId}
        />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">Решения</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <State
                label="Precheck"
                value={precheckPassed ? "active" : "blocked"}
              />
              <State label="Workflow" value={status} />
              <State label="Backend" value={permit.status} />
            </div>
            {permit.approvals?.length ? (
              permit.approvals.map((decision) => (
                <div
                  key={decision.id}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-950">
                        Шаг {decision.stepNo}: {decision.role}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Назначен: {decision.assignedEmployeeId ?? "не назначен"}
                      </p>
                      {decision.comment ? (
                        <p className="mt-2 text-sm text-slate-600">
                          {decision.comment}
                        </p>
                      ) : null}
                      {decision.rejectionReason ? (
                        <p className="mt-2 text-sm text-rose-700">
                          {decision.rejectionReason}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <StatusBadge value={decision.status} />
                      {decision.decidedAt ? (
                        <p className="mt-2 text-xs text-slate-400">
                          {formatDateTime(decision.decidedAt)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Решения появятся после отправки на согласование.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">Действия</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {["draft", "missing_documents"].includes(status) ? (
              <form action={submitPermitAction} className="space-y-3">
                {hidden}
                <Textarea name="comment" placeholder="Комментарий к отправке" />
                <SubmitButton
                  label="Отправить на согласование"
                  pendingLabel="Отправка..."
                  disabled={!precheckPassed}
                />
              </form>
            ) : null}

            {status === "pending_approval" ? (
              <>
                <form action={confirmPermitAction} className="space-y-3">
                  {hidden}
                  <Textarea
                    name="comment"
                    placeholder="Комментарий производителя работ"
                  />
                  <SubmitButton
                    label="Подтвердить условия"
                    pendingLabel="Подтверждение..."
                  />
                </form>
                <form action={approvePermitAction} className="space-y-3">
                  {hidden}
                  <Textarea
                    name="comment"
                    placeholder="Комментарий руководителя"
                  />
                  <SubmitButton
                    label="Согласовать допуск"
                    pendingLabel="Согласование..."
                  />
                </form>
                <form action={rejectPermitAction} className="space-y-3">
                  {hidden}
                  <Textarea
                    name="reason"
                    required
                    placeholder="Причина отклонения"
                  />
                  <SubmitButton
                    label="Отклонить"
                    pendingLabel="Отклонение..."
                    variant="danger"
                  />
                </form>
              </>
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
