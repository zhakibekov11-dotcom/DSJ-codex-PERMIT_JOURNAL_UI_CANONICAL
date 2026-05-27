import { Card, CardContent, CardHeader, PageHeader } from "@dsj/ui";
import { formatDateTime } from "@dsj/utils";
import { CompanySwitcher } from "../../../components/company-switcher";
import { apiFetch } from "../../../lib/api";
import { requireRoleAccess } from "../../../lib/auth";
import { resolveCompanyContext } from "../../../lib/company-context";
import { getAuditActionLabel, getEntityTypeLabel } from "../../../lib/labels";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireRoleAccess(["COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const params = await searchParams;
  const { companies, activeCompanyId } = await resolveCompanyContext({
    session,
    pathname: "/audit",
    searchParams: params,
  });
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
  >(`audit-logs?limit=50${activeCompanyId ? `&companyId=${activeCompanyId}` : ""}`);

  return (
    <div className="space-y-6">
      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Контур доказательств</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Журнал аудита</h1>
          <p className="mt-2 text-sm text-slate-500">
            Критичные действия в журнале, события подписания и административные изменения.
          </p>
        </div>
        <CompanySwitcher
          pathname="/audit"
          companies={companies}
          activeCompanyId={activeCompanyId}
          searchParams={params}
        />
      </PageHeader>

      <Card className="rounded-[24px]">
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">Последние события</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{getAuditActionLabel(log.action)}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {log.actorUser?.fullName ?? "Система"} • {getEntityTypeLabel(log.entityType)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{log.entityId}</p>
                </div>
                <p className="text-xs text-slate-400">{formatDateTime(log.createdAt)}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
