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
import { formatDate } from "@dsj/utils";
import { StatusBadge } from "@/components/status-badge";
import { apiFetch } from "@/lib/api";
import { requireRoleAccess } from "@/lib/auth";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MyCertificatesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRoleAccess(["EMPLOYEE_SIGNER"]);
  const params = await searchParams;
  const errorMessage = typeof params.error === "string" ? params.error : null;
  const certificates = await apiFetch<
    Array<{
      id: string;
      certificateNumber: string;
      issueDate: string;
      expiryDate: string;
      issuerName: string;
      status: string;
      trainingAssignment?: {
        id: string;
        trainingProgram: {
          title: string;
        };
      } | null;
      employee: {
        fullName: string;
      };
    }>
  >("safety-certificates/my");

  const activeCount = certificates.filter((certificate) => certificate.status === "ACTIVE").length;
  const expiringCount = certificates.filter((certificate) => certificate.status === "EXPIRING_SOON").length;
  const expiredCount = certificates.filter((certificate) => certificate.status === "EXPIRED").length;

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Личный кабинет</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Удостоверения по ТБ</h1>
          <p className="mt-2 text-sm text-slate-500">
            Здесь отображаются ваши действующие и архивные удостоверения, связанные с охраной труда и безопасностью.
          </p>
        </div>
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-4">
        {[
          { label: "Всего удостоверений", value: certificates.length },
          { label: "Действует", value: activeCount },
          { label: "Скоро истекает", value: expiringCount },
          { label: "Истекло", value: expiredCount },
        ].map((metric) => (
          <Card key={metric.label} className="rounded-[24px]">
            <CardContent className="space-y-2 p-6">
              <p className="text-sm text-slate-500">{metric.label}</p>
              <p className="text-3xl font-semibold text-slate-950">{metric.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-[24px]">
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">Список удостоверений</h2>
        </CardHeader>
        <CardContent className="p-0">
          {certificates.length ? (
            <TableWrapper className="border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Удостоверение</Th>
                    <Th>Дата выдачи</Th>
                    <Th>Срок действия</Th>
                    <Th>Организация</Th>
                    <Th>Статус</Th>
                    <Th>Действие</Th>
                  </tr>
                </thead>
                <tbody>
                  {certificates.map((certificate) => (
                    <tr key={certificate.id} className="border-t border-slate-100">
                      <Td>
                        <div>
                          <p className="font-medium text-slate-900">{certificate.certificateNumber}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {certificate.trainingAssignment?.trainingProgram.title ?? certificate.employee.fullName}
                          </p>
                        </div>
                      </Td>
                      <Td>{formatDate(certificate.issueDate)}</Td>
                      <Td>{formatDate(certificate.expiryDate)}</Td>
                      <Td>{certificate.issuerName}</Td>
                      <Td>
                        <StatusBadge value={certificate.status} />
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/my-certificates/${certificate.id}`}
                            className="inline-flex rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
                          >
                            Открыть
                          </Link>
                          <a
                            href={`/api/certificates/${certificate.id}/download`}
                            className="inline-flex rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
                          >
                            Скачать
                          </a>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrapper>
          ) : (
            <div className="p-6">
              <EmptyState>Удостоверения появятся после завершения обучения или добавления администратором.</EmptyState>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
