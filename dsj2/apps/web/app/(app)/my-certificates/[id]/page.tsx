import Link from "next/link";
import { Card, CardContent, CardHeader, PageHeader } from "@dsj/ui";
import { formatDate } from "@dsj/utils";
import { StatusBadge } from "@/components/status-badge";
import { apiFetch } from "@/lib/api";
import { requireRoleAccess } from "@/lib/auth";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MyCertificateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  await requireRoleAccess(["EMPLOYEE_SIGNER"]);
  const { id } = await params;
  const rawSearchParams = await searchParams;
  const errorMessage = typeof rawSearchParams.error === "string" ? rawSearchParams.error : null;
  const certificate = await apiFetch<{
    id: string;
    certificateNumber: string;
    issueDate: string;
    expiryDate: string;
    issuerName: string;
    status: string;
    employee: {
      fullName: string;
      employeeNumber: string;
      jobTitle: string;
    };
    trainingAssignment?: {
      id: string;
      trainingProgram: {
        title: string;
      };
    } | null;
    document?: {
      id: string;
      title: string;
    } | null;
  }>(`safety-certificates/${id}`);

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Удостоверение по ТБ</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">{certificate.certificateNumber}</h1>
          <p className="mt-2 text-sm text-slate-500">Личная выгрузка удостоверения сотрудника</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href={`/api/certificates/${certificate.id}/download`}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
          >
            Скачать PDF
          </a>
          <Link
            href="/my-certificates"
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
          >
            Назад к списку
          </Link>
        </div>
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-[24px]">
          <CardHeader className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950">Сводка удостоверения</h2>
            <StatusBadge value={certificate.status} />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              <p>Номер удостоверения: {certificate.certificateNumber}</p>
              <p className="mt-2">Дата выдачи: {formatDate(certificate.issueDate)}</p>
              <p className="mt-2">Срок действия: {formatDate(certificate.expiryDate)}</p>
              <p className="mt-2">Организация-эмитент: {certificate.issuerName}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Сотрудник</p>
              <p className="mt-2">{certificate.employee.fullName}</p>
              <p className="mt-1">{certificate.employee.employeeNumber}</p>
              <p className="mt-1">{certificate.employee.jobTitle}</p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-[24px]">
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">Основание выдачи</h2>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p>{certificate.trainingAssignment?.trainingProgram.title ?? "Удостоверение добавлено вручную."}</p>
              </div>
              {certificate.document ? (
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Связанный документ</p>
                  <p className="mt-2">{certificate.document.title}</p>
                  <Link
                    href={`/my-documents/${certificate.document.id}`}
                    className="mt-3 inline-flex text-sm font-medium text-slate-700 underline underline-offset-4"
                  >
                    Открыть документ
                  </Link>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
