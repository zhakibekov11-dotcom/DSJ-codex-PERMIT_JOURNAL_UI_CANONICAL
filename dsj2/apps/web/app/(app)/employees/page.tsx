import {
  Card,
  CardContent,
  CardHeader,
  PageHeader,
  Table,
  TableWrapper,
  Td,
  Th,
} from "@dsj/ui";
import { formatDate } from "@dsj/utils";
import Link from "next/link";
import { archiveEmployeeAction } from "../../../actions/employee";
import { CompanySwitcher } from "../../../components/company-switcher";
import { StatusBadge } from "../../../components/status-badge";
import { apiFetch } from "../../../lib/api";
import { requireRoleAccess } from "../../../lib/auth";
import { resolveCompanyContext } from "../../../lib/company-context";
import { getDemoPersonaForEmail } from "../../../lib/demo-personas";
import { employeeKindLabels } from "../../../lib/labels";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireRoleAccess(["COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const params = await searchParams;
  const errorMessage = typeof params.error === "string" ? params.error : null;
  const successMessage =
    typeof params.success === "string" ? params.success : null;
  const { companies, activeCompanyId } = await resolveCompanyContext({
    session,
    pathname: "/employees",
    searchParams: params,
  });
  const currentDemoPersona = getDemoPersonaForEmail(session.user.email);
  const isReadOnlyPersona = currentDemoPersona?.readOnly === true;
  const isShopChiefPersona = currentDemoPersona?.key === "shop-chief";
  const activeCompanyName =
    companies.find((company) => company.id === activeCompanyId)?.name ?? null;
  const scopedQuery = activeCompanyId ? `?companyId=${activeCompanyId}` : "";

  const employees = await apiFetch<
    Array<{
      id: string;
      fullName: string;
      employeeNumber: string;
      jobTitle: string;
      jobTitleKz: string | null;
      iinMasked: string;
      email: string | null;
      phone: string | null;
      employeeKind: string;
      status: string;
      department?: { name: string } | null;
      site?: { name: string } | null;
      position?: { id: string; code: string; name: string } | null;
      contractorCompany?: { name: string } | null;
      briefingCount: number;
      hasAccount: boolean;
      accountEmail: string | null;
      createdAt: string;
    }>
  >(`employees${scopedQuery}`);
  const visibleEmployees = isShopChiefPersona
    ? employees.filter(
        (employee) =>
          employee.department?.name ===
            currentDemoPersona?.scopeDepartmentName &&
          employee.site?.name === currentDemoPersona?.scopeSiteName,
      )
    : employees;

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
            Реестр
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            Сотрудники
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Единый реестр штатных сотрудников и подрядчиков с маскировкой ИИН и
            привязкой к организациям.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {isReadOnlyPersona ? null : (
            <Link
              href={
                activeCompanyId
                  ? `/employees/new?companyId=${activeCompanyId}`
                  : "/employees/new"
              }
              className="inline-flex rounded-xl border border-[var(--surface-strong)] bg-[var(--surface-strong)] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--surface-strong-hover)]"
            >
              Добавить сотрудника
            </Link>
          )}
          {currentDemoPersona ? null : (
            <CompanySwitcher
              pathname="/employees"
              companies={companies}
              activeCompanyId={activeCompanyId}
              searchParams={params}
            />
          )}
        </div>
      </PageHeader>

      {currentDemoPersona ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {currentDemoPersona.title}: {currentDemoPersona.modeLabel}. Область:{" "}
          {currentDemoPersona.scopeLabel}.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">
            Список сотрудников
          </h2>
        </CardHeader>
        <CardContent className="p-0">
          <TableWrapper className="border-0">
            <Table>
              <thead>
                <tr>
                  <Th>ФИО</Th>
                  <Th>Табельный номер</Th>
                  <Th>Тип</Th>
                  <Th>Компания</Th>
                  <Th>Подразделение</Th>
                  <Th>Площадка</Th>
                  <Th>Должность</Th>
                  <Th>IIN</Th>
                  <Th>Кабинет</Th>
                  <Th>Статус</Th>
                  <Th className="text-right">Действия</Th>
                </tr>
              </thead>
              <tbody>
                {visibleEmployees.map((employee) => (
                  <tr key={employee.id} className="border-t border-slate-100">
                    <Td>
                      <div>
                        <p className="font-medium text-slate-900">
                          {employee.fullName}
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatDate(employee.createdAt)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {employee.contractorCompany?.name ??
                            activeCompanyName ??
                            "Компания"}{" "}
                          / {employee.department?.name ?? "без подразделения"} /{" "}
                          {employee.site?.name ?? "без площадки"} /{" "}
                          {employee.position?.name ?? employee.jobTitle}
                        </p>
                      </div>
                    </Td>
                    <Td>{employee.employeeNumber}</Td>
                    <Td>
                      {employeeKindLabels[employee.employeeKind] ??
                        employee.employeeKind}
                    </Td>
                    <Td>
                      {employee.contractorCompany?.name ??
                        activeCompanyName ??
                        "Текущая компания"}
                    </Td>
                    <Td>{employee.department?.name ?? "—"}</Td>
                    <Td>{employee.site?.name ?? "—"}</Td>
                    <Td>
                      <div>
                        <p>{employee.position?.name ?? employee.jobTitle}</p>
                        <p className="text-xs text-slate-400">
                          {employee.position?.code ?? employee.jobTitleKz ?? "—"}
                        </p>
                      </div>
                    </Td>
                    <Td>{employee.iinMasked}</Td>
                    <Td>
                      <div>
                        <StatusBadge
                          value={
                            employee.hasAccount
                              ? "account_enabled"
                              : "account_disabled"
                          }
                        />
                        <p className="mt-1 text-xs text-slate-400">
                          {employee.accountEmail ?? "Личный кабинет не создан"}
                        </p>
                      </div>
                    </Td>
                    <Td>
                      <StatusBadge value={employee.status} />
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-2">
                        <Link
                          href={
                            activeCompanyId
                              ? `/employees/${employee.id}?companyId=${activeCompanyId}`
                              : `/employees/${employee.id}`
                          }
                          className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50"
                        >
                          Карточка
                        </Link>
                        {isReadOnlyPersona ? null : (
                          <>
                            <Link
                              href={
                                activeCompanyId
                                  ? `/employees/${employee.id}/edit?companyId=${activeCompanyId}`
                                  : `/employees/${employee.id}/edit`
                              }
                              className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50"
                            >
                              Редактировать
                            </Link>
                            <form action={archiveEmployeeAction}>
                              <input
                                type="hidden"
                                name="companyId"
                                value={activeCompanyId ?? ""}
                              />
                              <input
                                type="hidden"
                                name="employeeId"
                                value={employee.id}
                              />
                              <button
                                type="submit"
                                className="rounded-md border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 transition-colors duration-150 hover:bg-rose-50"
                              >
                                Уволить
                              </button>
                            </form>
                          </>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrapper>
        </CardContent>
      </Card>
    </div>
  );
}
