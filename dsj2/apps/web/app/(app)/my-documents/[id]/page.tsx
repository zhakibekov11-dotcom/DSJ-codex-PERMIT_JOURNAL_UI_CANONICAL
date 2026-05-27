import Link from "next/link";
import { Card, CardContent, CardHeader, PageHeader } from "@dsj/ui";
import { formatDate, formatDateTime } from "@dsj/utils";
import { signMyEmployeeDocumentAction } from "@/actions/my-documents";
import { SigningForm } from "@/components/signing-form";
import { StatusBadge } from "@/components/status-badge";
import { apiFetch } from "@/lib/api";
import { requireRoleAccess } from "@/lib/auth";
import { documentTypeLabels } from "@/lib/labels";
import { getSigningConfig } from "@/lib/signing-config";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type EmployeeDocumentDetail = {
  id: string;
  title: string;
  documentNumber?: string | null;
  documentType: string;
  issueDate: string;
  expiryDate: string | null;
  status: string;
  issuerName: string;
  verificationStatus: string;
  canonicalStatus?: string | null;
  documentEnvelopeId?: string | null;
  documentEnvelopeStatus?: string | null;
  signingDigest?: string | null;
  isSigned?: boolean;
  signedAt?: string | null;
  evidenceAvailable?: boolean;
  latestSignature?: {
    id: string;
    provider: string;
    status: string;
    signerName: string;
    signerIinMasked: string;
    certificateSerial: string;
    signedAt?: string | null;
    verifiedAt?: string | null;
    verificationResult?: "PASS" | "FAIL" | null;
    chainStatus?: string | null;
    revocationStatus?: string | null;
    signatureHash?: string | null;
  } | null;
  archiveRecordSummary?: {
    id: string;
    status: string;
    sealedAt?: string | null;
    archivedAt?: string | null;
    disposalEligibleAt?: string | null;
    storageUri?: string | null;
    retentionCode: string;
    retentionSource: "configured" | "baseline";
  } | null;
  allowedActions?: {
    canPrepareSign: boolean;
    canSign: boolean;
    canAnnul: boolean;
    canReplace: boolean;
    canDownloadEvidence: boolean;
  };
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
  linkedSafetyCertificate?: {
    id: string;
    certificateNumber: string;
  } | null;
};

export default async function MyDocumentDetailPage({
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
  const document = await apiFetch<EmployeeDocumentDetail>(`employee-documents/${id}`);
  const signingConfig = getSigningConfig();

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Документ сотрудника</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">{document.title}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {documentTypeLabels[document.documentType] ?? document.documentType}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href={`/api/documents/${document.id}/download`}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
          >
            Скачать PDF
          </a>
          <Link
            href="/my-documents"
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
          >
            Назад к реестру
          </Link>
        </div>
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-[24px]">
          <CardHeader className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950">Сводка по документу</h2>
            <div className="flex flex-wrap gap-2">
              <StatusBadge value={document.status} />
              <StatusBadge value={document.verificationStatus} />
              {document.documentEnvelopeStatus ? (
                <StatusBadge value={document.documentEnvelopeStatus} />
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              <p>Вид: {documentTypeLabels[document.documentType] ?? document.documentType}</p>
              <p className="mt-2">Дата выдачи: {formatDate(document.issueDate)}</p>
              <p className="mt-2">
                Срок действия: {document.expiryDate ? formatDate(document.expiryDate) : "не указан"}
              </p>
              <p className="mt-2">Выдавший: {document.issuerName}</p>
              <p className="mt-2">Канонический статус: {document.canonicalStatus ?? "не связан"}</p>
              <p className="mt-2">
                Подписан:{" "}
                {document.signedAt ? formatDateTime(document.signedAt) : document.isSigned ? "да" : "нет"}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Сотрудник</p>
              <p className="mt-2">{document.employee.fullName}</p>
              <p className="mt-1">{document.employee.employeeNumber}</p>
              <p className="mt-1">{document.employee.jobTitle}</p>
            </div>

            {document.latestSignature ? (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Последняя подпись</p>
                <p className="mt-2">{document.latestSignature.signerName}</p>
                <p className="mt-1">
                  {document.latestSignature.provider} • {document.latestSignature.status}
                </p>
                {document.latestSignature.verificationResult ? (
                  <p className="mt-1">
                    Проверка: {document.latestSignature.verificationResult}
                    {document.latestSignature.chainStatus
                      ? ` вЂў ${document.latestSignature.chainStatus}`
                      : ""}
                    {document.latestSignature.revocationStatus
                      ? ` вЂў ${document.latestSignature.revocationStatus}`
                      : ""}
                  </p>
                ) : null}
                <p className="mt-1">{document.latestSignature.certificateSerial}</p>
                <p className="mt-1">
                  {document.latestSignature.signedAt
                    ? formatDateTime(document.latestSignature.signedAt)
                    : "Дата подписи недоступна"}
                </p>
                {document.latestSignature.verifiedAt ? (
                  <p className="mt-1">
                    Проверено в: {formatDateTime(document.latestSignature.verifiedAt)}
                  </p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-[24px]">
            <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">Доказательства и архив</h2>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">Пакет доказательств</p>
                <p className="mt-2">
                  {document.allowedActions?.canDownloadEvidence && document.documentEnvelopeId
                    ? "Канонический пакет доказательств доступен для скачивания."
                    : "Пакет доказательств пока недоступен."}
                </p>
                {document.allowedActions?.canDownloadEvidence && document.documentEnvelopeId ? (
                  <a
                    href={`/api/document-envelopes/${document.documentEnvelopeId}/evidence-package`}
                    className="mt-3 inline-flex text-sm font-medium text-slate-700 underline underline-offset-4"
                  >
                    Скачать пакет доказательств
                  </a>
                ) : null}
              </div>

              {document.archiveRecordSummary ? (
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Архивная запись</p>
                  <p className="mt-2">
                    {document.archiveRecordSummary.status} • {document.archiveRecordSummary.retentionCode}
                  </p>
                  <p className="mt-1">
                    Источник: {document.archiveRecordSummary.retentionSource}
                  </p>
                  <p className="mt-1">
                    Запечатано в:{" "}
                    {document.archiveRecordSummary.sealedAt
                      ? formatDateTime(document.archiveRecordSummary.sealedAt)
                      : "не запечатано"}
                  </p>
                </div>
              ) : null}

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">Источник</p>
                <p className="mt-2">
                  {document.trainingAssignment?.trainingProgram.title ??
                    "Ручная регистрация документа сотрудника"}
                </p>
                {document.linkedSafetyCertificate ? (
                  <Link
                    href={`/my-certificates/${document.linkedSafetyCertificate.id}`}
                    className="mt-3 inline-flex text-sm font-medium text-slate-700 underline underline-offset-4"
                  >
                    Открыть сертификат по охране труда
                  </Link>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {document.allowedActions?.canSign ? (
            signingConfig.isConfigured ? (
              <Card className="rounded-[24px]">
                <CardHeader>
                  <h2 className="text-lg font-semibold text-slate-950">Подписать документ</h2>
                </CardHeader>
                <CardContent>
                  <SigningForm
                    mode={signingConfig.provider}
                    action={signMyEmployeeDocumentAction}
                    hiddenFields={[{ name: "documentId", value: document.id }]}
                    digest={document.signingDigest ?? null}
                    bridgeUrl={signingConfig.bridgeUrl ?? "http://localhost"}
                    bridgeTimeoutMs={signingConfig.bridgeTimeoutMs}
                    bridgeContext={{
                      employeeDocumentId: document.id,
                      documentNumber: document.documentNumber ?? null,
                    }}
                    title="Самостоятельная подпись сотрудника"
                    description="Завершите канонический этап подписи для этого документа сотрудника."
                    submitLabel="Подписать документ"
                    pendingLabel="Подписание..."
                    mockHint="Включён режим mock. Сервер определит подписанта по вашей учетной записи сотрудника."
                    bridgeHint="Bridge NCALayer подпишет подготовленный дайджест и отправит результат в канонический поток подписи."
                    testMode={signingConfig.testMode}
                  />
                </CardContent>
              </Card>
            ) : (
              <Card className="rounded-[24px]">
                <CardHeader>
                  <h2 className="text-lg font-semibold text-slate-950">Подписать документ</h2>
                </CardHeader>
                <CardContent>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    Документ подготовлен к подписанию, но среда подписи в этом окружении не настроена.
                  </div>
                </CardContent>
              </Card>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
