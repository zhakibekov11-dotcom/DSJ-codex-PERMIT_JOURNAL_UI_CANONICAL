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
import { StatusBadge } from "@/components/status-badge";
import { apiFetch } from "@/lib/api";
import { requireRoleAccess } from "@/lib/auth";
import { documentTypeLabels } from "@/lib/labels";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type MyEmployeeDocument = {
  id: string;
  title: string;
  documentType: string;
  issueDate: string;
  expiryDate: string | null;
  status: string;
  issuerName: string;
  verificationStatus: string;
  canonicalStatus?: string | null;
  documentEnvelopeStatus?: string | null;
  isSigned?: boolean;
  signedAt?: string | null;
  evidenceAvailable?: boolean;
  documentEnvelopeId?: string | null;
  allowedActions?: {
    canPrepareSign: boolean;
    canSign: boolean;
    canAnnul: boolean;
    canReplace: boolean;
    canDownloadEvidence: boolean;
  };
  trainingAssignment?: {
    id: string;
    trainingProgram: {
      title: string;
    };
  } | null;
};

export default async function MyDocumentsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRoleAccess(["EMPLOYEE_SIGNER"]);
  const params = await searchParams;
  const errorMessage = typeof params.error === "string" ? params.error : null;
  const documents = await apiFetch<MyEmployeeDocument[]>("employee-documents/my");

  const signedCount = documents.filter((document) => document.isSigned).length;
  const readyCount = documents.filter((document) => document.allowedActions?.canSign).length;
  const expiredCount = documents.filter((document) => document.status === "EXPIRED").length;

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Кабинет сотрудника</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Мои документы</h1>
          <p className="mt-2 text-sm text-slate-500">
            Проверьте срок действия документа, статус подписи и наличие доказательств.
          </p>
        </div>
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-4">
        {[
          { label: "Всего", value: documents.length },
          { label: "Подписано", value: signedCount },
          { label: "Готово к подписанию", value: readyCount },
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
          <h2 className="text-lg font-semibold text-slate-950">Реестр документов</h2>
        </CardHeader>
        <CardContent className="p-0">
          {documents.length ? (
            <TableWrapper className="border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Документ</Th>
                    <Th>Срок действия</Th>
                    <Th>Подписание</Th>
                    <Th>Доказательства</Th>
                    <Th>Действие</Th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => (
                    <tr key={document.id} className="border-t border-slate-100 align-top">
                      <Td>
                        <div className="space-y-1">
                          <p className="font-medium text-slate-900">{document.title}</p>
                          <p className="text-xs text-slate-500">
                            {documentTypeLabels[document.documentType] ?? document.documentType}
                          </p>
                          <p className="text-xs text-slate-500">
                            {document.trainingAssignment?.trainingProgram.title ??
                              "Ручной документ сотрудника"}
                          </p>
                        </div>
                      </Td>
                      <Td>
                        <div className="space-y-1 text-sm text-slate-700">
                          <p>Выдан: {formatDate(document.issueDate)}</p>
                          <p>
                            Истекает: {document.expiryDate ? formatDate(document.expiryDate) : "без срока"}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <StatusBadge value={document.status} />
                            <StatusBadge value={document.verificationStatus} />
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <div className="space-y-1 text-sm text-slate-700">
                          <p>Канонический: {document.canonicalStatus ?? "не привязано"}</p>
                          {document.documentEnvelopeStatus ? (
                            <StatusBadge value={document.documentEnvelopeStatus} />
                          ) : null}
                          <p>Подписан: {document.isSigned ? "да" : "нет"}</p>
                          <p className="text-xs text-slate-500">
                            {document.signedAt
                              ? formatDateTime(document.signedAt)
                              : document.allowedActions?.canSign
                                ? "Подготовлен и ожидает вашей подписи"
                                : "Ещё не подписан"}
                          </p>
                        </div>
                      </Td>
                      <Td>
                        <div className="flex flex-col gap-2">
                          <a
                            href={`/api/documents/${document.id}/download`}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700"
                          >
                            PDF
                          </a>
                          {document.allowedActions?.canDownloadEvidence && document.documentEnvelopeId ? (
                            <a
                              href={`/api/document-envelopes/${document.documentEnvelopeId}/evidence-package`}
                              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700"
                            >
                              Пакет доказательств
                            </a>
                          ) : null}
                        </div>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/my-documents/${document.id}`}
                            className="inline-flex rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
                          >
                            Открыть
                          </Link>
                          {document.allowedActions?.canSign ? (
                            <Link
                              href={`/my-documents/${document.id}`}
                              className="inline-flex rounded-xl border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                            >
                              Подписать
                            </Link>
                          ) : null}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrapper>
          ) : (
            <div className="p-6">
              <EmptyState>Документы сотрудников пока отсутствуют.</EmptyState>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
