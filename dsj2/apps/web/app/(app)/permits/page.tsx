import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Table,
  TableWrapper,
  Td,
  Th,
} from "@dsj/ui";
import { formatDateTime } from "@dsj/utils";
import { Plus } from "lucide-react";
import { CompanySwitcher } from "@/components/company-switcher";
import { StatusBadge } from "@/components/status-badge";
import { getDemoPersonaForEmail } from "@/lib/demo-personas";
import { requireRoleAccess } from "@/lib/auth";
import { resolveCompanyContext } from "@/lib/company-context";
import { fetchPermitFormOptions, fetchPermits } from "@/lib/permit-queries";
import {
  getEffectivePermitStatus,
  getPermitEntry,
  getPermitStatusLabel,
  getPermitTypeLabel,
  getPermitWorkTypeLabel,
  mvpPermitTypeOptions,
  mvpPermitWorkTypeOptions,
  permitStatusLabels,
} from "@/lib/permits";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return typeof value === "string" ? value : "";
}

export default async function PermitsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireRoleAccess(["SUPER_ADMIN", "COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const params = await searchParams;
  const errorMessage = firstString(params.error);
  const successMessage = firstString(params.success);
  const { companies, activeCompanyId } = await resolveCompanyContext({
    session,
    pathname: "/permits",
    searchParams: params,
  });
  const persona = getDemoPersonaForEmail(session.user.email);
  const isReadOnly = persona?.key === "director";
  const [permits, options] = activeCompanyId
    ? await Promise.all([fetchPermits(activeCompanyId), fetchPermitFormOptions(activeCompanyId)])
    : [[], { employees: [], departments: [], workSites: [], contractors: [] }];
  const filteredPermits = permits.filter((permit) => {
    const entry = getPermitEntry(permit);
    const status = getEffectivePermitStatus(permit);
    const permitType = firstString(params.permitType);
    const workType = firstString(params.workType);
    const statusFilter = firstString(params.status);
    const departmentId = firstString(params.departmentId);
    const contractorId = firstString(params.contractorId);
    const dateFrom = firstString(params.dateFrom);
    const dateTo = firstString(params.dateTo);
    const missingOnly = firstString(params.missingOnly) === "1";
    const activeOnly = firstString(params.activeOnly) === "1";
    const archivedOnly = firstString(params.archivedOnly) === "1";

    if (permitType && entry?.permitType !== permitType) return false;
    if (workType && entry?.workType !== workType) return false;
    if (statusFilter && status !== statusFilter) return false;
    if (departmentId && entry?.departmentId !== departmentId && permit.departmentId !== departmentId) return false;
    if (contractorId && entry?.contractorId !== contractorId) return false;
    if (dateFrom && entry?.endAt && entry.endAt < dateFrom) return false;
    if (dateTo && entry?.startAt && entry.startAt > dateTo) return false;
    if (missingOnly && entry?.precheckSummary?.result !== "FAIL") return false;
    if (activeOnly && status !== "active") return false;
    if (archivedOnly && status !== "archived") return false;
    return true;
  });

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
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">PermitJournal</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Журнал допусков и нарядов</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Контролируемый lifecycle допуска: precheck документов, согласование, подписи,
            активация, закрытие, архив и evidence.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <CompanySwitcher
            pathname="/permits"
            companies={companies}
            activeCompanyId={activeCompanyId}
            searchParams={params}
          />
          {!isReadOnly ? (
            <Link
              href={activeCompanyId ? `/permits/new?companyId=${activeCompanyId}` : "/permits/new"}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--surface-strong)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--surface-strong-hover)]"
            >
              <Plus className="h-4 w-4" />
              Создать допуск
            </Link>
          ) : null}
        </div>
      </PageHeader>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">Фильтры</h2>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-[repeat(7,minmax(0,1fr))_auto]">
            <input type="hidden" name="companyId" value={activeCompanyId ?? ""} />
            <Select name="permitType" defaultValue={firstString(params.permitType)}>
              <option value="">Все типы</option>
              {mvpPermitTypeOptions.map((value) => (
                <option key={value} value={value}>{getPermitTypeLabel(value)}</option>
              ))}
            </Select>
            <Select name="workType" defaultValue={firstString(params.workType)}>
              <option value="">Все виды работ</option>
              {mvpPermitWorkTypeOptions.map((value) => (
                <option key={value} value={value}>{getPermitWorkTypeLabel(value)}</option>
              ))}
            </Select>
            <Select name="status" defaultValue={firstString(params.status)}>
              <option value="">Все статусы</option>
              {Object.entries(permitStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
            <Select name="departmentId" defaultValue={firstString(params.departmentId)}>
              <option value="">Все подразделения</option>
              {options.departments.map((department) => (
                <option key={department.id} value={department.id}>{department.label}</option>
              ))}
            </Select>
            <Select name="contractorId" defaultValue={firstString(params.contractorId)}>
              <option value="">Все подрядчики</option>
              {options.contractors.map((contractor) => (
                <option key={contractor.id} value={contractor.id}>{contractor.label}</option>
              ))}
            </Select>
            <Input name="dateFrom" type="date" defaultValue={firstString(params.dateFrom)} />
            <Input name="dateTo" type="date" defaultValue={firstString(params.dateTo)} />
            <button className="rounded-md bg-[var(--surface-strong)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--surface-strong-hover)]">
              Применить
            </button>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="missingOnly" value="1" defaultChecked={firstString(params.missingOnly) === "1"} />
              Только с недостающими документами
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="activeOnly" value="1" defaultChecked={firstString(params.activeOnly) === "1"} />
              Только активные
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="archivedOnly" value="1" defaultChecked={firstString(params.archivedOnly) === "1"} />
              Только архивные
            </label>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">Допуски</h2>
        </CardHeader>
        <CardContent className="p-0">
          {activeCompanyId && filteredPermits.length ? (
            <TableWrapper className="border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>№ записи</Th>
                    <Th>№ наряда-допуска</Th>
                    <Th>Тип / вид работ</Th>
                    <Th>Место / подразделение</Th>
                    <Th>Сроки</Th>
                    <Th>Статус</Th>
                    <Th>Проверки</Th>
                    <Th>Подписи / архив</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPermits.map((permit) => {
                    const entry = getPermitEntry(permit);
                    const status = getEffectivePermitStatus(permit);
                    const query = activeCompanyId ? `?companyId=${activeCompanyId}` : "";

                    return (
                      <tr key={permit.id} className="border-t border-slate-100">
                        <Td>{entry?.journalRegistrationNumber ?? "—"}</Td>
                        <Td>
                          <Link href={`/permits/${permit.id}${query}`} className="font-medium text-slate-900">
                            {entry?.permitNumber ?? permit.permitCode}
                          </Link>
                          <p className="mt-1 text-xs text-slate-500">{permit.id}</p>
                        </Td>
                        <Td>
                          <p className="text-sm font-medium text-slate-900">{getPermitTypeLabel(entry?.permitType)}</p>
                          <p className="mt-1 text-xs text-slate-500">{getPermitWorkTypeLabel(entry?.workType)}</p>
                        </Td>
                        <Td>
                          <p className="text-sm text-slate-700">{entry?.workplace ?? "—"}</p>
                          <p className="mt-1 text-xs text-slate-500">{entry?.departmentId ?? permit.departmentId ?? "Без подразделения"}</p>
                        </Td>
                        <Td>
                          <p className="text-sm text-slate-700">{entry?.startAt ? formatDateTime(entry.startAt) : "—"}</p>
                          <p className="mt-1 text-xs text-slate-500">{entry?.endAt ? formatDateTime(entry.endAt) : "—"}</p>
                        </Td>
                        <Td>
                          <StatusBadge value={status} />
                          <p className="mt-1 text-xs text-slate-500">{getPermitStatusLabel(status)}</p>
                        </Td>
                        <Td>
                          <StatusBadge value={entry?.precheckSummary?.result === "PASS" ? "active" : entry?.precheckSummary?.result === "FAIL" ? "blocked" : "draft"} />
                          <p className="mt-1 text-xs text-slate-500">
                            {entry?.precheckSummary?.checkedAt ? formatDateTime(entry.precheckSummary.checkedAt) : "не запускался"}
                          </p>
                        </Td>
                        <Td>
                          <p className="text-xs text-slate-500">
                            {permit.currentVersion?.documentEnvelopeId ? "Evidence подготовлен" : "Evidence не подготовлен"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {entry?.retentionUntil ? `Хранить до ${entry.retentionUntil}` : "Архив не запечатан"}
                          </p>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrapper>
          ) : (
            <EmptyState className="min-h-32 justify-center text-left">
              {activeCompanyId
                ? "Допуски пока не созданы или не подходят под фильтры."
                : "Сначала выберите компанию."}
            </EmptyState>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
