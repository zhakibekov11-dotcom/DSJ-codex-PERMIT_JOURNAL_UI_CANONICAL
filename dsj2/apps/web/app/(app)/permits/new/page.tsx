import { Card, CardContent, CardHeader, PageHeader } from "@dsj/ui";
import { createPermitAction } from "@/actions/permits";
import { CompanySwitcher } from "@/components/company-switcher";
import { PermitEntryForm } from "@/components/permit-entry-form";
import { requireRoleAccess } from "@/lib/auth";
import { resolveCompanyContext } from "@/lib/company-context";
import { fetchPermitFormOptions } from "@/lib/permit-queries";
import { buildWorkSitesManageHref } from "@/lib/safe-return-path";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" && value.length ? value : null;
}

export default async function NewPermitPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireRoleAccess(["SUPER_ADMIN", "COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const params = await searchParams;
  const errorMessage = firstString(params.error);
  const { companies, activeCompanyId } = await resolveCompanyContext({
    session,
    pathname: "/permits/new",
    searchParams: params,
  });
  const options = await fetchPermitFormOptions(activeCompanyId ?? session.user.companyId ?? null);
  const effectiveCompanyId = activeCompanyId ?? session.user.companyId ?? null;

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Создание PermitEntry</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Создать допуск</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Черновик будет сохранён в WorkPermitVersion payload и пройдёт precheck перед
            согласованием.
          </p>
        </div>
        <CompanySwitcher
          pathname="/permits/new"
          companies={companies}
          activeCompanyId={activeCompanyId}
          searchParams={params}
        />
      </PageHeader>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">Карточка допуска</h2>
        </CardHeader>
        <CardContent>
          <PermitEntryForm
            action={createPermitAction}
            hiddenFields={[{ name: "companyId", value: activeCompanyId ?? session.user.companyId }]}
            employees={options.employees}
            departments={options.departments}
            workSites={options.workSites}
            workSitesManageHref={buildWorkSitesManageHref(
              effectiveCompanyId,
              `/permits/new${effectiveCompanyId ? `?companyId=${effectiveCompanyId}` : ""}`,
            )}
            contractors={options.contractors}
            submitLabel="Создать допуск"
            pendingLabel="Создание допуска..."
          />
        </CardContent>
      </Card>
    </div>
  );
}
