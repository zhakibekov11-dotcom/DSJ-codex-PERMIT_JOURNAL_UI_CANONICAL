import { Card, CardContent, CardHeader, PageHeader } from "@dsj/ui";
import { createOrReplaceProtocolAction } from "@/actions/protocol";
import { CompanySwitcher } from "@/components/company-switcher";
import { ProtocolDraftForm } from "@/components/protocol-draft-form";
import { apiFetch } from "@/lib/api";
import { requireRoleAccess } from "@/lib/auth";
import { resolveCompanyContext } from "@/lib/company-context";
import { buildWorkSitesManageHref } from "@/lib/safe-return-path";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === "string" && value.length ? value : null;
}

export default async function NewProtocolPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireRoleAccess(["COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const params = await searchParams;
  const errorMessage = firstString(params.error);
  const replaceProtocolId = firstString(params.replaceProtocolId);
  const { companies, activeCompanyId } = await resolveCompanyContext({
    session,
    pathname: "/protocols/new",
    searchParams: params,
  });
  const effectiveCompanyId = activeCompanyId ?? session.user.companyId ?? null;
  const scopedQuery = effectiveCompanyId ? `?companyId=${effectiveCompanyId}` : "";

  const [employees, departments, workSites, replacementSource] = await Promise.all([
    apiFetch<
      Array<{
        id: string;
        fullName: string;
        employeeNumber: string;
        employeeKind: string;
        contractorCompany?: { name: string } | null;
      }>
    >(`employees${scopedQuery}`),
    apiFetch<Array<{ id: string; name: string }>>(`departments${scopedQuery}`),
    apiFetch<Array<{ id: string; name: string; location: string | null }>>(`core-platform/work-sites${scopedQuery}`),
    replaceProtocolId
      ? apiFetch<{
          id: string;
          organizationId: string;
          number: string;
          date: string;
          protocolType: string;
          basis: string;
          departmentId: string | null;
          workSiteId: string | null;
          decision: string;
          notes: string | null;
          employees: Array<{ employeeId: string }>;
          commission: Array<{
            role: "CHAIRMAN" | "MEMBER";
            fullName: string;
            jobTitle?: string | null;
          }>;
        }>(`protocols/${replaceProtocolId}`)
      : Promise.resolve(null),
  ]);

  const chairman = replacementSource?.commission.find((member) => member.role === "CHAIRMAN") ?? null;
  const members = replacementSource?.commission.filter((member) => member.role === "MEMBER") ?? [];
  const returnParams = new URLSearchParams();
  if (effectiveCompanyId) returnParams.set("companyId", effectiveCompanyId);
  if (replaceProtocolId) returnParams.set("replaceProtocolId", replaceProtocolId);
  const workSitesManageHref = buildWorkSitesManageHref(
    effectiveCompanyId,
    `/protocols/new${returnParams.toString() ? `?${returnParams.toString()}` : ""}`,
  );

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
            {replaceProtocolId ? "Черновик замены" : "Черновик протокола"}
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            {replaceProtocolId ? "Создать протокол-замену" : "Создать черновик протокола"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Протоколы являются полноценными документами комиссии. Подписанные редакции становятся
            неизменяемыми и должны изменяться только через замену или аннулирование.
          </p>
        </div>
        <CompanySwitcher
          pathname="/protocols/new"
          companies={companies}
          activeCompanyId={effectiveCompanyId}
          searchParams={params}
        />
      </PageHeader>

      {replacementSource ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Подписанный протокол <span className="font-medium">{replacementSource.number}</span> заблокирован.
          Эта форма создаёт новый черновик-редакцию вместо редактирования исходного подписанного
          документа.
        </div>
      ) : null}

      <Card className="rounded-[24px]">
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">Черновик протокола</h2>
        </CardHeader>
        <CardContent>
          <ProtocolDraftForm
            action={createOrReplaceProtocolAction}
            hiddenFields={[
              { name: "companyId", value: effectiveCompanyId },
              { name: "replaceProtocolId", value: replaceProtocolId },
            ]}
            employees={employees}
            departments={departments}
            workSites={workSites}
            workSitesManageHref={workSitesManageHref}
            initialValues={
              replacementSource
                ? {
                    number: replacementSource.number,
                    date: replacementSource.date,
                    protocolType: replacementSource.protocolType,
                    basis: replacementSource.basis,
                    departmentId: replacementSource.departmentId,
                    workSiteId: replacementSource.workSiteId,
                    decision: replacementSource.decision,
                    notes: replacementSource.notes,
                    employeeIds: replacementSource.employees.map((employee) => employee.employeeId),
                    chairman,
                    members,
                    reason: "Подписанный протокол заменяется исправленной редакцией.",
                  }
                : undefined
            }
            replacementMode={Boolean(replacementSource)}
            submitLabel={replacementSource ? "Создать черновик замены" : "Создать черновик"}
            pendingLabel={replacementSource ? "Создание черновика замены..." : "Создание черновика..."}
          />
        </CardContent>
      </Card>
    </div>
  );
}
