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
  permitReferencesContractor,
} from "@/lib/permits";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type ContractorCompany = {
  id: string;
  name: string;
  bin: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  isActive: boolean;
};

export default async function ContractorAccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const session = await requireRoleAccess(["SUPER_ADMIN", "COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const { id } = await params;
  const rawSearchParams = await searchParams;
  const { companies, activeCompanyId } = await resolveCompanyContext({
    session,
    pathname: `/contractors/${id}/access`,
    searchParams: rawSearchParams,
  });
  const scopedQuery = activeCompanyId ? `?companyId=${activeCompanyId}` : "";
  const [contractors, permits] = activeCompanyId
    ? await Promise.all([
        apiFetch<ContractorCompany[]>(`contractor-companies${scopedQuery}`),
        fetchPermits(activeCompanyId),
      ])
    : [[], []];
  const contractor = contractors.find((item) => item.id === id) ?? null;
  const contractorPermits = permits.filter((permit) => permitReferencesContractor(permit, id));

  return (
    <div className="space-y-6">
      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Contractor access</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            {contractor?.name ?? "Допуски подрядчика"}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Реестр PermitEntry, где подрядчик указан как участник допуска или акта-допуска.
          </p>
          {contractor ? (
            <p className="mt-2 text-sm text-slate-500">
              БИН: {contractor.bin ?? "не задан"} · {contractor.isActive ? "активен" : "неактивен"}
            </p>
          ) : null}
        </div>
        <CompanySwitcher
          pathname={`/contractors/${id}/access`}
          companies={companies}
          activeCompanyId={activeCompanyId}
          searchParams={rawSearchParams}
        />
      </PageHeader>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">Допуски подрядчика</h2>
        </CardHeader>
        <CardContent className="p-0">
          {contractorPermits.length ? (
            <TableWrapper className="border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Номер допуска</Th>
                    <Th>Тип / вид работ</Th>
                    <Th>Место работ</Th>
                    <Th>Сроки</Th>
                    <Th>Статус</Th>
                    <Th>Evidence</Th>
                  </tr>
                </thead>
                <tbody>
                  {contractorPermits.map((permit) => {
                    const entry = getPermitEntry(permit);
                    const status = getEffectivePermitStatus(permit);
                    const query = activeCompanyId ? `?companyId=${activeCompanyId}` : "";

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
                        <Td>{entry?.workplace ?? permit.workSite?.name ?? "не задано"}</Td>
                        <Td>
                          <p className="text-sm text-slate-700">{entry?.startAt ? formatDateTime(entry.startAt) : "не задано"}</p>
                          <p className="mt-1 text-xs text-slate-500">{entry?.endAt ? formatDateTime(entry.endAt) : "не задано"}</p>
                        </Td>
                        <Td>
                          <StatusBadge value={status} />
                        </Td>
                        <Td>
                          {permit.currentVersion?.documentEnvelopeId
                            ? "evidence подготовлен"
                            : "evidence не подготовлен"}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrapper>
          ) : (
            <EmptyState className="min-h-32 justify-center text-left">
              Для этого подрядчика пока нет связанных допусков.
            </EmptyState>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
