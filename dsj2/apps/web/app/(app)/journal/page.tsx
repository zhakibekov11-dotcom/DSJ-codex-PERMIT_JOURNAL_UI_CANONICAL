import Link from "next/link";
import type { BriefingRegistryItem } from "@dsj/types";
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
import { formatDate, formatDateTime } from "@dsj/utils";
import { Download, Plus } from "lucide-react";
import { StatusBadge } from "../../../components/status-badge";
import { CompanySwitcher } from "../../../components/company-switcher";
import { apiFetch } from "../../../lib/api";
import { requireRoleAccess } from "../../../lib/auth";
import { resolveCompanyContext } from "../../../lib/company-context";
import { getDemoPersonaForEmail } from "../../../lib/demo-personas";
import {
  briefingJournalKindLabels,
  briefingTypeLabels,
  statusLabels,
} from "../../../lib/labels";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const statusOptions = [
  "DRAFT",
  "SIGNING_READY",
  "PARTIALLY_SIGNED",
  "SIGNED",
  "ANNULLED",
  "SUPERSEDED",
  "ARCHIVED",
];

const filterKeys = [
  "search",
  "journalKind",
  "briefingType",
  "employeeId",
  "instructorUserId",
  "departmentId",
  "status",
  "startDate",
  "endDate",
];

function firstString(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function JournalPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireRoleAccess(["COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const params = await searchParams;
  const { companies, activeCompanyId } = await resolveCompanyContext({
    session,
    pathname: "/journal",
    searchParams: params,
  });
  const currentDemoPersona = getDemoPersonaForEmail(session.user.email);
  const isReadOnlyPersona = currentDemoPersona?.readOnly === true;
  const isShopChiefPersona = currentDemoPersona?.key === "shop-chief";
  const scopedQuery = activeCompanyId ? `?companyId=${activeCompanyId}` : "";
  const query = new URLSearchParams();

  if (activeCompanyId) {
    query.set("companyId", activeCompanyId);
  }

  for (const key of filterKeys) {
    const value = firstString(params[key]);
    if (value) {
      query.set(key, value);
    }
  }

  const [records, departments, employees, users] = await Promise.all([
    apiFetch<BriefingRegistryItem[]>(
      `briefing-records${query.toString() ? `?${query.toString()}` : ""}`,
    ),
    apiFetch<Array<{ id: string; name: string }>>(`departments${scopedQuery}`),
    apiFetch<
      Array<{
        id: string;
        fullName: string;
        employeeNumber: string;
        department?: { name: string } | null;
        site?: { name: string } | null;
      }>
    >(`employees${scopedQuery}`),
    apiFetch<Array<{ id: string; fullName: string; role: string }>>(`users${scopedQuery}`),
  ]);
  const visibleRecords = isShopChiefPersona
    ? records.filter(
        (record) =>
          record.department?.name === currentDemoPersona?.scopeDepartmentName &&
          record.workSite?.name === currentDemoPersona?.scopeSiteName,
      )
    : records;
  const visibleEmployees = isShopChiefPersona
    ? employees.filter(
        (employee) =>
          employee.department?.name === currentDemoPersona?.scopeDepartmentName &&
          employee.site?.name === currentDemoPersona?.scopeSiteName,
      )
    : employees;

  return (
    <div className="space-y-6">
      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Канонический реестр</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Журнал инструктажей</h1>
          <p className="mt-2 text-sm text-slate-500">
            Реестр юридически значимых записей инструктажа с двойной подписью, доказательствами и
            архивной связкой.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {currentDemoPersona ? null : (
            <CompanySwitcher
              pathname="/journal"
              companies={companies}
              activeCompanyId={activeCompanyId}
              searchParams={params}
            />
          )}
          <div className="flex gap-3">
            <a
              href={`/api/journal/pdf${query.toString() ? `?${query.toString()}` : ""}`}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Выгрузить PDF
            </a>
            {isReadOnlyPersona ? null : (
              <Link
                href={activeCompanyId ? `/journal/new?companyId=${activeCompanyId}` : "/journal/new"}
                className="inline-flex items-center gap-2 rounded-md bg-[var(--surface-strong)] px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--surface-strong-hover)]"
              >
                <Plus className="h-4 w-4" />
                Новая запись
              </Link>
            )}
          </div>
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
          <h2 className="text-lg font-semibold text-slate-950">Фильтры реестра</h2>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-4 xl:grid-cols-[1.6fr_repeat(7,minmax(0,1fr))_auto]">
            <input type="hidden" name="companyId" value={activeCompanyId ?? ""} />
            <Input name="search" placeholder="Номер или тема" defaultValue={firstString(params.search)} />
            <Select name="journalKind" defaultValue={firstString(params.journalKind)}>
              <option value="">Все журналы</option>
              {Object.entries(briefingJournalKindLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select name="briefingType" defaultValue={firstString(params.briefingType)}>
              <option value="">Все типы</option>
              {Object.entries(briefingTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select name="employeeId" defaultValue={firstString(params.employeeId)}>
              <option value="">Все сотрудники</option>
              {visibleEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName} ({employee.employeeNumber})
                </option>
              ))}
            </Select>
            <Select name="instructorUserId" defaultValue={firstString(params.instructorUserId)}>
              <option value="">Все инструкторы</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName}
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
            <Input name="startDate" type="date" defaultValue={firstString(params.startDate)} />
            <Input name="endDate" type="date" defaultValue={firstString(params.endDate)} />
            <Select name="status" defaultValue={firstString(params.status)}>
              <option value="">Все статусы</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status] ?? status}
                </option>
              ))}
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
          <h2 className="text-lg font-semibold text-slate-950">Записи журнала</h2>
        </CardHeader>
        <CardContent className="p-0">
          <TableWrapper className="border-0">
            <Table>
              <thead>
                <tr>
                  <Th>Запись</Th>
                  <Th>Сотрудник</Th>
                  <Th>Инструктор</Th>
                  <Th>Журнал / тип</Th>
                  <Th>Дата</Th>
                  <Th>Доказательства / архив</Th>
                  <Th>Доступные действия</Th>
                  <Th>Статус</Th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map((record) => (
                  <tr key={record.id} className="border-t border-slate-100">
                    <Td>
                      <div>
                        <Link
                          href={activeCompanyId ? `/journal/${record.id}?companyId=${activeCompanyId}` : `/journal/${record.id}`}
                          className="font-medium text-slate-900 underline-offset-4 hover:underline"
                        >
                          {record.registrationNo ?? `Черновик №${record.id.slice(0, 8)}`}
                        </Link>
                        <p className="mt-1 text-xs text-slate-500">{record.topic}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {record.department?.name ?? "Без подразделения"}
                          {record.workSite?.name ? ` / ${record.workSite.name}` : ""}
                        </p>
                      </div>
                    </Td>
                    <Td>
                      <div>
                        <p>{record.employee.fullName}</p>
                        <p className="text-xs text-slate-400">
                          {record.employee.employeeNumber ?? "Без табельного"}
                        </p>
                      </div>
                    </Td>
                    <Td>{record.instructor.fullName}</Td>
                    <Td>
                      <div>
                        <p>{briefingJournalKindLabels[record.journalKind] ?? record.journalKind}</p>
                        <p className="text-xs text-slate-400">
                          {briefingTypeLabels[record.briefingType] ?? record.briefingType}
                        </p>
                      </div>
                    </Td>
                    <Td>
                      <div>
                        <p>{formatDate(record.briefingDate)}</p>
                        {record.finalSignedAt ? (
                          <p className="text-xs text-slate-400">
                            подписано {formatDateTime(record.finalSignedAt)}
                          </p>
                        ) : null}
                      </div>
                    </Td>
                    <Td>
                      <div className="space-y-1 text-xs text-slate-500">
                        <p>
                          Доказательства: {record.evidenceAvailable ? "доступны" : "ожидают"}
                        </p>
                        <p>
                          Архив:{" "}
                          {record.archiveRecordSummary
                            ? `${record.archiveRecordSummary.status} / ${record.archiveRecordSummary.retentionCode}`
                            : "не запечатан"}
                        </p>
                      </div>
                    </Td>
                    <Td>
                      <div className="space-y-1 text-xs text-slate-500">
                        <p>Черновик: {record.allowedActions.canEditDraft ? "доступен" : "нет"}</p>
                        <p>Подготовка: {record.allowedActions.canPrepareSign ? "доступна" : "нет"}</p>
                        <p>Подпись инструктора: {record.allowedActions.canInstructorSign ? "доступна" : "нет"}</p>
                      </div>
                    </Td>
                    <Td>
                      <StatusBadge value={record.status} />
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
