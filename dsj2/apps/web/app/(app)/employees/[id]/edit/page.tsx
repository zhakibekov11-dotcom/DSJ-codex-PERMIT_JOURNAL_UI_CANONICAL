import { Card, CardContent, CardHeader, PageHeader } from "@dsj/ui";
import { redirect } from "next/navigation";
import { updateEmployeeAction } from "../../../../../actions/employee";
import { EmployeeEditorForm } from "../../../../../components/employee-editor-form";
import { apiFetch } from "../../../../../lib/api";
import { requireRoleAccess } from "../../../../../lib/auth";
import { getDemoPersonaForEmail } from "../../../../../lib/demo-personas";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function EditEmployeePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const session = await requireRoleAccess(["COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const { id } = await params;
  const currentDemoPersona = getDemoPersonaForEmail(session.user.email);

  if (currentDemoPersona?.readOnly) {
    redirect(`/employees/${id}`);
  }

  const rawSearchParams = await searchParams;
  const errorMessage = typeof rawSearchParams.error === "string" ? rawSearchParams.error : null;

  const employee = await apiFetch<{
    id: string;
    companyId: string;
    departmentId: string | null;
    positionId: string | null;
    contractorCompanyId: string | null;
    fullName: string;
    employeeNumber: string;
    jobTitle: string;
    jobTitleKz: string | null;
    photoDataUrl: string | null;
    photoFileName: string | null;
    email: string | null;
    phone: string | null;
    employeeKind: string;
    status: string;
    accountEmail: string | null;
    hasAccount: boolean;
  }>(`employees/${id}`);

  const scopedQuery = employee.companyId ? `?companyId=${employee.companyId}` : "";
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
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Карточка сотрудника</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Редактировать сотрудника</h1>
          <p className="mt-2 text-sm text-slate-500">
            Проверьте личные данные, должность и при необходимости обновите фото для корочек.
          </p>
        </div>
      </PageHeader>

      <Card className="rounded-[24px]">
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">{employee.fullName}</h2>
        </CardHeader>
        <CardContent>
          <EmployeeEditorForm
            mode="edit"
            action={updateEmployeeAction}
            companyId={employee.companyId}
            departments={departments}
            positions={positions}
            contractorCompanies={contractorCompanies}
            employee={employee}
          />
        </CardContent>
      </Card>
    </div>
  );
}
