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
import { Download, Plus } from "lucide-react";
import { CompanySwitcher } from "@/components/company-switcher";
import { StatusBadge } from "@/components/status-badge";
import { getDemoPersonaForEmail } from "@/lib/demo-personas";
import { requireRoleAccess } from "@/lib/auth";
import { resolveCompanyContext } from "@/lib/company-context";
import { fetchPermitFormOptions, fetchPermitPage } from "@/lib/permit-queries";
import {
  getPermitJournalRow,
  getPermitStatusLabel,
  getPermitWorkTypeLabel,
  mvpPermitWorkTypeOptions,
  permitStatusLabels,
} from "@/lib/permits";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return typeof value === "string" ? value : "";
}

function displayDateTime(value: string | null | undefined) {
  return value ? formatDateTime(value) : "Не применимо";
}

function displayText(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : "Не указано";
}

function exportHref(
  format: "csv" | "pdf",
  companyId: string | null,
  params: Record<string, string | string[] | undefined>,
) {
  const exportParams = new URLSearchParams();
  if (companyId) exportParams.set("organizationId", companyId);
  for (const [key, rawValue] of Object.entries(params)) {
    if (key === "companyId" || key === "page") continue;
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    if (value) exportParams.set(key, value);
  }
  exportParams.set("pageSize", "100");
  const query = exportParams.toString();
  return `/api/permits/journal.${format}${query ? `?${query}` : ""}`;
}

export default async function PermitsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireRoleAccess([
    "SUPER_ADMIN",
    "COMPANY_ADMIN",
    "SAFETY_ENGINEER",
    "EMPLOYEE_SIGNER",
  ]);
  const params = await searchParams;
  const errorMessage = firstString(params.error);
  const successMessage = firstString(params.success);
  const { companies, activeCompanyId } = await resolveCompanyContext({
    session,
    pathname: "/permits",
    searchParams: params,
  });
  const persona = getDemoPersonaForEmail(session.user.email);
  const isReadOnly =
    persona?.key === "director" || session.user.role === "EMPLOYEE_SIGNER";
  const emptyOptions = {
    employees: [],
    contractorWorkers: [],
    departments: [],
    workSites: [],
    contractors: [],
    contractorAccessActs: [],
    trainingEvidence: [],
    briefingEvidence: [],
    certificateEvidence: [],
    medicalEvidence: [],
    requiredDocuments: [],
    ppeIssues: [],
  };
  const [permitPage, options] = activeCompanyId
    ? await Promise.all([
        fetchPermitPage(activeCompanyId, params),
        isReadOnly
          ? Promise.resolve(emptyOptions)
          : fetchPermitFormOptions(activeCompanyId),
      ])
    : [{ items: [], total: 0, page: 1, pageSize: 25 }, emptyOptions];
  const permits = permitPage.items;
  const csvHref = exportHref("csv", activeCompanyId, params);
  const pdfHref = exportHref("pdf", activeCompanyId, params);

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
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
            Appendix 2
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            Журнал нарядов-допусков
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Учет выдачи нарядов-допусков по Приказу МТСЗН РК №344: регистрация,
            первичный допуск, статус, срок действия, закрытие и архив.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <CompanySwitcher
            pathname="/permits"
            companies={companies}
            activeCompanyId={activeCompanyId}
            searchParams={params}
          />
          <div className="flex flex-wrap gap-2">
            {activeCompanyId ? (
              <Link
                href={csvHref}
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                CSV
              </Link>
            ) : null}
            {activeCompanyId ? (
              <Link
                href={pdfHref}
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Appendix 2 PDF
              </Link>
            ) : null}
            {!isReadOnly ? (
              <Link
                href={
                  activeCompanyId
                    ? `/permits/contractor-access-acts?companyId=${activeCompanyId}`
                    : "/permits/contractor-access-acts"
                }
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Appendix 3
              </Link>
            ) : null}
            {!isReadOnly ? (
              <Link
                href={
                  activeCompanyId
                    ? `/permits/new?companyId=${activeCompanyId}`
                    : "/permits/new"
                }
                className="inline-flex items-center gap-2 rounded-md bg-[var(--surface-strong)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--surface-strong-hover)]"
              >
                <Plus className="h-4 w-4" />
                Создать наряд-допуск
              </Link>
            ) : null}
          </div>
        </div>
      </PageHeader>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">Фильтры</h2>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-[repeat(6,minmax(0,1fr))_auto]">
            <input
              type="hidden"
              name="companyId"
              value={activeCompanyId ?? ""}
            />
            <Select name="workType" defaultValue={firstString(params.workType)}>
              <option value="">Все виды работ</option>
              {mvpPermitWorkTypeOptions.map((value) => (
                <option key={value} value={value}>
                  {getPermitWorkTypeLabel(value)}
                </option>
              ))}
            </Select>
            <Select name="status" defaultValue={firstString(params.status)}>
              <option value="">Все статусы</option>
              {Object.entries(permitStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              name="contractorId"
              defaultValue={firstString(params.contractorId)}
            >
              <option value="">Все подрядчики</option>
              {options.contractors.map((contractor) => (
                <option key={contractor.id} value={contractor.id}>
                  {contractor.label}
                </option>
              ))}
            </Select>
            <Input
              name="dateFrom"
              type="date"
              defaultValue={firstString(params.dateFrom)}
            />
            <Input
              name="dateTo"
              type="date"
              defaultValue={firstString(params.dateTo)}
            />
            <div className="flex flex-col gap-2 text-sm text-slate-700">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="activeOnly"
                  value="1"
                  defaultChecked={firstString(params.activeOnly) === "1"}
                />
                Только активные
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="archivedOnly"
                  value="1"
                  defaultChecked={firstString(params.archivedOnly) === "1"}
                />
                Только архив
              </label>
            </div>
            <button className="rounded-md bg-[var(--surface-strong)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--surface-strong-hover)]">
              Применить
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">
            Журнал учета выдачи
          </h2>
        </CardHeader>
        <CardContent className="p-0">
          {activeCompanyId && permits.length ? (
            <TableWrapper className="border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>№ записи</Th>
                    <Th>Первичный допуск</Th>
                    <Th>Повторный допуск</Th>
                    <Th>№ наряда</Th>
                    <Th>Выдавший</Th>
                    <Th>Характер работ</Th>
                    <Th>Место / вид</Th>
                    <Th>Статус</Th>
                    <Th>Срок / закрытие</Th>
                  </tr>
                </thead>
                <tbody>
                  {permits.map((permit) => {
                    const journal = getPermitJournalRow(permit);
                    const query = activeCompanyId
                      ? `?companyId=${activeCompanyId}`
                      : "";

                    return (
                      <tr key={permit.id} className="border-t border-slate-100">
                        <Td className="font-medium text-slate-950">
                          {journal.journalRegistrationNumber}
                        </Td>
                        <Td>{displayDateTime(journal.initialAdmissionAt)}</Td>
                        <Td>{displayDateTime(journal.repeatedAdmissionAt)}</Td>
                        <Td>
                          <Link
                            href={`/permits/${permit.id}${query}`}
                            className="font-medium text-slate-900 underline-offset-4 hover:underline"
                          >
                            {journal.permitNumber}
                          </Link>
                        </Td>
                        <Td>
                          <p className="text-sm text-slate-900">
                            {journal.issuer?.displayName ?? "Не назначен"}
                          </p>
                          {journal.issuer?.sublabel ? (
                            <p className="mt-1 text-xs text-slate-500">
                              {journal.issuer.sublabel}
                            </p>
                          ) : null}
                        </Td>
                        <Td className="max-w-72">
                          <p className="line-clamp-3 text-sm text-slate-700">
                            {journal.workDescription}
                          </p>
                        </Td>
                        <Td>
                          <p className="text-sm text-slate-700">
                            {displayText(journal.workplace)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {getPermitWorkTypeLabel(journal.workType)}
                          </p>
                          {journal.contractor ? (
                            <p className="mt-1 text-xs text-slate-500">
                              {journal.contractor.displayName}
                            </p>
                          ) : null}
                        </Td>
                        <Td>
                          <StatusBadge value={journal.status} />
                          <p className="mt-1 text-xs text-slate-500">
                            {getPermitStatusLabel(journal.status)}
                          </p>
                        </Td>
                        <Td>
                          <p className="text-sm text-slate-700">
                            {displayDateTime(journal.validUntil)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Закрыт: {displayDateTime(journal.closedAt)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Архив:{" "}
                            {journal.archivedAt
                              ? displayDateTime(journal.archivedAt)
                              : "не передан"}
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
              {activeCompanyId ? (
                <div className="space-y-2">
                  <p>No permit journal rows match the current filters.</p>
                  {!isReadOnly ? (
                    <p>
                      Start with an{" "}
                      <Link
                        href={`/permits/contractor-access-acts?companyId=${activeCompanyId}`}
                        className="font-medium underline"
                      >
                        Appendix 3 contractor access act
                      </Link>{" "}
                      when contractor access is required, or{" "}
                      <Link
                        href={`/permits/new?companyId=${activeCompanyId}`}
                        className="font-medium underline"
                      >
                        create a permit draft
                      </Link>
                      .
                    </p>
                  ) : null}
                </div>
              ) : (
                "Select a company to open its permit journal."
              )}
            </EmptyState>
          )}
          {activeCompanyId && permitPage.total > permitPage.pageSize ? (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
              <span>
                Страница {permitPage.page}, всего записей: {permitPage.total}
              </span>
              <div className="flex gap-2">
                {permitPage.page > 1 ? (
                  <Link
                    href={{
                      pathname: "/permits",
                      query: { ...params, page: permitPage.page - 1 },
                    }}
                    className="rounded border border-slate-200 px-3 py-1.5"
                  >
                    Назад
                  </Link>
                ) : null}
                {permitPage.page * permitPage.pageSize < permitPage.total ? (
                  <Link
                    href={{
                      pathname: "/permits",
                      query: { ...params, page: permitPage.page + 1 },
                    }}
                    className="rounded border border-slate-200 px-3 py-1.5"
                  >
                    Далее
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
