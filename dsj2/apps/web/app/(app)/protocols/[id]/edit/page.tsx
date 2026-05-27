import Link from "next/link";
import { Card, CardContent, CardHeader, PageHeader } from "@dsj/ui";
import { updateProtocolAction } from "@/actions/protocol";
import { ProtocolDraftForm } from "@/components/protocol-draft-form";
import { apiFetch } from "@/lib/api";
import { requireRoleAccess } from "@/lib/auth";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === "string" && value.length ? value : null;
}

export default async function EditProtocolPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  await requireRoleAccess(["COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const { id } = await params;
  const rawSearchParams = await searchParams;
  const errorMessage = firstString(rawSearchParams.error);
  const companyId = firstString(rawSearchParams.companyId);

  const protocol = await apiFetch<{
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
    allowedActions: {
      canEditDraft: boolean;
    };
  }>(`protocols/${id}`);
  const effectiveCompanyId = companyId ?? protocol.organizationId;
  const scopedQuery = effectiveCompanyId ? `?companyId=${effectiveCompanyId}` : "";
  const [employees, departments, workSites] = await Promise.all([
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
  ]);
  const chairman = protocol.commission.find((member) => member.role === "CHAIRMAN") ?? null;
  const members = protocol.commission.filter((member) => member.role === "MEMBER");

  if (!protocol.allowedActions.canEditDraft) {
    return (
      <div className="space-y-6">
        <PageHeader>
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Редактор черновика</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">Редактирование черновика заблокировано</h1>
          </div>
        </PageHeader>

        <Card className="rounded-[24px]">
          <CardContent className="space-y-4 p-6">
            <p className="text-sm text-slate-600">
              Подписанные или конечные протоколы нельзя редактировать напрямую. Используйте замену
              или аннулирование на карточке протокола.
            </p>
            <Link
              href={effectiveCompanyId ? `/protocols/${id}?companyId=${effectiveCompanyId}` : `/protocols/${id}`}
              className="inline-flex rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50"
            >
              Назад к протоколу
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Редактор черновика</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Редактировать черновик протокола</h1>
          <p className="mt-2 text-sm text-slate-500">
            Редактируются только черновые редакции. Каноническая версия обновляется при каждом
            сохранении.
          </p>
        </div>
      </PageHeader>

      <Card className="rounded-[24px]">
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">Черновик протокола</h2>
        </CardHeader>
        <CardContent>
          <ProtocolDraftForm
            action={updateProtocolAction}
            hiddenFields={[
              { name: "protocolId", value: protocol.id },
              { name: "companyId", value: effectiveCompanyId },
            ]}
            employees={employees}
            departments={departments}
            workSites={workSites}
            initialValues={{
              number: protocol.number,
              date: protocol.date,
              protocolType: protocol.protocolType,
              basis: protocol.basis,
              departmentId: protocol.departmentId,
              workSiteId: protocol.workSiteId,
              decision: protocol.decision,
              notes: protocol.notes,
              employeeIds: protocol.employees.map((employee) => employee.employeeId),
              chairman,
              members,
            }}
            submitLabel="Сохранить черновик"
            pendingLabel="Сохранение черновика..."
          />
        </CardContent>
      </Card>
    </div>
  );
}
