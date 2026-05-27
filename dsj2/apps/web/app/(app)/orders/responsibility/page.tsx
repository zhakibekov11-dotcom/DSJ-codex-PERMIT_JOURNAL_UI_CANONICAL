import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  Input,
  PageHeader,
  Select,
  Table,
  TableWrapper,
  Td,
  Th,
} from "@dsj/ui";
import { formatDate } from "@dsj/utils";
import { Plus } from "lucide-react";
import { CompanySwitcher } from "@/components/company-switcher";
import { StatusBadge } from "@/components/status-badge";
import { apiFetch } from "@/lib/api";
import { requireRoleAccess } from "@/lib/auth";
import { resolveCompanyContext } from "@/lib/company-context";
import { getResponsibilityTypeLabel } from "@/lib/labels";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return typeof value === "string" ? value : "";
}

const responsibilityTypes = [
  "OCCUPATIONAL_SAFETY_RESPONSIBLE",
  "FIRE_SAFETY_RESPONSIBLE",
  "DEPARTMENT_RESPONSIBLE",
  "OBJECT_RESPONSIBLE",
  "INSTRUCTOR_APPOINTMENT",
  "BRIEFING_AUTHORIZED_PERSON",
  "PERMIT_ISSUER_AUTHORIZED_PERSON",
  "RESPONSIBLE_WORK_MANAGER",
];

export default async function ResponsibilityOrderRegistryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireRoleAccess(["COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const params = await searchParams;
  const errorMessage = firstString(params.error);
  const successMessage = firstString(params.success);
  const { companies, activeCompanyId } = await resolveCompanyContext({
    session,
    pathname: "/orders/responsibility",
    searchParams: params,
  });
  const scopedQuery = activeCompanyId ? `?companyId=${activeCompanyId}` : "";
  const query = new URLSearchParams();

  if (activeCompanyId) {
    query.set("organizationId", activeCompanyId);
  }

  for (const key of [
    "search",
    "dateFrom",
    "dateTo",
    "employeeId",
    "departmentId",
    "workSiteId",
    "responsibilityType",
    "status",
  ]) {
    const value = firstString(params[key]);
    if (value) {
      query.set(key, value);
    }
  }

  const [orders, departments, workSites, employees] = await Promise.all([
    apiFetch<
      Array<{
        id: string;
        number: string;
        date: string;
        responsibilityType: string;
        basis: string;
        status: string;
        canonicalStatus: string | null;
        isSigned: boolean;
        evidenceAvailable: boolean;
        appointments: Array<{
          employee: {
            fullName: string;
          };
        }>;
        department?: { name: string } | null;
        workSite?: { name: string; location?: string | null } | null;
        archiveRecordSummary?: {
          retentionCode: string;
          status: string;
        } | null;
      }>
    >(`responsibility-orders${query.toString() ? `?${query.toString()}` : ""}`),
    apiFetch<Array<{ id: string; name: string }>>(`departments${scopedQuery}`),
    apiFetch<Array<{ id: string; name: string; location: string | null }>>(`core-platform/work-sites${scopedQuery}`),
    apiFetch<Array<{ id: string; fullName: string; employeeNumber: string }>>(`employees${scopedQuery}`),
  ]);

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
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Реестр</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Приказы о назначении ответственных</h1>
          <p className="mt-2 text-sm text-slate-500">
            Подписанные приказы о назначении с состоянием реестра, архива и доказательств, а также
            привязанными назначениями.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <CompanySwitcher
            pathname="/orders/responsibility"
            companies={companies}
            activeCompanyId={activeCompanyId}
            searchParams={params}
          />
          <Link
            href={
              activeCompanyId
                ? `/orders/responsibility/new?companyId=${activeCompanyId}`
                : "/orders/responsibility/new"
            }
            className="inline-flex items-center gap-2 rounded-md bg-[var(--surface-strong)] px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--surface-strong-hover)]"
          >
            <Plus className="h-4 w-4" />
            Новый приказ
          </Link>
        </div>
      </PageHeader>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">Фильтры</h2>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-[1.5fr_repeat(7,minmax(0,1fr))_auto]">
            <input type="hidden" name="companyId" value={activeCompanyId ?? ""} />
            <Input name="search" placeholder="Поиск по номеру приказа" defaultValue={firstString(params.search)} />
            <Input name="dateFrom" type="date" defaultValue={firstString(params.dateFrom)} />
            <Input name="dateTo" type="date" defaultValue={firstString(params.dateTo)} />
            <Select name="responsibilityType" defaultValue={firstString(params.responsibilityType)}>
              <option value="">Все типы ответственности</option>
              {responsibilityTypes.map((value) => (
                <option key={value} value={value}>
                  {getResponsibilityTypeLabel(value)}
                </option>
              ))}
            </Select>
            <Select name="employeeId" defaultValue={firstString(params.employeeId)}>
              <option value="">Все сотрудники</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName} ({employee.employeeNumber})
                </option>
              ))}
            </Select>
            <Select name="departmentId" defaultValue={firstString(params.departmentId)}>
              <option value="">Все подразделения</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
            <Select name="workSiteId" defaultValue={firstString(params.workSiteId)}>
              <option value="">Все объекты</option>
              {workSites.map((workSite) => (
                <option key={workSite.id} value={workSite.id}>
                  {workSite.name}
                </option>
              ))}
            </Select>
            <Select name="status" defaultValue={firstString(params.status)}>
              <option value="">Все статусы</option>
              <option value="DRAFT">Черновик</option>
              <option value="SIGNING_READY">Готово к подписанию</option>
              <option value="SIGNED">Подписан</option>
              <option value="ACTIVE">Действует</option>
              <option value="EXPIRED">Истёк</option>
              <option value="ANNULLED">Аннулирован</option>
              <option value="SUPERSEDED">Заменён</option>
            </Select>
            <button
              type="submit"
              className="rounded-md bg-[var(--surface-strong)] px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--surface-strong-hover)]"
            >
              Применить
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">Приказы</h2>
        </CardHeader>
        <CardContent className="p-0">
          <TableWrapper className="border-0">
            <Table>
              <thead>
                <tr>
                  <Th>Приказ</Th>
                  <Th>Назначения</Th>
                  <Th>Область</Th>
                  <Th>Тип / основание</Th>
                  <Th>Дата</Th>
                  <Th>Статус</Th>
                  <Th>Канонический статус</Th>
                  <Th>Доказательства / архив</Th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-t border-slate-100">
                    <Td>
                      <div>
                        <Link
                          href={
                            activeCompanyId
                              ? `/orders/responsibility/${order.id}?companyId=${activeCompanyId}`
                              : `/orders/responsibility/${order.id}`
                          }
                          className="font-medium text-slate-900"
                        >
                          {order.number}
                        </Link>
                        <p className="mt-1 text-xs text-slate-500">
                          {order.isSigned ? "Подписанный неизменяемый приказ" : "Черновик / в работе"}
                        </p>
                      </div>
                    </Td>
                    <Td>
                      <div>
                        <p className="text-sm text-slate-700">Назначений: {order.appointments.length}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {order.appointments
                            .slice(0, 3)
                            .map((appointment) => appointment.employee.fullName)
                            .join(", ")}
                          {order.appointments.length > 3 ? "..." : ""}
                        </p>
                      </div>
                    </Td>
                    <Td>
                      <div className="text-sm text-slate-700">
                        <p>{order.department?.name ?? "Не назначено"}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {order.workSite?.name
                            ? `${order.workSite.name}${order.workSite.location ? ` • ${order.workSite.location}` : ""}`
                            : "Область организации / филиала"}
                        </p>
                      </div>
                    </Td>
                    <Td>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {getResponsibilityTypeLabel(order.responsibilityType)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{order.basis}</p>
                      </div>
                    </Td>
                    <Td>{formatDate(order.date)}</Td>
                    <Td>
                      <StatusBadge value={order.status} />
                    </Td>
                    <Td>{order.canonicalStatus ? <StatusBadge value={order.canonicalStatus} /> : "Не привязано"}</Td>
                    <Td>
                      <div className="space-y-1 text-xs text-slate-500">
                        <p>{order.evidenceAvailable ? "Доказательства доступны" : "Пакет доказательств пока отсутствует"}</p>
                        <p>
                          {order.archiveRecordSummary
                            ? `${order.archiveRecordSummary.status} • ${order.archiveRecordSummary.retentionCode}`
                            : "Архив ещё не запечатан"}
                        </p>
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
