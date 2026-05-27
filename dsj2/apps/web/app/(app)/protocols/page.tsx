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

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return typeof value === "string" ? value : "";
}

export default async function ProtocolRegistryPage({
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
    pathname: "/protocols",
    searchParams: params,
  });
  const scopedQuery = activeCompanyId ? `?companyId=${activeCompanyId}` : "";
  const query = new URLSearchParams();

  if (activeCompanyId) {
    query.set("organizationId", activeCompanyId);
  }

  for (const key of ["search", "dateFrom", "dateTo", "employeeId", "departmentId", "status"]) {
    const value = firstString(params[key]);
    if (value) {
      query.set(key, value);
    }
  }

  const [protocols, departments, employees] = await Promise.all([
    apiFetch<
      Array<{
        id: string;
        number: string;
        date: string;
        protocolType: string;
        basis: string;
        status: string;
        canonicalStatus: string | null;
        isSigned: boolean;
        evidenceAvailable: boolean;
        employees: Array<{
          employeeId: string;
          fullName: string;
          employeeNumber?: string | null;
        }>;
        department?: { name: string } | null;
        archiveRecordSummary?: {
          retentionCode: string;
          status: string;
        } | null;
      }>
    >(`protocols${query.toString() ? `?${query.toString()}` : ""}`),
    apiFetch<Array<{ id: string; name: string }>>(`departments${scopedQuery}`),
    apiFetch<Array<{ id: string; fullName: string; employeeNumber: string }>>(`employees${scopedQuery}`),
  ]);

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Реестр</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Реестр протоколов</h1>
          <p className="mt-2 text-sm text-slate-500">
            Поиск черновиков и подписанных протоколов проверки знаний или комиссий без выхода из
            канонического потока документов.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <CompanySwitcher
            pathname="/protocols"
            companies={companies}
            activeCompanyId={activeCompanyId}
            searchParams={params}
          />
          <Link
            href={activeCompanyId ? `/protocols/new?companyId=${activeCompanyId}` : "/protocols/new"}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--surface-strong)] px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--surface-strong-hover)]"
          >
            <Plus className="h-4 w-4" />
            Новый протокол
          </Link>
        </div>
      </PageHeader>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">Фильтры</h2>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-[1.8fr_repeat(5,minmax(0,1fr))_auto]">
            <input type="hidden" name="companyId" value={activeCompanyId ?? ""} />
            <Input name="search" placeholder="Поиск по номеру протокола" defaultValue={firstString(params.search)} />
            <Input name="dateFrom" type="date" defaultValue={firstString(params.dateFrom)} />
            <Input name="dateTo" type="date" defaultValue={firstString(params.dateTo)} />
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
            <Select name="status" defaultValue={firstString(params.status)}>
              <option value="">Все статусы</option>
              <option value="DRAFT">Черновик</option>
              <option value="SIGNING_READY">Готово к подписанию</option>
              <option value="SIGNED">Подписан</option>
              <option value="ANNULLED">Аннулирован</option>
              <option value="SUPERSEDED">Заменён</option>
              <option value="EXPIRED">Истёк</option>
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
          <h2 className="text-lg font-semibold text-slate-950">Протоколы</h2>
        </CardHeader>
        <CardContent className="p-0">
          <TableWrapper className="border-0">
            <Table>
              <thead>
                <tr>
                  <Th>Протокол</Th>
                  <Th>Сотрудники</Th>
                  <Th>Подразделение</Th>
                  <Th>Тип / основание</Th>
                  <Th>Дата</Th>
                  <Th>Статус</Th>
                  <Th>Канонический статус</Th>
                  <Th>Доказательства / архив</Th>
                </tr>
              </thead>
              <tbody>
                {protocols.map((protocol) => (
                  <tr key={protocol.id} className="border-t border-slate-100">
                    <Td>
                      <div>
                        <Link
                          href={
                            activeCompanyId
                              ? `/protocols/${protocol.id}?companyId=${activeCompanyId}`
                              : `/protocols/${protocol.id}`
                          }
                          className="font-medium text-slate-900"
                        >
                          {protocol.number}
                        </Link>
                        <p className="mt-1 text-xs text-slate-500">
                          {protocol.isSigned ? "Подписанная редакция" : "Черновик / в работе"}
                        </p>
                      </div>
                    </Td>
                    <Td>
                      <div>
                        <p className="text-sm text-slate-700">Сотрудники: {protocol.employees.length}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {protocol.employees
                            .slice(0, 3)
                            .map((employee) => employee.fullName)
                            .join(", ")}
                          {protocol.employees.length > 3 ? "..." : ""}
                        </p>
                      </div>
                    </Td>
                    <Td>{protocol.department?.name ?? "Не назначено"}</Td>
                    <Td>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{protocol.protocolType}</p>
                        <p className="mt-1 text-xs text-slate-500">{protocol.basis}</p>
                      </div>
                    </Td>
                    <Td>{formatDate(protocol.date)}</Td>
                    <Td>
                      <StatusBadge value={protocol.status} />
                    </Td>
                    <Td>{protocol.canonicalStatus ? <StatusBadge value={protocol.canonicalStatus} /> : "Не привязано"}</Td>
                    <Td>
                      <div className="space-y-1 text-xs text-slate-500">
                        <p>{protocol.evidenceAvailable ? "Доказательства доступны" : "Пакет доказательств пока отсутствует"}</p>
                        <p>
                          {protocol.archiveRecordSummary
                            ? `${protocol.archiveRecordSummary.status} • ${protocol.archiveRecordSummary.retentionCode}`
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
