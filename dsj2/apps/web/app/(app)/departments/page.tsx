import { Card, CardContent, CardHeader, Input, PageHeader, Table, TableWrapper, Td, Th } from "@dsj/ui";
import { createDepartmentAction } from "../../../actions/department";
import { CompanySwitcher } from "../../../components/company-switcher";
import { SubmitButton } from "../../../components/submit-button";
import { apiFetch } from "../../../lib/api";
import { requireRoleAccess } from "../../../lib/auth";
import { resolveCompanyContext } from "../../../lib/company-context";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DepartmentsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireRoleAccess(["COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const params = await searchParams;
  const { companies, activeCompanyId } = await resolveCompanyContext({
    session,
    pathname: "/departments",
    searchParams: params,
  });

  const departments = await apiFetch<
    Array<{
      id: string;
      name: string;
      code: string | null;
      _count: {
        employees: number;
        briefingRecords: number;
      };
    }>
  >(`departments${activeCompanyId ? `?companyId=${activeCompanyId}` : ""}`);

  return (
    <div className="space-y-6">
      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Структура компании</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Подразделения</h1>
        </div>
        <CompanySwitcher
          pathname="/departments"
          companies={companies}
          activeCompanyId={activeCompanyId}
          searchParams={params}
        />
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-[24px]">
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">Покрытие по подразделениям</h2>
          </CardHeader>
          <CardContent className="p-0">
            <TableWrapper className="border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Название</Th>
                    <Th>Код</Th>
                    <Th>Сотрудники</Th>
                    <Th>Инструктажи</Th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((department) => (
                    <tr key={department.id} className="border-t border-slate-100">
                      <Td className="font-medium text-slate-900">{department.name}</Td>
                      <Td>{department.code ?? "—"}</Td>
                      <Td>{department._count.employees}</Td>
                      <Td>{department._count.briefingRecords}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>

        <Card className="rounded-[24px]">
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">Создать подразделение</h2>
          </CardHeader>
          <CardContent>
            <form action={createDepartmentAction} className="space-y-4">
              <input type="hidden" name="companyId" value={activeCompanyId ?? ""} />
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Название подразделения</label>
                <Input name="name" placeholder="HSE" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Код</label>
                <Input name="code" placeholder="HSE" />
              </div>
              <SubmitButton label="Создать подразделение" pendingLabel="Создание..." />
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
