import { Card, CardContent, CardHeader, PageHeader } from "@dsj/ui";
import { runPermitPrecheckAction } from "@/actions/permits";
import { PermitPrecheckList, PermitWorkflowNav } from "@/components/permit-summary";
import { SubmitButton } from "@/components/submit-button";
import { requireRoleAccess } from "@/lib/auth";
import { fetchPermit } from "@/lib/permit-queries";
import { getPermitEntry, isPermitLocked } from "@/lib/permits";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" && value.length ? value : null;
}

export default async function PermitPrecheckPage({
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
  const locked = isPermitLocked(permit);

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
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Проверка перед допуском</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">{permit.permitCode}</h1>
          <p className="mt-2 text-sm text-slate-500">
            Precheck сохраняет snapshots обучения, инструктажа, удостоверений, медосмотра,
            СИЗ и документов. Диагнозы не сохраняются.
          </p>
        </div>
        <PermitWorkflowNav permitId={permit.id} companyId={companyId ?? permit.organizationId} />
      </PageHeader>

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <h2 className="text-lg font-semibold text-slate-950">Блокирующие проверки</h2>
            {!locked ? (
              <form action={runPermitPrecheckAction}>
                <input type="hidden" name="permitId" value={permit.id} />
                <input type="hidden" name="companyId" value={companyId ?? permit.organizationId} />
                <SubmitButton label="Запустить precheck" pendingLabel="Проверка..." />
              </form>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <PermitPrecheckList entry={entry} />
        </CardContent>
      </Card>
    </div>
  );
}
