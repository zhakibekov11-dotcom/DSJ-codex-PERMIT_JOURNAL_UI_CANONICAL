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
import { formatDate, formatDateTime } from "@dsj/utils";
import {
  Activity,
  FileSignature,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import { apiFetch } from "../../../lib/api";
import { requireRoleAccess } from "../../../lib/auth";
import { resolveCompanyContext } from "../../../lib/company-context";
import { StatusBadge } from "../../../components/status-badge";
import { CompanySwitcher } from "../../../components/company-switcher";
import {
  demoPersonas,
  getDemoPersonaForEmail,
} from "../../../lib/demo-personas";
import {
  briefingTypeLabels,
  getAuditActionLabel,
  getEntityTypeLabel,
  getNotificationTypeLabel,
} from "../../../lib/labels";

const icons = [UsersRound, FileSignature, Activity, TriangleAlert];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireRoleAccess(["COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const params = await searchParams;
  const { companies, activeCompanyId } = await resolveCompanyContext({
    session,
    pathname: "/dashboard",
    searchParams: params,
  });
  const scopedQuery = activeCompanyId ? `?companyId=${activeCompanyId}` : "";
  const currentDemoPersona = getDemoPersonaForEmail(session.user.email);
  const isReadOnlyPersona = currentDemoPersona?.readOnly === true;

  const [summary, auditLogs, notifications] = await Promise.all([
    apiFetch<{
      metrics: Array<{
        label: string;
        value: number;
        deltaLabel: string;
        tone: string;
      }>;
      recentBriefings: Array<{
        id: string;
        documentNumber: string | null;
        briefingType: string;
        briefingDate: string;
        status: string;
        employee: { fullName: string };
      }>;
    }>(`dashboard/summary${scopedQuery}`),
    apiFetch<
      Array<{
        id: string;
        action: string;
        entityType: string;
        entityId: string;
        createdAt: string;
        actorUser?: { fullName: string } | null;
      }>
    >(
      `audit-logs?limit=6${activeCompanyId ? `&companyId=${activeCompanyId}` : ""}`,
    ),
    apiFetch<
      Array<{
        id: string;
        status: string;
        type: string;
        scheduledAt: string;
        payload?: { title?: string; message?: string } | null;
      }>
    >(`notifications/jobs${scopedQuery}`),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader>
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold text-slate-950">
            Дашборд соответствия
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Контроль готовности к подписанию, просроченных повторных
            инструктажей и последних событий аудита.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {currentDemoPersona ? null : (
            <CompanySwitcher
              pathname="/dashboard"
              companies={companies}
              activeCompanyId={activeCompanyId}
              searchParams={params}
            />
          )}
          <div className="flex gap-3">
            {isReadOnlyPersona ? null : (
              <Link
                href={
                  activeCompanyId
                    ? `/journal/new?companyId=${activeCompanyId}`
                    : "/journal/new"
                }
                className="rounded-md bg-[var(--surface-strong)] px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--surface-strong-hover)]"
              >
                Новый инструктаж
              </Link>
            )}
            <Link
              href={
                activeCompanyId
                  ? `/journal?companyId=${activeCompanyId}`
                  : "/journal"
              }
              className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50"
            >
              Открыть журнал
            </Link>
          </div>
        </div>
      </PageHeader>

      <Card>
        <CardContent className="grid gap-0 p-0 sm:grid-cols-2 xl:grid-cols-4">
          {summary.metrics.map((metric, index) => {
            const Icon = icons[index] ?? Activity;

            return (
              <div
                key={metric.label}
                className="border-b border-slate-200 p-5 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600">{metric.label}</p>
                    <div>
                      <p className="text-2xl font-semibold text-slate-950">
                        {metric.value}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {metric.deltaLabel}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-600">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Демо-персоны и иерархия
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Компания Stroy Company 2030: отдел ОТ и ПБ, буровой цех,
                механический участок, должности и карточки сотрудников.
              </p>
            </div>
            {currentDemoPersona ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                Сейчас: {currentDemoPersona.title}.{" "}
                {currentDemoPersona.modeLabel}
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {demoPersonas.map((persona) => (
            <div
              key={persona.email}
              className="rounded-md border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-slate-950">{persona.title}</p>
                <code className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-600">
                  {persona.destination}
                </code>
              </div>
              <p className="mt-2 text-xs text-slate-500">{persona.email}</p>
              <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                {persona.scopeLabel}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                {persona.summary}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">
              Последние записи инструктажа
            </h2>
          </CardHeader>
          <CardContent className="p-0">
            {summary.recentBriefings.length ? (
              <TableWrapper className="border-0">
                <Table>
                  <thead>
                    <tr>
                      <Th>Документ</Th>
                      <Th>Сотрудник</Th>
                      <Th>Тип</Th>
                      <Th>Дата</Th>
                      <Th>Статус</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recentBriefings.map((record) => (
                      <tr key={record.id} className="border-t border-slate-100">
                        <Td>
                          <Link
                            href={
                              activeCompanyId
                                ? `/journal/${record.id}?companyId=${activeCompanyId}`
                                : `/journal/${record.id}`
                            }
                            className="font-medium text-slate-900"
                          >
                            {record.documentNumber ?? "Черновик"}
                          </Link>
                        </Td>
                        <Td>{record.employee.fullName}</Td>
                        <Td>
                          {briefingTypeLabels[record.briefingType] ??
                            record.briefingType}
                        </Td>
                        <Td>{formatDate(record.briefingDate)}</Td>
                        <Td>
                          <StatusBadge value={record.status} />
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrapper>
            ) : (
              <div className="p-6">
                <EmptyState>
                  В выбранном контуре нет записей инструктажа.
                </EmptyState>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">
                Очередь напоминаний
              </h2>
            </CardHeader>
            <CardContent className="space-y-3">
              {notifications.length ? (
                notifications.slice(0, 5).map((notification) => (
                  <div
                    key={notification.id}
                    className="rounded-md border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-900">
                        {notification.payload?.title ??
                          getNotificationTypeLabel(notification.type)}
                      </p>
                      <StatusBadge value={notification.status} />
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      {notification.payload?.message ??
                        "Ожидает отправки уведомления."}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      Запланировано: {formatDateTime(notification.scheduledAt)}
                    </p>
                  </div>
                ))
              ) : (
                <EmptyState>Нет ожидающих уведомлений.</EmptyState>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">
                Последние события аудита
              </h2>
            </CardHeader>
            <CardContent className="space-y-3">
              {auditLogs.length ? (
                auditLogs.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-md border border-slate-200 p-4"
                  >
                    <p className="text-sm font-medium text-slate-900">
                      {getAuditActionLabel(entry.action)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {entry.actorUser?.fullName ?? "Система"} •{" "}
                      {getEntityTypeLabel(entry.entityType)}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      {formatDateTime(entry.createdAt)}
                    </p>
                  </div>
                ))
              ) : (
                <EmptyState>Событий аудита пока нет.</EmptyState>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
