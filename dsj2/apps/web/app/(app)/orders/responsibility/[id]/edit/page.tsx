import Link from "next/link";
import { Card, CardContent, CardHeader, PageHeader } from "@dsj/ui";
import { updateResponsibilityOrderAction } from "@/actions/responsibility-order";
import { ResponsibilityOrderDraftForm } from "@/components/responsibility-order-draft-form";
import { apiFetch } from "@/lib/api";
import { requireRoleAccess } from "@/lib/auth";
import { buildWorkSitesManageHref } from "@/lib/safe-return-path";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === "string" && value.length ? value : null;
}

export default async function EditResponsibilityOrderPage({
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

  const order = await apiFetch<{
    id: string;
    organizationId: string;
    number: string;
    date: string;
    responsibilityType: string;
    title: string;
    basis: string;
    branchId: string | null;
    departmentId: string | null;
    workSiteId: string | null;
    notes: string | null;
    appointments: Array<{
      employeeId: string;
      effectiveFrom: string;
      effectiveTo?: string | null;
      zoneOfResponsibility?: string | null;
      roleNotes?: string | null;
    }>;
    allowedActions: {
      canEditDraft: boolean;
    };
  }>(`responsibility-orders/${id}`);
  const effectiveCompanyId = companyId ?? order.organizationId;
  const scopedQuery = effectiveCompanyId ? `?companyId=${effectiveCompanyId}` : "";
  const [employees, branches, departments, workSites] = await Promise.all([
    apiFetch<
      Array<{
        id: string;
        fullName: string;
        employeeNumber: string;
        employeeKind: string;
        jobTitle: string;
        department?: { name: string } | null;
      }>
    >(`employees${scopedQuery}`),
    apiFetch<Array<{ id: string; code?: string | null; name: string }>>(`core-platform/branches${scopedQuery}`),
    apiFetch<Array<{ id: string; name: string }>>(`departments${scopedQuery}`),
    apiFetch<Array<{ id: string; name: string; location: string | null }>>(`core-platform/work-sites${scopedQuery}`),
  ]);

  if (!order.allowedActions.canEditDraft) {
    return (
      <div className="space-y-6">
        <PageHeader>
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Редактор черновика</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">Редактирование черновика заблокировано</h1>
          </div>
        </PageHeader>

        <Card>
          <CardContent className="space-y-4 p-6">
            <p className="text-sm text-slate-600">
              Подписанные или конечные приказы о назначении нельзя редактировать напрямую. Используйте
              замену или аннулирование на карточке приказа.
            </p>
            <Link
              href={effectiveCompanyId ? `/orders/responsibility/${id}?companyId=${effectiveCompanyId}` : `/orders/responsibility/${id}`}
              className="inline-flex rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50"
            >
              Назад к приказу
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Редактор черновика</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Редактировать приказ о назначении</h1>
          <p className="mt-2 text-sm text-slate-500">
            Редактируются только черновые редакции. Подписанный приказ остаётся неизменяемым в
            канонической цепочке.
          </p>
        </div>
      </PageHeader>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">Черновик приказа о назначении</h2>
        </CardHeader>
        <CardContent>
          <ResponsibilityOrderDraftForm
            action={updateResponsibilityOrderAction}
            hiddenFields={[
              { name: "orderId", value: order.id },
              { name: "companyId", value: effectiveCompanyId },
            ]}
            employees={employees}
            branches={branches}
            departments={departments}
            workSites={workSites}
            workSitesManageHref={buildWorkSitesManageHref(
              effectiveCompanyId,
              `/orders/responsibility/${order.id}/edit${scopedQuery}`,
            )}
            initialValues={{
              number: order.number,
              date: order.date,
              responsibilityType: order.responsibilityType,
              title: order.title,
              basis: order.basis,
              branchId: order.branchId,
              departmentId: order.departmentId,
              workSiteId: order.workSiteId,
              notes: order.notes,
              appointments: order.appointments,
            }}
            submitLabel="Сохранить черновик"
            pendingLabel="Сохранение черновика..."
          />
        </CardContent>
      </Card>
    </div>
  );
}
