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
import { createWorkSiteAction } from "@/actions/work-site";
import { CompanySwitcher } from "@/components/company-switcher";
import { SubmitButton } from "@/components/submit-button";
import { apiFetch } from "@/lib/api";
import { requireRoleAccess } from "@/lib/auth";
import { resolveCompanyContext } from "@/lib/company-context";
import { normalizeSafeReturnPath } from "@/lib/safe-return-path";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function WorkSitesPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireRoleAccess(["SUPER_ADMIN", "COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const params = await searchParams;
  const errorMessage = typeof params.error === "string" ? params.error : null;
  const returnTo = normalizeSafeReturnPath(params.returnTo);
  const { companies, activeCompanyId } = await resolveCompanyContext({
    session,
    pathname: "/work-sites",
    searchParams: params,
  });
  const effectiveCompanyId = activeCompanyId ?? session.user.companyId ?? null;
  const scopedQuery = effectiveCompanyId ? `?companyId=${effectiveCompanyId}` : "";
  const [workSites, branches] = await Promise.all([
    apiFetch<
      Array<{
        id: string;
        branchId: string | null;
        code: string;
        name: string;
        location: string | null;
        isActive: boolean;
      }>
    >(`core-platform/work-sites${scopedQuery}`),
    apiFetch<Array<{ id: string; code: string; name: string }>>(
      `core-platform/branches${scopedQuery}`,
    ),
  ]);
  const branchesById = new Map(branches.map((branch) => [branch.id, branch]));

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Структура компании</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Рабочие площадки</h1>
          <p className="mt-2 text-sm text-slate-500">
            Канонический справочник объектов для протоколов, приказов и нарядов-допусков.
          </p>
        </div>
        <CompanySwitcher
          pathname="/work-sites"
          companies={companies}
          activeCompanyId={effectiveCompanyId}
          searchParams={params}
        />
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-[24px]">
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">Справочник площадок</h2>
          </CardHeader>
          <CardContent className="p-0">
            <TableWrapper className="border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Код</Th>
                    <Th>Название</Th>
                    <Th>Местоположение</Th>
                    <Th>Филиал</Th>
                    <Th>Статус</Th>
                  </tr>
                </thead>
                <tbody>
                  {workSites.map((workSite) => {
                    const branch = workSite.branchId
                      ? branchesById.get(workSite.branchId)
                      : null;

                    return (
                      <tr key={workSite.id} className="border-t border-slate-100">
                        <Td>{workSite.code}</Td>
                        <Td className="font-medium text-slate-900">{workSite.name}</Td>
                        <Td>{workSite.location ?? "—"}</Td>
                        <Td>{branch ? `${branch.code} • ${branch.name}` : "Организация"}</Td>
                        <Td>{workSite.isActive ? "Активна" : "Неактивна"}</Td>
                      </tr>
                    );
                  })}
                  {!workSites.length ? (
                    <tr className="border-t border-slate-100">
                      <td colSpan={5} className="px-4 py-6 text-sm text-slate-500">
                        Площадки ещё не созданы.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>

        <Card className="rounded-[24px]">
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">Создать площадку</h2>
          </CardHeader>
          <CardContent>
            <form action={createWorkSiteAction} className="space-y-4">
              <input type="hidden" name="companyId" value={effectiveCompanyId ?? ""} />
              {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Код</label>
                <Input name="code" placeholder="WEST-14" minLength={2} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Название</label>
                <Input name="name" placeholder="Площадка Запад-14" minLength={2} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Местоположение</label>
                <Input name="location" placeholder="Атырауская область" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Филиал</label>
                <Select name="branchId" defaultValue="">
                  <option value="">Без филиала</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.code} • {branch.name}
                    </option>
                  ))}
                </Select>
              </div>
              <SubmitButton
                label={returnTo ? "Создать и вернуться" : "Создать площадку"}
                pendingLabel="Создание..."
              />
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
