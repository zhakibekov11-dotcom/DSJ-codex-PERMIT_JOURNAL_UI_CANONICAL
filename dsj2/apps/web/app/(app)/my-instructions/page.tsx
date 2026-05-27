import Link from "next/link";
import type { MyBriefingInstruction } from "@dsj/types";
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
import { StatusBadge } from "@/components/status-badge";
import { apiFetch } from "@/lib/api";
import { requireRoleAccess } from "@/lib/auth";
import {
  briefingJournalKindLabels,
  briefingTypeLabels,
  getBriefingSignerRoleLabel,
  getResponsibilityTypeLabel,
  statusLabels,
} from "@/lib/labels";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function hasEmployeeSignature(record: MyBriefingInstruction) {
  return record.pendingSigners.some(
    (signer) => signer.role === "BRIEFED_EMPLOYEE" && signer.status === "SIGNED",
  );
}

function hasInstructorSignature(record: MyBriefingInstruction) {
  return record.pendingSigners.some(
    (signer) => signer.role === "BRIEFING_INSTRUCTOR" && signer.status === "SIGNED",
  );
}

function isTerminal(record: MyBriefingInstruction) {
  return (
    record.status === "SIGNED" ||
    record.status === "ANNULLED" ||
    record.status === "SUPERSEDED" ||
    record.status === "ARCHIVED"
  );
}

function progressLabel(record: MyBriefingInstruction) {
  const instructorSigned = hasInstructorSignature(record);
  const employeeSigned = hasEmployeeSignature(record);

  if (instructorSigned && employeeSigned) {
    return "полностью подписано";
  }

  if (instructorSigned && !employeeSigned) {
    return "ожидается подпись сотрудника";
  }

  if (!instructorSigned && employeeSigned) {
    return "ожидается подпись инструктора";
  }

  return "ожидание инструктора";
}

export default async function MyInstructionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRoleAccess(["EMPLOYEE_SIGNER"]);
  const params = await searchParams;
  const errorMessage = typeof params.error === "string" ? params.error : null;
  const [records, responsibilityOrders] = await Promise.all([
    apiFetch<MyBriefingInstruction[]>("briefing-records/my"),
    apiFetch<
      Array<{
        id: string;
        number: string;
        date: string;
        responsibilityType: string;
        title: string;
        basis: string;
        status: string;
        documentEnvelopeId: string | null;
        signedAt: string | null;
        evidenceAvailable: boolean;
        archiveRecordSummary?: {
          id: string;
          status: string;
          retentionCode: string;
        } | null;
        branch?: { name: string } | null;
        department?: { name: string } | null;
        workSite?: { name: string; location?: string | null } | null;
        appointments: Array<{
          effectiveFrom: string;
          effectiveTo?: string | null;
          derivedStatus: string;
        }>;
      }>
    >("responsibility-orders/my"),
  ]);

  const pendingRecords = records.filter((record) => !isTerminal(record));
  const signedRecords = records.filter((record) => record.status === "SIGNED");
  const archivedRecords = signedRecords.filter((record) => record.archiveRecordSummary);
  const actionRequiredRecords = records.filter((record) => record.allowedActions.canEmployeeSign);
  const historyRecords = records.filter((record) => isTerminal(record));
  const activeResponsibilityOrders = responsibilityOrders.filter((order) => order.status === "ACTIVE");
  const otherResponsibilityOrders = responsibilityOrders.filter((order) => order.status !== "ACTIVE");

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Самообслуживание</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Мои инструктажи</h1>
          <p className="mt-2 text-sm text-slate-500">
            Ожидающие подписи записи инструктажей и подписанные записи из канонического реестра.
          </p>
        </div>
      </PageHeader>

      <Card>
        <CardContent className="grid gap-0 p-0 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Всего", value: records.length },
            { label: "Требуют подписи", value: actionRequiredRecords.length },
            { label: "Подписано", value: signedRecords.length },
            { label: "С архивом", value: archivedRecords.length },
          ].map((metric) => (
            <div
              key={metric.label}
              className="border-b border-slate-200 p-5 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0"
            >
              <p className="text-sm text-slate-600">{metric.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{metric.value}</p>
            </div>
          ))}
          <div className="border-b border-slate-200 p-5 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0">
            <p className="text-sm text-slate-600">Приказы</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{responsibilityOrders.length}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">Приказы о назначении ответственных</h2>
        </CardHeader>
        <CardContent className="p-0">
          {responsibilityOrders.length ? (
            <TableWrapper className="border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Приказ</Th>
                    <Th>Ответственность</Th>
                    <Th>Область / период</Th>
                    <Th>Доказательства / архив</Th>
                    <Th>Статус</Th>
                    <Th>Скачать</Th>
                  </tr>
                </thead>
                <tbody>
                  {[...activeResponsibilityOrders, ...otherResponsibilityOrders].map((order) => {
                    const appointment = order.appointments[0] ?? null;

                    return (
                      <tr key={order.id} className="border-t border-slate-100">
                        <Td>
                          <div>
                            <p className="font-medium text-slate-900">{order.number}</p>
                            <p className="mt-1 text-xs text-slate-500">{order.title}</p>
                            <p className="mt-1 text-xs text-slate-400">{order.basis}</p>
                          </div>
                        </Td>
                        <Td>
                          <div>
                            <p>{getResponsibilityTypeLabel(order.responsibilityType)}</p>
                            <p className="mt-1 text-xs text-slate-400">
                              {order.branch?.name ?? "На уровне организации"}
                              {order.department?.name ? ` • ${order.department.name}` : ""}
                              {order.workSite?.name ? ` • ${order.workSite.name}` : ""}
                            </p>
                          </div>
                        </Td>
                        <Td>
                          <div>
                            <p>{formatDate(order.date)}</p>
                            {appointment ? (
                              <p className="mt-1 text-xs text-slate-400">
                                {formatDate(appointment.effectiveFrom)}
                                {appointment.effectiveTo ? ` → ${formatDate(appointment.effectiveTo)}` : " → без срока"}
                              </p>
                            ) : null}
                          </div>
                        </Td>
                        <Td>
                          <div className="space-y-1 text-xs text-slate-500">
                            <p>Доказательства: {order.evidenceAvailable ? "доступны" : "ожидают"}</p>
                            <p>
                              Архив:{" "}
                              {order.archiveRecordSummary
                                ? `${order.archiveRecordSummary.status} / ${order.archiveRecordSummary.retentionCode}`
                                : "не запечатан"}
                            </p>
                          </div>
                        </Td>
                        <Td>
                          <div className="space-y-1">
                            <StatusBadge value={order.status} />
                            {appointment ? <StatusBadge value={appointment.derivedStatus} /> : null}
                          </div>
                        </Td>
                        <Td>
                          <div className="flex flex-col gap-2">
                            <a
                              href={`/api/responsibility-orders/${order.id}/download`}
                              className="inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50"
                            >
                              PDF
                            </a>
                            {order.evidenceAvailable && order.documentEnvelopeId ? (
                              <a
                                href={`/api/document-envelopes/${order.documentEnvelopeId}/evidence-package`}
                                className="inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50"
                              >
                                Доказательства
                              </a>
                            ) : null}
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrapper>
          ) : (
            <div className="p-6">
              <EmptyState>Нет относящихся к вам приказов по ответственным лицам.</EmptyState>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">Ожидают завершения</h2>
        </CardHeader>
        <CardContent className="p-0">
          {pendingRecords.length ? (
            <TableWrapper className="border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Инструктаж</Th>
                    <Th>Журнал / тип</Th>
                    <Th>Дата</Th>
                    <Th>Подписи</Th>
                    <Th>Статус</Th>
                    <Th>Действие</Th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRecords.map((record) => (
                    <tr key={record.id} className="border-t border-slate-100">
                      <Td>
                        <div>
                          <p className="font-medium text-slate-900">
                            {record.registrationNo ?? `Черновик №${record.id.slice(0, 8)}`}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">{record.topic}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            Инструктор: {record.instructor.fullName}
                            {record.department?.name ? ` / ${record.department.name}` : ""}
                            {record.workSite?.name ? ` / ${record.workSite.name}` : ""}
                          </p>
                        </div>
                      </Td>
                      <Td>
                        <div>
                          <p>{briefingJournalKindLabels[record.journalKind] ?? record.journalKind}</p>
                          <p className="text-xs text-slate-400">
                            {briefingTypeLabels[record.briefingType] ?? record.briefingType}
                          </p>
                        </div>
                      </Td>
                      <Td>{formatDate(record.briefingDate)}</Td>
                      <Td>
                        <div className="space-y-1 text-xs text-slate-500">
                          <p>{progressLabel(record)}</p>
                          {record.pendingSigners.map((signer) => (
                            <p key={signer.role}>
                              {getBriefingSignerRoleLabel(signer.role)}: {statusLabels[signer.status] ?? signer.status}
                            </p>
                          ))}
                        </div>
                      </Td>
                      <Td>
                        <StatusBadge value={record.status} />
                      </Td>
                      <Td>
                        <Link
                          href={`/my-instructions/${record.id}`}
                          className={
                            record.allowedActions.canEmployeeSign
                              ? "inline-flex rounded-md bg-[var(--surface-strong)] px-3 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--surface-strong-hover)]"
                              : "inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50"
                          }
                        >
                          {record.allowedActions.canEmployeeSign ? "Подписать" : "Открыть"}
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrapper>
          ) : (
            <div className="p-6">
              <EmptyState>Сейчас нет инструктажей, ожидающих вашего действия.</EmptyState>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">Подписанные и закрытые</h2>
        </CardHeader>
        <CardContent className="p-0">
          {historyRecords.length ? (
            <TableWrapper className="border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Инструктаж</Th>
                    <Th>Дата</Th>
                    <Th>Доказательства / архив</Th>
                    <Th>Статус</Th>
                    <Th>Открыть</Th>
                  </tr>
                </thead>
                <tbody>
                  {historyRecords.map((record) => (
                    <tr key={record.id} className="border-t border-slate-100">
                      <Td>
                        <div>
                          <p className="font-medium text-slate-900">
                            {record.registrationNo ?? `Запись №${record.id.slice(0, 8)}`}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">{record.topic}</p>
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
                          <p>Доказательства: {record.evidenceAvailable ? "доступны" : "ожидают"}</p>
                          <p>
                            Архив:{" "}
                            {record.archiveRecordSummary
                              ? `${record.archiveRecordSummary.status} / ${record.archiveRecordSummary.retentionCode}`
                              : "не запечатан"}
                          </p>
                        </div>
                      </Td>
                      <Td>
                        <StatusBadge value={record.status} />
                      </Td>
                      <Td>
                        <Link
                          href={`/my-instructions/${record.id}`}
                          className="inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50"
                        >
                          Открыть
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrapper>
          ) : (
            <div className="p-6">
              <EmptyState>История появится после первого подписанного инструктажа.</EmptyState>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
