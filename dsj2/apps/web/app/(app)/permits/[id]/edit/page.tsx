import { Card, CardContent, CardHeader, PageHeader } from "@dsj/ui";
import { updatePermitAction } from "@/actions/permits";
import { PermitEntryForm } from "@/components/permit-entry-form";
import { PermitWorkflowNav } from "@/components/permit-summary";
import { requireRoleAccess } from "@/lib/auth";
import { fetchPermit, fetchPermitFormOptions } from "@/lib/permit-queries";
import { getPermitEntry, isPermitLocked } from "@/lib/permits";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" && value.length ? value : null;
}

export default async function EditPermitPage({
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
  const permit = await fetchPermit(id);
  const entry = getPermitEntry(permit);
  const effectiveCompanyId = companyId ?? permit.organizationId;
  const options = await fetchPermitFormOptions(effectiveCompanyId);
  const locked = isPermitLocked(permit);

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Редактирование допуска</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">{permit.permitCode}</h1>
          <p className="mt-2 text-sm text-slate-500">
            Редактирование создаёт новую WorkPermitVersion до согласования. После approved
            signed fields заблокированы.
          </p>
        </div>
        <PermitWorkflowNav permitId={permit.id} companyId={effectiveCompanyId} />
      </PageHeader>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">PermitEntry</h2>
        </CardHeader>
        <CardContent>
          <PermitEntryForm
            action={updatePermitAction}
            hiddenFields={[
              { name: "permitId", value: permit.id },
              { name: "companyId", value: effectiveCompanyId },
            ]}
            employees={options.employees}
            departments={options.departments}
            workSites={options.workSites}
            contractors={options.contractors}
            initialValues={entry}
            submitLabel="Сохранить новую версию"
            pendingLabel="Сохранение..."
            locked={locked}
          />
        </CardContent>
      </Card>
    </div>
  );
}
