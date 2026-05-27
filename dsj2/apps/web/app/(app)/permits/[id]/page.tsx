import { PageHeader } from "@dsj/ui";
import { activatePermitAction, annulPermitAction } from "@/actions/permits";
import { PermitSummary, PermitWorkflowNav } from "@/components/permit-summary";
import { SubmitButton } from "@/components/submit-button";
import { getDemoPersonaForEmail } from "@/lib/demo-personas";
import { requireRoleAccess } from "@/lib/auth";
import { fetchPermit } from "@/lib/permit-queries";
import { getEffectivePermitStatus } from "@/lib/permits";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" && value.length ? value : null;
}

export default async function PermitDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const session = await requireRoleAccess(["SUPER_ADMIN", "COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const { id } = await params;
  const rawSearchParams = await searchParams;
  const companyId = firstString(rawSearchParams.companyId);
  const errorMessage = firstString(rawSearchParams.error);
  const successMessage = firstString(rawSearchParams.success);
  const permit = await fetchPermit(id);
  const status = getEffectivePermitStatus(permit);
  const readOnly = getDemoPersonaForEmail(session.user.email)?.key === "director";

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
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Карточка допуска</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">{permit.permitCode}</h1>
          <p className="mt-2 text-sm text-slate-500">
            Подписанный payload отделён от PDF. Evidence показывается только при наличии
            document envelope.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <PermitWorkflowNav permitId={permit.id} companyId={companyId ?? permit.organizationId} />
          {!readOnly && (status === "approved" || permit.status === "SIGNED") ? (
            <form action={activatePermitAction} className="flex gap-2">
              <input type="hidden" name="permitId" value={permit.id} />
              <input type="hidden" name="companyId" value={companyId ?? permit.organizationId} />
              <SubmitButton label="Активировать" pendingLabel="Активация..." />
            </form>
          ) : null}
          {!readOnly && ["draft", "missing_documents", "pending_precheck", "rejected"].includes(status) ? (
            <form action={annulPermitAction} className="flex gap-2">
              <input type="hidden" name="permitId" value={permit.id} />
              <input type="hidden" name="companyId" value={companyId ?? permit.organizationId} />
              <input type="hidden" name="reason" value="Допуск отменён из карточки допуска." />
              <SubmitButton label="Отменить допуск" pendingLabel="Отмена..." variant="danger" />
            </form>
          ) : null}
        </div>
      </PageHeader>

      <PermitSummary permit={permit} companyId={companyId ?? permit.organizationId} readOnly={readOnly} />
    </div>
  );
}
