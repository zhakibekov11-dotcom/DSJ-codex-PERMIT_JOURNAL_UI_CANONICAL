import { Card, CardContent, CardHeader, PageHeader } from "@dsj/ui";
import { formatDateTime } from "@dsj/utils";
import { PermitWorkflowNav } from "@/components/permit-summary";
import { apiFetch } from "@/lib/api";
import { requireRoleAccess } from "@/lib/auth";
import { getAuditActionLabel } from "@/lib/labels";
import { fetchPermit } from "@/lib/permit-queries";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" && value.length ? value : null;
}

export default async function PermitAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  await requireRoleAccess(["SUPER_ADMIN", "COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const { id } = await params;
  const rawSearchParams = await searchParams;
  const companyId = firstString(rawSearchParams.companyId);
  const permit = await fetchPermit(id);
  const logs = await apiFetch<
    Array<{
      id: string;
      action: string;
      entityType: string;
      entityId: string;
      createdAt: string;
      metadata?: Record<string, unknown> | null;
      actorUser?: { fullName: string } | null;
    }>
  >(`audit-logs?limit=100&entityType=WorkPermit&companyId=${companyId ?? permit.organizationId}`);
  const permitLogs = logs.filter((log) => log.entityId === permit.id);

  return (
    <div className="space-y-6">
      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Журнал действий</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">{permit.permitCode}</h1>
          <p className="mt-2 text-sm text-slate-500">
            Lifecycle transitions фиксируются в audit trail.
          </p>
        </div>
        <PermitWorkflowNav permitId={permit.id} companyId={companyId ?? permit.organizationId} />
      </PageHeader>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">События допуска</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          {permitLogs.length ? (
            permitLogs.map((log) => (
              <div key={log.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{getAuditActionLabel(log.action)}</p>
                    <p className="mt-1 text-sm text-slate-500">{log.actorUser?.fullName ?? "Система"}</p>
                    {log.metadata ? (
                      <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-500">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-400">{formatDateTime(log.createdAt)}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
              События audit для этого допуска пока не найдены.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
