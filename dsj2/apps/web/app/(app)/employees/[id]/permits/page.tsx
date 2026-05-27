import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  PageHeader,
  Table,
  TableWrapper,
  Td,
  Th,
} from "@dsj/ui";
import { formatDateTime } from "@dsj/utils";
import { CompanySwitcher } from "@/components/company-switcher";
import { StatusBadge } from "@/components/status-badge";
import { apiFetch } from "@/lib/api";
import { requireRoleAccess } from "@/lib/auth";
import { resolveCompanyContext } from "@/lib/company-context";
import { fetchPermits } from "@/lib/permit-queries";
import {
  getEffectivePermitStatus,
  getPermitEntry,
  getPermitTypeLabel,
  getPermitWorkTypeLabel,
  permitReferencesEmployee,
} from "@/lib/permits";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type EmployeeSummary = {
  id: string;
  companyId: string;
  fullName: string;
  employeeNumber: string;
  jobTitle: string;
  employeeKind: string;
  department?: { name: string } | null;
  contractorCompany?: { name: string } | null;
};

export default async function EmployeePermitsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const session = await requireRoleAccess(["SUPER_ADMIN", "COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const { id } = await params;
  const rawSearchParams = await searchParams;
  const employee = await apiFetch<EmployeeSummary>(`employees/${id}`);
  const { companies, activeCompanyId } = await resolveCompanyContext({
    session,
    pathname: `/employees/${id}/permits`,
    searchParams: rawSearchParams,
  });
  const companyId = activeCompanyId ?? employee.companyId;
  const permits = companyId ? await fetchPermits(companyId) : [];
  const employeePermits = permits.filter((permit) => permitReferencesEmployee(permit, id));

  return (
    <div className="space-y-6">
      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Employee permits</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">{employee.fullName}</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Допуски, где сотрудник указан в PermitEntry как ответственный, допускающий,
            производитель работ, наблюдающий, представитель подрядчика или член бригады.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {employee.employeeNumber} · {employee.jobTitle} ·{" "}
            {employee.contractorCompany?.name ?? employee.department?.name ?? "подразделение не задано"}
          </p>
        </div>
        <CompanySwitcher
          pathname={`/employees/${id}/permits`}
          companies={companies}
          activeCompanyId={activeCompanyId}
          searchParams={rawSearchParams}
        />
      </PageHeader>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">Допуски сотрудника</h2>
        </CardHeader>
        <CardContent className="p-0">
          {employeePermits.length ? (
            <TableWrapper className="border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Номер допуска</Th>
                    <Th>Тип / вид работ</Th>
                    <Th>Роль в PermitEntry</Th>
                    <Th>Сроки</Th>
                    <Th>Статус</Th>
                    <Th>Проверки</Th>
                  </tr>
                </thead>
                <tbody>
                  {employeePermits.map((permit) => {
                    const entry = getPermitEntry(permit);
                    const status = getEffectivePermitStatus(permit);
                    const query = companyId ? `?companyId=${companyId}` : "";
                    const roles = entry ? resolveEmployeePermitRoles(entry, id) : [];

                    return (
                      <tr key={permit.id} className="border-t border-slate-100">
                        <Td>
                          <Link href={`/permits/${permit.id}${query}`} className="font-medium text-slate-900">
                            {entry?.permitNumber ?? permit.permitCode}
                          </Link>
                          <p className="mt-1 text-xs text-slate-500">
                            {entry?.journalRegistrationNumber ?? permit.id}
                          </p>
                        </Td>
                        <Td>
                          <p className="text-sm font-medium text-slate-900">{getPermitTypeLabel(entry?.permitType)}</p>
                          <p className="mt-1 text-xs text-slate-500">{getPermitWorkTypeLabel(entry?.workType)}</p>
                        </Td>
                        <Td>{roles.length ? roles.join(", ") : "участник бригады"}</Td>
                        <Td>
                          <p className="text-sm text-slate-700">{entry?.startAt ? formatDateTime(entry.startAt) : "не задано"}</p>
                          <p className="mt-1 text-xs text-slate-500">{entry?.endAt ? formatDateTime(entry.endAt) : "не задано"}</p>
                        </Td>
                        <Td>
                          <StatusBadge value={status} />
                        </Td>
                        <Td>
                          {entry?.precheckSummary?.checkedAt
                            ? formatDateTime(entry.precheckSummary.checkedAt)
                            : "precheck не запускался"}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrapper>
          ) : (
            <EmptyState className="min-h-32 justify-center text-left">
              Для этого сотрудника пока нет связанных допусков.
            </EmptyState>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function resolveEmployeePermitRoles(
  entry: NonNullable<ReturnType<typeof getPermitEntry>>,
  employeeId: string,
) {
  const roles: string[] = [];

  if (entry.contractorRepresentativeId === employeeId) roles.push("представитель подрядчика");
  if (entry.issuerId === employeeId) roles.push("выдал допуск");
  if (entry.responsibleManagerId === employeeId) roles.push("ответственный руководитель");
  if (entry.workProducerId === employeeId) roles.push("производитель работ");
  if (entry.admitterId === employeeId) roles.push("допускающий");
  if (entry.observerId === employeeId) roles.push("наблюдающий");
  if (entry.crewMemberIds.includes(employeeId)) roles.push("член бригады");

  return roles;
}
