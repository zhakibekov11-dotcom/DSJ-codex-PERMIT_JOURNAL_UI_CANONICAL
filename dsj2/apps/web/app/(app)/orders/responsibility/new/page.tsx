import { Card, CardContent, CardHeader, PageHeader } from "@dsj/ui";
import { createOrReplaceResponsibilityOrderAction } from "@/actions/responsibility-order";
import { CompanySwitcher } from "@/components/company-switcher";
import { ResponsibilityOrderDraftForm } from "@/components/responsibility-order-draft-form";
import { apiFetch } from "@/lib/api";
import { requireRoleAccess } from "@/lib/auth";
import { resolveCompanyContext } from "@/lib/company-context";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === "string" && value.length ? value : null;
}

export default async function NewResponsibilityOrderPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireRoleAccess(["COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const params = await searchParams;
  const errorMessage = firstString(params.error);
  const replaceOrderId = firstString(params.replaceOrderId);
  const { companies, activeCompanyId } = await resolveCompanyContext({
    session,
    pathname: "/orders/responsibility/new",
    searchParams: params,
  });
  const effectiveCompanyId = activeCompanyId ?? session.user.companyId ?? null;
  const scopedQuery = effectiveCompanyId ? `?companyId=${effectiveCompanyId}` : "";

  const [employees, branches, departments, workSites, replacementSource] = await Promise.all([
    apiFetch<
      Array<{
        id: string;
        fullName: string;
        employeeNumber: string;
        employeeKind: string;
        jobTitle: string;
        department?: { name: string } | null;
      }>
    >(`employees${scopedQuery}`),
    apiFetch<Array<{ id: string; code?: string | null; name: string }>>(`core-platform/branches${scopedQuery}`),
    apiFetch<Array<{ id: string; name: string }>>(`departments${scopedQuery}`),
    apiFetch<Array<{ id: string; name: string; location: string | null }>>(`core-platform/work-sites${scopedQuery}`),
    replaceOrderId
      ? apiFetch<{
          id: string;
          organizationId: string;
          number: string;
          date: string;
          responsibilityType: string;
          title: string;
          basis: string;
          branchId: string | null;
          departmentId: string | null;
          workSiteId: string | null;
          notes: string | null;
          appointments: Array<{
            employeeId: string;
            effectiveFrom: string;
            effectiveTo?: string | null;
            zoneOfResponsibility?: string | null;
            roleNotes?: string | null;
          }>;
        }>(`responsibility-orders/${replaceOrderId}`)
      : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
            {replaceOrderId ? "Черновик замены" : "Черновик приказа о назначении"}
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            {replaceOrderId ? "Создать приказ-замену" : "Создать черновик приказа"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Подписанные приказы о назначении становятся неизменяемыми и изменяют назначения только
            через канонический подписанный жизненный цикл.
          </p>
        </div>
        <CompanySwitcher
          pathname="/orders/responsibility/new"
          companies={companies}
          activeCompanyId={effectiveCompanyId}
          searchParams={params}
        />
      </PageHeader>

      {replacementSource ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Подписанный приказ <span className="font-medium">{replacementSource.number}</span> заблокирован.
          Эта форма создаёт черновик-замену вместо редактирования подписанного исходного документа.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">Черновик приказа о назначении</h2>
        </CardHeader>
        <CardContent>
          <ResponsibilityOrderDraftForm
            action={createOrReplaceResponsibilityOrderAction}
            hiddenFields={[
              { name: "companyId", value: effectiveCompanyId },
              { name: "replaceOrderId", value: replaceOrderId },
            ]}
            employees={employees}
            branches={branches}
            departments={departments}
            workSites={workSites}
            initialValues={
              replacementSource
                ? {
                    number: replacementSource.number,
                    date: replacementSource.date,
                    responsibilityType: replacementSource.responsibilityType,
                    title: replacementSource.title,
                    basis: replacementSource.basis,
                    branchId: replacementSource.branchId,
                    departmentId: replacementSource.departmentId,
                    workSiteId: replacementSource.workSiteId,
                    notes: replacementSource.notes,
                    appointments: replacementSource.appointments,
                    reason: "Подписанный приказ о назначении заменяется исправленной редакцией.",
                  }
                : undefined
            }
            replacementMode={Boolean(replacementSource)}
            submitLabel={replacementSource ? "Создать черновик замены" : "Создать черновик"}
            pendingLabel={replacementSource ? "Создание черновика замены..." : "Создание черновика..."}
          />
        </CardContent>
      </Card>
    </div>
  );
}
