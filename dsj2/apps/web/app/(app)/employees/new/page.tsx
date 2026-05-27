import { Card, CardContent, CardHeader, PageHeader } from "@dsj/ui";
import { redirect } from "next/navigation";
import { createEmployeeAction } from "../../../../actions/employee";
import { EmployeeEditorForm } from "../../../../components/employee-editor-form";
import { apiFetch } from "../../../../lib/api";
import { requireRoleAccess } from "../../../../lib/auth";
import { resolveCompanyContext } from "../../../../lib/company-context";
import { getDemoPersonaForEmail } from "../../../../lib/demo-personas";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NewEmployeePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireRoleAccess(["COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const params = await searchParams;
  const errorMessage = typeof params.error === "string" ? params.error : null;
  const currentDemoPersona = getDemoPersonaForEmail(session.user.email);

  if (currentDemoPersona?.readOnly) {
    redirect(
      `/employees?error=${encodeURIComponent("Демо-директор работает в режиме просмотра.")}`,
    );
  }

  const { activeCompanyId } = await resolveCompanyContext({
    session,
    pathname: "/employees/new",
    searchParams: params,
  });

  const scopedQuery = activeCompanyId ? `?companyId=${activeCompanyId}` : "";
  const [departments, positions, contractorCompanies] = await Promise.all([
    apiFetch<Array<{ id: string; name: string }>>(`departments${scopedQuery}`),
    apiFetch<Array<{ id: string; code: string; name: string }>>(`core-platform/positions${scopedQuery}`),
    apiFetch<Array<{ id: string; name: string }>>(`contractor-companies${scopedQuery}`),
  ]);

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Новый сотрудник</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Создать карточку сотрудника</h1>
          <p className="mt-2 text-sm text-slate-500">
            Создайте сотрудника в отдельной карточке. Фото необязательно, но если его загрузить,
            оно автоматически подтянется в редактор шаблонов удостоверений.
          </p>
        </div>
      </PageHeader>

      <Card className="rounded-[24px]">
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">Данные сотрудника</h2>
        </CardHeader>
        <CardContent>
          <EmployeeEditorForm
            mode="create"
            action={createEmployeeAction}
            companyId={activeCompanyId ?? ""}
            departments={departments}
            positions={positions}
            contractorCompanies={contractorCompanies}
          />
        </CardContent>
      </Card>
    </div>
  );
}
