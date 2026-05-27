import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Table,
  TableWrapper,
  Td,
  Textarea,
  Th,
} from "@dsj/ui";
import { formatDate, formatDateTime } from "@dsj/utils";
import {
  annulEmployeeDocumentAction,
  createEmployeeComplianceDocumentAction,
  prepareEmployeeDocumentForSigningAction,
  recalculateEmployeeAdmissionAction,
  replaceEmployeeDocumentAction,
  verifyEmployeeDocumentAction,
} from "../../../../actions/compliance";
import { StatusBadge } from "../../../../components/status-badge";
import { apiFetch } from "../../../../lib/api";
import { requireRoleAccess } from "../../../../lib/auth";
import { getDemoPersonaForEmail } from "../../../../lib/demo-personas";
import {
  briefingJournalKindLabels,
  briefingTypeLabels,
  getResponsibilityTypeLabel,
} from "../../../../lib/labels";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type EmployeeCardResponse = {
  employee: {
    id: string;
    companyId: string;
    departmentId: string | null;
    siteId: string | null;
    positionId: string | null;
    fullName: string;
    employeeNumber: string;
    jobTitle: string;
    jobTitleKz: string | null;
    email: string | null;
    phone: string | null;
    employeeKind: string;
    status: string;
    department?: { id: string; name: string } | null;
    site?: { id: string; name: string } | null;
    position?: { id: string; code: string; name: string } | null;
    contractorCompany?: { id: string; name: string } | null;
    hasAccount: boolean;
    accountEmail: string | null;
  };
  documents: Array<{
    id: string;
    title: string;
    documentNumber: string | null;
    issueDate: string;
    expiryDate: string | null;
    issuerName: string;
    status: string;
    verificationStatus: string;
    verifiedAt: string | null;
    verificationNotes: string | null;
    fileName: string | null;
    fileUrl: string | null;
    documentEnvelopeId: string | null;
    canonicalStatus?: string | null;
    documentEnvelopeStatus?: string | null;
    documentVersionStatus?: string | null;
    currentVersionNo?: number | null;
    signingDigest?: string | null;
    isSigned?: boolean;
    signedAt?: string | null;
    annulledAt?: string | null;
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
    documentTypeDefinition?: {
      id: string;
      code: string;
      name: string;
      category: "DOCUMENT" | "TRAINING" | "INSTRUCTION";
      requiresExpiry: boolean;
      requiresVerification: boolean;
    } | null;
    verifiedByUser?: {
      id: string;
      fullName: string;
    } | null;
  }>;
  briefings: Array<{
    id: string;
    registrationNo: string | null;
    journalKind: string;
    briefingType: string;
    status: string;
    briefingDate: string;
    topic: string;
    notes: string | null;
    finalSignedAt: string | null;
    evidenceAvailable: boolean;
    latestSignature: {
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
    archiveRecordSummary: {
      id: string;
      status: string;
      sealedAt?: string | null;
      archivedAt?: string | null;
      disposalEligibleAt?: string | null;
      storageUri?: string | null;
      retentionCode: string;
      retentionSource: "configured" | "baseline";
    } | null;
    instructor: {
      fullName: string;
    } | null;
  }>;
  protocols: Array<{
    id: string;
    number: string;
    date: string;
    protocolType: string;
    basis: string;
    status: string;
    decision: string;
    notes: string | null;
    department?: { id: string; name: string } | null;
    workSite?: { id: string; name: string; location?: string | null } | null;
    documentEnvelopeId: string | null;
    canonicalStatus?: string | null;
    currentVersionId?: string | null;
    currentVersionNo?: number | null;
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
    commission: Array<{
      role: "CHAIRMAN" | "MEMBER";
      fullName: string;
      jobTitle?: string | null;
    }>;
  }>;
  matrix: {
    id: string;
    matrixCode: string;
    positionId: string | null;
    position?: { id: string; code: string; name: string } | null;
    currentVersionId: string;
    currentVersionNo: number;
    payload: {
      requiredDocuments: Array<{ documentTypeId: string; notes?: string | null }>;
      requiredTrainings: Array<{ documentTypeId: string; notes?: string | null }>;
      requiredInstructions: Array<{ documentTypeId: string; notes?: string | null }>;
      notes?: string | null;
    };
  } | null;
  admission: {
    status: "admitted" | "limited" | "blocked";
    decisionCode: string;
    checkedAt: string;
    requiredItemCount: number;
    satisfiedItemCount: number;
    missingItemCount: number;
    expiringItemCount: number;
    protocolBasisCount: number;
    activeProtocolBasisCount: number;
    checks: Array<{
      code: string;
      result: "PASS" | "FAIL" | "SKIP";
      severity: "BLOCKER" | "WARNING";
      message?: string | null;
      evidence: string[];
    }>;
    warnings: Array<{
      code: string;
      result: "PASS" | "FAIL" | "SKIP";
      severity: "BLOCKER" | "WARNING";
      message?: string | null;
      evidence: string[];
    }>;
    nextActions: string[];
  };
  latestEvaluation: {
    id: string;
    status: "admitted" | "limited" | "blocked";
    decisionCode: string;
    evaluatedAt: string;
    nextReviewAt: string | null;
    briefingJournalEntryId: string | null;
    protocolId: string | null;
  } | null;
  briefingComplianceImpact: {
    activeBriefingEntryId: string | null;
    signedBriefingCount: number;
    instructionRequirementCount: number;
  };
  responsibilityAppointments: Array<{
    id: string;
    orderId: string;
    orderNumber: string;
    orderDate: string;
    orderTitle: string;
    orderBasis: string;
    orderStatus: string;
    responsibilityType: string;
    scopeType: string;
    branch?: { id: string; name: string } | null;
    department?: { id: string; name: string } | null;
    workSite?: { id: string; name: string; location?: string | null } | null;
    effectiveFrom: string;
    effectiveTo: string | null;
    zoneOfResponsibility: string | null;
    roleNotes: string | null;
    active: boolean;
    derivedStatus: string;
    documentEnvelopeId: string | null;
    signedAt: string | null;
    evidenceAvailable: boolean;
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
  }>;
};

type ComplianceDocumentType = {
  id: string;
  code: string;
  name: string;
  category: "DOCUMENT" | "TRAINING" | "INSTRUCTION";
  defaultValidityDays: number | null;
  requiresExpiry: boolean;
  requiresVerification: boolean;
  isActive: boolean;
};

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === "string" ? value : null;
}

function buildEmployeeLinks(employeeId: string, companyId: string | null) {
  const query = companyId ? `?companyId=${companyId}` : "";

  return {
    edit: `/employees/${employeeId}/edit${query}`,
    list: `/employees${query}`,
  };
}

function buildEmployeeViewLink(
  employeeId: string,
  companyId: string | null,
  replaceDocumentId?: string | null,
) {
  const params = new URLSearchParams();

  if (companyId) {
    params.set("companyId", companyId);
  }

  if (replaceDocumentId) {
    params.set("replaceDocumentId", replaceDocumentId);
  }

  const query = params.toString();
  return query ? `/employees/${employeeId}?${query}` : `/employees/${employeeId}`;
}

function buildProtocolViewLink(protocolId: string, companyId: string | null) {
  const query = companyId ? `?companyId=${companyId}` : "";
  return `/protocols/${protocolId}${query}`;
}

function buildResponsibilityOrderViewLink(orderId: string, companyId: string | null) {
  const query = companyId ? `?companyId=${companyId}` : "";
  return `/orders/responsibility/${orderId}${query}`;
}

function buildBriefingViewLink(briefingId: string, companyId: string | null) {
  const query = companyId ? `?companyId=${companyId}` : "";
  return `/journal/${briefingId}${query}`;
}

export default async function EmployeeCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const session = await requireRoleAccess(["COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const currentDemoPersona = getDemoPersonaForEmail(session.user.email);
  const isReadOnlyPersona = currentDemoPersona?.readOnly === true;
  const { id } = await params;
  const rawSearchParams = await searchParams;
  const errorMessage = firstString(rawSearchParams.error);
  const successMessage = firstString(rawSearchParams.success);
  const replaceDocumentId = firstString(rawSearchParams.replaceDocumentId);

  const card = await apiFetch<EmployeeCardResponse>(`employees/${id}/card`);
  const documentTypes = await apiFetch<ComplianceDocumentType[]>(
    `core-platform/document-types?companyId=${card.employee.companyId}`,
  );

  const links = buildEmployeeLinks(card.employee.id, card.employee.companyId);
  const replacementDocument =
    card.documents.find((document) => document.id === replaceDocumentId) ?? null;
  const matrixCounts = {
    documents: card.matrix?.payload.requiredDocuments.length ?? 0,
    trainings: card.matrix?.payload.requiredTrainings.length ?? 0,
    instructions: card.matrix?.payload.requiredInstructions.length ?? 0,
  };

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
            Карточка сотрудника
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            {card.employee.fullName}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Карточка комплаенса P0 с привязкой к должности, активной матрицей,
            реестром документов сотрудника, снимком допуска и ссылками на доказательства.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <StatusBadge value={card.admission.status} />
          {isReadOnlyPersona ? (
            <span className="inline-flex rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900">
              Только просмотр
            </span>
          ) : (
            <Link
              href={links.edit}
              className="inline-flex rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50"
            >
              Редактировать сотрудника
            </Link>
          )}
          <Link
            href={links.list}
            className="inline-flex rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50"
          >
            Назад к реестру
          </Link>
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Требуется", value: card.admission.requiredItemCount },
          { label: "Выполнено", value: card.admission.satisfiedItemCount },
          { label: "Не хватает", value: card.admission.missingItemCount },
          { label: "Истекает", value: card.admission.expiringItemCount },
        ].map((metric) => (
          <Card key={metric.label} className="rounded-[24px]">
            <CardContent className="space-y-2 p-6">
              <p className="text-sm text-slate-500">{metric.label}</p>
              <p className="text-3xl font-semibold text-slate-950">{metric.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_24rem]">
        <div className="space-y-6">
          <Card className="rounded-[24px]">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Статус допуска
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Код решения: {card.admission.decisionCode}
                </p>
              </div>

              {isReadOnlyPersona ? (
                <p className="text-sm text-slate-500">
                  Демо-режим директора: без пересчета и изменений.
                </p>
              ) : (
                <form action={recalculateEmployeeAdmissionAction}>
                  <input type="hidden" name="companyId" value={card.employee.companyId} />
                  <input type="hidden" name="employeeId" value={card.employee.id} />
                  <button
                    type="submit"
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50"
                  >
                    Пересчитать
                  </button>
                </form>
              )}
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                    Текущий снимок
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    <p>
                      Проверено: {formatDateTime(card.admission.checkedAt)}
                    </p>
                    <p>Статус: <span className="font-medium">{card.admission.status}</span></p>
                    <p>Статус сотрудника: {card.employee.status}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                    Последняя сохранённая оценка
                  </p>
                  {card.latestEvaluation ? (
                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      <p>
                        Оценено: {formatDateTime(card.latestEvaluation.evaluatedAt)}
                      </p>
                        <p>Статус: {card.latestEvaluation.status}</p>
                      <p>Код решения: {card.latestEvaluation.decisionCode}</p>
                      <p>
                        Следующий пересмотр:{" "}
                        {card.latestEvaluation.nextReviewAt
                          ? formatDate(card.latestEvaluation.nextReviewAt)
                          : "не запланирован"}
                      </p>
                      <p>
                        Активное основание протокола:{" "}
                        {card.latestEvaluation.protocolId ? (
                          <Link
                            href={buildProtocolViewLink(
                              card.latestEvaluation.protocolId,
                              card.employee.companyId,
                            )}
                            className="font-medium text-slate-700 underline underline-offset-4"
                          >
                            открыть протокол
                          </Link>
                        ) : (
                          "не привязано"
                        )}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">
                      Пока нет сохранённой оценки.
                    </p>
                  )}
                </div>
              </div>

              {card.admission.nextActions.length ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-medium text-amber-900">
                    Требуемые действия
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-amber-800">
                    {card.admission.nextActions.map((action) => (
                      <li key={action}>• {action}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm font-medium text-slate-900">
                    Данные сотрудника
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    <p>Табельный номер: {card.employee.employeeNumber}</p>
                    <p>Подразделение: {card.employee.department?.name ?? "не назначено"}</p>
                    <p>Должность: {card.employee.position?.name ?? "не назначена"}</p>
                    <p>Код должности: {card.employee.position?.code ?? "—"}</p>
                    <p>Название должности: {card.employee.jobTitle}</p>
                    <p>Площадка: {card.employee.site?.name ?? "не привязана"}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm font-medium text-slate-900">
                    Доступ и контакты
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    <p>Эл. почта: {card.employee.email ?? card.employee.accountEmail ?? "—"}</p>
                    <p>Телефон: {card.employee.phone ?? "—"}</p>
                    <p>Аккаунт: {card.employee.hasAccount ? "включён" : "выключен"}</p>
                    <p>Email аккаунта: {card.employee.accountEmail ?? "—"}</p>
                    <p>Тип сотрудника: {card.employee.employeeKind}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px]">
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">Protocol basis</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                {[
                  { label: "Все связанные", value: card.protocols.length },
                  { label: "Учитывается в допуске", value: card.admission.protocolBasisCount },
                  { label: "Активные подписанные", value: card.admission.activeProtocolBasisCount },
                  {
                    label: "Источник последнего решения",
                    value: card.latestEvaluation?.protocolId ? "Протокол" : "Нет протокола",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                      {item.label}
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-950">{item.value}</p>
                  </div>
                ))}
              </div>

              {card.protocols.length ? (
                <div className="space-y-3">
                  {card.protocols.map((protocol) => (
                    <div
                      key={protocol.id}
                      className="rounded-2xl border border-slate-200 p-4"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={buildProtocolViewLink(protocol.id, card.employee.companyId)}
                              className="text-sm font-semibold text-slate-900 underline underline-offset-4"
                            >
                              {protocol.number}
                            </Link>
                            <StatusBadge value={protocol.status} />
                            {protocol.canonicalStatus ? (
                              <StatusBadge value={protocol.canonicalStatus} />
                            ) : null}
                          </div>
                          <p className="text-sm text-slate-700">
                            {protocol.protocolType} • {formatDate(protocol.date)}
                          </p>
                          <p className="text-sm text-slate-600">{protocol.basis}</p>
                          <p className="text-sm text-slate-600">
                            {protocol.department?.name ?? "без подразделения"}
                            {protocol.workSite?.name ? ` • ${protocol.workSite.name}` : ""}
                          </p>
                          <p className="text-sm text-slate-700">{protocol.decision}</p>
                          {protocol.notes ? (
                            <p className="text-xs text-slate-500">{protocol.notes}</p>
                          ) : null}
                        </div>

                        <div className="space-y-2 text-xs text-slate-500 lg:max-w-64">
                          <p>
                            Подписано в:{" "}
                            {protocol.signedAt ? formatDateTime(protocol.signedAt) : "не подписано"}
                          </p>
                          <p>
                            Доказательства: {protocol.evidenceAvailable ? "доступны" : "недоступны"}
                          </p>
                          <p>
                            Архив:{" "}
                            {protocol.archiveRecordSummary
                              ? `${protocol.archiveRecordSummary.status} • ${protocol.archiveRecordSummary.retentionCode}`
                              : "не запечатано"}
                          </p>
                           <p>Члены комиссии: {protocol.commission.length}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState className="min-h-24 justify-center text-left">
                  Для этого сотрудника пока не привязаны основания протокола.
                </EmptyState>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[24px]">
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">Назначения ответственности</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                {[
                  { label: "Все связанные", value: card.responsibilityAppointments.length },
                  {
                    label: "Активны сейчас",
                    value: card.responsibilityAppointments.filter((item) => item.derivedStatus === "ACTIVE").length,
                  },
                  {
                    label: "Истекли",
                    value: card.responsibilityAppointments.filter((item) => item.derivedStatus === "EXPIRED").length,
                  },
                  {
                    label: "С доказательствами",
                    value: card.responsibilityAppointments.filter((item) => item.evidenceAvailable).length,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                      {item.label}
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-950">{item.value}</p>
                  </div>
                ))}
              </div>

              {card.responsibilityAppointments.length ? (
                <div className="space-y-3">
                  {card.responsibilityAppointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="rounded-2xl border border-slate-200 p-4"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={buildResponsibilityOrderViewLink(
                                appointment.orderId,
                                card.employee.companyId,
                              )}
                              className="text-sm font-semibold text-slate-900 underline underline-offset-4"
                            >
                              {appointment.orderNumber}
                            </Link>
                            <StatusBadge value={appointment.orderStatus} />
                            <StatusBadge value={appointment.derivedStatus} />
                          </div>
                          <p className="text-sm text-slate-700">
                            {getResponsibilityTypeLabel(appointment.responsibilityType)} •{" "}
                            {formatDate(appointment.orderDate)}
                          </p>
                          <p className="text-sm text-slate-600">{appointment.orderTitle}</p>
                          <p className="text-sm text-slate-600">{appointment.orderBasis}</p>
                          <p className="text-sm text-slate-600">
                            {appointment.branch?.name ?? "По всей организации"}
                            {appointment.department?.name ? ` • ${appointment.department.name}` : ""}
                            {appointment.workSite?.name ? ` • ${appointment.workSite.name}` : ""}
                          </p>
                          <p className="text-sm text-slate-700">
                            {formatDate(appointment.effectiveFrom)}
                            {appointment.effectiveTo ? ` → ${formatDate(appointment.effectiveTo)}` : " → без срока"}
                          </p>
                          {appointment.zoneOfResponsibility ? (
                            <p className="text-xs text-slate-500">
                              Зона: {appointment.zoneOfResponsibility}
                            </p>
                          ) : null}
                          {appointment.roleNotes ? (
                            <p className="text-xs text-slate-500">{appointment.roleNotes}</p>
                          ) : null}
                        </div>

                        <div className="space-y-2 text-xs text-slate-500 lg:max-w-64">
                          <p>
                            Подписано в:{" "}
                            {appointment.signedAt ? formatDateTime(appointment.signedAt) : "не подписано"}
                          </p>
                          <p>
                            Доказательства: {appointment.evidenceAvailable ? "доступны" : "недоступны"}
                          </p>
                          <p>
                            Архив:{" "}
                            {appointment.archiveRecordSummary
                              ? `${appointment.archiveRecordSummary.status} • ${appointment.archiveRecordSummary.retentionCode}`
                              : "не запечатано"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState className="min-h-24 justify-center text-left">
                  Для этого сотрудника пока не привязаны назначения ответственности.
                </EmptyState>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[24px]">
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">
                Основание журнала инструктажей
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                {[
                  { label: "Подписанные записи", value: card.briefingComplianceImpact.signedBriefingCount },
                  { label: "Требования инструктажа", value: card.briefingComplianceImpact.instructionRequirementCount },
                  {
                    label: "Учитывается в допуске",
                    value: card.briefingComplianceImpact.activeBriefingEntryId ? "Да" : "Нет",
                  },
                  {
                    label: "Источник последнего решения",
                    value: card.latestEvaluation?.briefingJournalEntryId ? "Инструктаж" : "Нет инструктажа",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                      {item.label}
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-950">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              {card.briefings.length ? (
                <div className="space-y-3">
                  {card.briefings.map((briefing) => (
                    <div
                      key={briefing.id}
                      className="rounded-2xl border border-slate-200 p-4"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={buildBriefingViewLink(briefing.id, card.employee.companyId)}
                              className="text-sm font-semibold text-slate-900 underline underline-offset-4"
                            >
                              {briefing.registrationNo ?? `Запись #${briefing.id.slice(0, 8)}`}
                            </Link>
                            <StatusBadge value={briefing.status} />
                            {card.briefingComplianceImpact.activeBriefingEntryId === briefing.id ? (
                              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                                основание допуска
                              </span>
                            ) : null}
                          </div>
                          <p className="text-sm text-slate-700">
                            {briefingJournalKindLabels[briefing.journalKind] ?? briefing.journalKind} /{" "}
                            {briefingTypeLabels[briefing.briefingType] ?? briefing.briefingType}
                          </p>
                          <p className="text-sm text-slate-600">{briefing.topic}</p>
                          <p className="text-sm text-slate-600">
                            Инструктор: {briefing.instructor?.fullName ?? "не определён"}
                          </p>
                          {briefing.notes ? (
                            <p className="text-xs text-slate-500">{briefing.notes}</p>
                          ) : null}
                        </div>

                        <div className="space-y-2 text-xs text-slate-500 lg:max-w-64">
                          <p>Дата инструктажа: {formatDate(briefing.briefingDate)}</p>
                          <p>
                            Окончательно подписано:{" "}
                            {briefing.finalSignedAt ? formatDateTime(briefing.finalSignedAt) : "не подписано"}
                          </p>
                          <p>
                            Доказательства: {briefing.evidenceAvailable ? "доступны" : "недоступны"}
                          </p>
                          <p>
                            Архив:{" "}
                            {briefing.archiveRecordSummary
                              ? `${briefing.archiveRecordSummary.status} / ${briefing.archiveRecordSummary.retentionCode}`
                              : "не запечатано"}
                          </p>
                          {briefing.latestSignature ? (
                              <p>
                                Последняя подпись: {briefing.latestSignature.signerName} /{" "}
                                {briefing.latestSignature.status}
                              </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState className="min-h-24 justify-center text-left">
                  Для этого сотрудника пока не привязаны подписанные записи журнала инструктажей.
                </EmptyState>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[24px]">
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">
                Активная матрица
              </h2>
            </CardHeader>
            <CardContent>
              {card.matrix ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-4">
                    {[
                      { label: "Матрица", value: card.matrix.matrixCode },
                      { label: "Версия", value: `v${card.matrix.currentVersionNo}` },
                      { label: "Документы", value: matrixCounts.documents },
                      { label: "Обучение / инструктажи", value: `${matrixCounts.trainings} / ${matrixCounts.instructions}` },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                          {item.label}
                        </p>
                        <p className="mt-2 text-base font-semibold text-slate-950">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {card.matrix.payload.notes ? (
                    <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
                      {card.matrix.payload.notes}
                    </div>
                  ) : null}

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-sm font-medium text-slate-900">Документы</p>
                      <ul className="mt-3 space-y-2 text-sm text-slate-700">
                        {card.matrix.payload.requiredDocuments.length ? (
                          card.matrix.payload.requiredDocuments.map((item) => {
                            const type = documentTypes.find(
                              (documentType) => documentType.id === item.documentTypeId,
                            );

                            return (
                              <li key={item.documentTypeId}>
                                • {type?.name ?? item.documentTypeId}
                              </li>
                            );
                          })
                        ) : (
                          <li>Нет требований к документам.</li>
                        )}
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-sm font-medium text-slate-900">Обучение</p>
                      <ul className="mt-3 space-y-2 text-sm text-slate-700">
                        {card.matrix.payload.requiredTrainings.length ? (
                          card.matrix.payload.requiredTrainings.map((item) => {
                            const type = documentTypes.find(
                              (documentType) => documentType.id === item.documentTypeId,
                            );

                            return (
                              <li key={item.documentTypeId}>
                                • {type?.name ?? item.documentTypeId}
                              </li>
                            );
                          })
                        ) : (
                          <li>Нет требований к обучению.</li>
                        )}
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-sm font-medium text-slate-900">
                        Инструктажи
                      </p>
                      <ul className="mt-3 space-y-2 text-sm text-slate-700">
                        {card.matrix.payload.requiredInstructions.length ? (
                          card.matrix.payload.requiredInstructions.map((item) => {
                            const type = documentTypes.find(
                              (documentType) => documentType.id === item.documentTypeId,
                            );

                            return (
                              <li key={item.documentTypeId}>
                                • {type?.name ?? item.documentTypeId}
                              </li>
                            );
                          })
                        ) : (
                          <li>Нет требований к инструктажам.</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState className="min-h-24 justify-center text-left">
                  Для этой должности сотрудника пока не определена активная матрица.
                </EmptyState>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[24px]">
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">
                Документы сотрудника
              </h2>
            </CardHeader>
            <CardContent className="p-0">
              {card.documents.length ? (
                <TableWrapper className="border-0">
                  <Table>
                    <thead>
                      <tr>
                        <Th>Документ</Th>
                        <Th>Тип</Th>
                        <Th>Жизненный цикл</Th>
                        <Th>Проверка</Th>
                        <Th>Доказательства</Th>
                        <Th>Действия</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {card.documents.map((document) => (
                        <tr key={document.id} className="border-t border-slate-100 align-top">
                          <Td>
                            <div className="space-y-1">
                              <p className="font-medium text-slate-900">{document.title}</p>
                              <p className="text-xs text-slate-500">
                                {document.documentNumber ?? "без номера"} • выдан{" "}
                                {formatDate(document.issueDate)}
                              </p>
                              <p className="text-xs text-slate-500">
                                Выдавший: {document.issuerName}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <StatusBadge value={document.status} />
                                {document.documentEnvelopeStatus ? (
                                  <StatusBadge value={document.documentEnvelopeStatus} />
                                ) : null}
                              </div>
                              <p className="text-xs text-slate-500">
                                Подписан: {document.isSigned ? "да" : "нет"}
                                {document.signedAt ? ` • ${formatDateTime(document.signedAt)}` : ""}
                              </p>
                            </div>
                          </Td>
                          <Td>
                            <div className="space-y-1 text-sm text-slate-700">
                              <p>{document.documentTypeDefinition?.name ?? "Устаревший тип"}</p>
                              <p className="text-xs text-slate-500">
                                {document.documentTypeDefinition?.code ?? "—"}
                              </p>
                            </div>
                          </Td>
                          <Td>
                            <div className="space-y-1 text-sm text-slate-700">
                              <p>Канонический статус: {document.canonicalStatus ?? "не связан"}</p>
                              <p>
                                Срок действия:{" "}
                                {document.expiryDate
                                  ? formatDate(document.expiryDate)
                                  : "срок не указан"}
                              </p>
                              <p>
                                Версия:{" "}
                                {document.currentVersionNo
                                  ? `v${document.currentVersionNo}`
                                  : "н/д"}
                              </p>
                              <p className="text-xs text-slate-500">
                                Файл: {document.fileName ?? "не прикреплён"}
                              </p>
                              {document.archiveRecordSummary ? (
                                  <p className="text-xs text-slate-500">
                                    Архив: {document.archiveRecordSummary.status} •{" "}
                                    {document.archiveRecordSummary.retentionCode}
                                  </p>
                              ) : null}
                            </div>
                          </Td>
                          <Td>
                            <div className="space-y-3">
                              <div className="space-y-1 text-sm text-slate-700">
                                <StatusBadge value={document.verificationStatus} />
                                <p className="text-xs text-slate-500">
                                  {document.verifiedAt
                                    ? `Обновлено ${formatDateTime(document.verifiedAt)}`
                                    : "пока не проверено"}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {document.verifiedByUser?.fullName ?? "Проверяющий не назначен"}
                                </p>
                              </div>

                              {isReadOnlyPersona ? null : (
                                <form
                                  action={verifyEmployeeDocumentAction}
                                  className="space-y-2 rounded-2xl border border-slate-200 p-3"
                                >
                                  <input type="hidden" name="companyId" value={card.employee.companyId} />
                                  <input type="hidden" name="employeeId" value={card.employee.id} />
                                  <input type="hidden" name="documentId" value={document.id} />
                                  <Select
                                    name="verificationStatus"
                                    defaultValue={document.verificationStatus}
                                  >
                                    <option value="PENDING">В ожидании</option>
                                    <option value="VERIFIED">Проверено</option>
                                    <option value="REJECTED">Отклонено</option>
                                  </Select>
                                  <Input
                                    name="verificationNotes"
                                    defaultValue={document.verificationNotes ?? ""}
                                    placeholder="Примечание к проверке"
                                  />
                                  <button
                                    type="submit"
                                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50"
                                  >
                                    Сохранить проверку
                                  </button>
                                </form>
                              )}
                            </div>
                          </Td>
                          <Td>
                            <div className="space-y-2">
                              <a
                                href={`/api/documents/${document.id}/download`}
                                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50"
                              >
                                Скачать PDF
                              </a>
                              {document.allowedActions?.canDownloadEvidence && document.documentEnvelopeId ? (
                                <a
                                  href={`/api/document-envelopes/${document.documentEnvelopeId}/evidence-package`}
                                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50"
                                >
                                  Пакет доказательств
                                </a>
                              ) : null}
                              {document.latestSignature ? (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                                  <p className="font-medium text-slate-800">
                                    {document.latestSignature.signerName}
                                  </p>
                                  <p className="mt-1">
                                    {document.latestSignature.provider} •{" "}
                                    {document.latestSignature.status}
                                  </p>
                                  <p className="mt-1">
                                    {document.latestSignature.signedAt
                                      ? formatDateTime(document.latestSignature.signedAt)
                                      : "Дата подписи недоступна"}
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
                                  {document.latestSignature.verifiedAt ? (
                                    <p className="mt-1">
                                      Проверено в: {formatDateTime(document.latestSignature.verifiedAt)}
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </Td>
                          <Td>
                            <div className="flex flex-col gap-2">
                              {!isReadOnlyPersona && document.allowedActions?.canPrepareSign ? (
                                <form action={prepareEmployeeDocumentForSigningAction}>
                                  <input type="hidden" name="companyId" value={card.employee.companyId} />
                                  <input type="hidden" name="employeeId" value={card.employee.id} />
                                  <input type="hidden" name="documentId" value={document.id} />
                                  <button
                                    type="submit"
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50"
                                  >
                                    Подготовить к подписи
                                  </button>
                                </form>
                              ) : null}
                              {!isReadOnlyPersona && document.allowedActions?.canAnnul ? (
                                <form action={annulEmployeeDocumentAction}>
                                  <input type="hidden" name="companyId" value={card.employee.companyId} />
                                  <input type="hidden" name="employeeId" value={card.employee.id} />
                                  <input type="hidden" name="documentId" value={document.id} />
                                  <input type="hidden" name="reason" value="Аннулировано из карточки сотрудника." />
                                  <button
                                    type="submit"
                                    className="w-full rounded-xl border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 transition-colors duration-150 hover:bg-rose-50"
                                  >
                                    Аннулировать
                                  </button>
                                </form>
                              ) : null}
                              {!isReadOnlyPersona && document.allowedActions?.canReplace ? (
                                <Link
                                  href={buildEmployeeViewLink(
                                    card.employee.id,
                                    card.employee.companyId,
                                    document.id,
                                  )}
                                  className="rounded-xl border border-slate-200 px-3 py-2 text-center text-xs font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50"
                                >
                                  Заменить
                                </Link>
                              ) : null}
                              {document.isSigned ? (
                                <p className="text-xs text-slate-500">
                                  Редактирование черновика заблокировано для подписанных версий.
                                </p>
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
                  <EmptyState className="min-h-24 justify-center text-left">
                    Пока нет зарегистрированных документов сотрудника.
                  </EmptyState>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="rounded-[24px]">
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">
                {replacementDocument ? "Заменить подписанный документ" : "Зарегистрировать документ"}
              </h2>
            </CardHeader>
            <CardContent>
              {isReadOnlyPersona ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  Директор видит документы, подписи и доказательства без
                  регистрации новых документов или замены подписанных версий.
                </div>
              ) : documentTypes.length ? (
                <form
                  action={
                    replacementDocument
                      ? replaceEmployeeDocumentAction
                      : createEmployeeComplianceDocumentAction
                  }
                  className="space-y-4"
                >
                  <input type="hidden" name="companyId" value={card.employee.companyId} />
                  <input type="hidden" name="employeeId" value={card.employee.id} />
                  {replacementDocument ? (
                    <input type="hidden" name="documentId" value={replacementDocument.id} />
                  ) : null}

                  {replacementDocument ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      <p className="font-medium">Исходная версия неизменяема.</p>
                      <p className="mt-1">
                        Создайте новую версию документа сотрудника вместо редактирования подписанной.
                      </p>
                      <Link
                        href={buildEmployeeViewLink(card.employee.id, card.employee.companyId)}
                        className="mt-3 inline-flex text-sm font-medium underline underline-offset-4"
                      >
                        Отменить замену
                      </Link>
                    </div>
                  ) : null}

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      Тип документа
                    </label>
                    <Select
                      name="documentTypeDefinitionId"
                      defaultValue={
                        replacementDocument?.documentTypeDefinition?.id ??
                        documentTypes.find((documentType) => documentType.isActive)?.id
                      }
                    >
                      {documentTypes
                        .filter((documentType) => documentType.isActive)
                        .map((documentType) => (
                          <option key={documentType.id} value={documentType.id}>
                            {documentType.name} ({documentType.code})
                          </option>
                        ))}
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Название</label>
                    <Input
                      name="title"
                      placeholder="Медосмотр 2026"
                      defaultValue={replacementDocument?.title ?? ""}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      Номер документа
                    </label>
                    <Input
                      name="documentNumber"
                      placeholder="MED-2026-001"
                      defaultValue={replacementDocument?.documentNumber ?? ""}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">
                        Дата выдачи
                      </label>
                      <Input
                        name="issueDate"
                        type="date"
                        defaultValue={replacementDocument?.issueDate?.slice(0, 10) ?? ""}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">
                        Срок действия
                      </label>
                      <Input
                        name="expiryDate"
                        type="date"
                        defaultValue={replacementDocument?.expiryDate?.slice(0, 10) ?? ""}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Выдавший</label>
                    <Input
                      name="issuerName"
                      placeholder="Клиника профосмотров"
                      defaultValue={replacementDocument?.issuerName ?? ""}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Начальное состояние</label>
                    <Select
                      name="status"
                      defaultValue={replacementDocument?.status === "DRAFT" ? "DRAFT" : "ACTIVE"}
                    >
                      <option value="ACTIVE">Активен</option>
                      <option value="DRAFT">Черновик</option>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Имя файла</label>
                    <Input
                      name="fileName"
                      placeholder="medical-check-2026.pdf"
                      defaultValue={replacementDocument?.fileName ?? ""}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">URI хранения</label>
                    <Input
                      name="fileUrl"
                      placeholder="s3://bucket/path/document.pdf"
                      defaultValue={replacementDocument?.fileUrl ?? ""}
                    />
                  </div>

                  {replacementDocument ? (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">
                        Причина замены
                      </label>
                      <Textarea
                        name="reason"
                        defaultValue="Подписанный документ сотрудника заменён новой версией."
                        className="min-h-24"
                      />
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    className="w-full rounded-xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-slate-700"
                  >
                    {replacementDocument ? "Создать замену" : "Зарегистрировать документ"}
                  </button>
                </form>
              ) : (
                <EmptyState className="min-h-24 justify-center text-left">
                  Сначала создайте типы документов на странице комплаенса.
                </EmptyState>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[24px]">
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">
                Проверки допуска
              </h2>
            </CardHeader>
            <CardContent className="space-y-3">
              {card.admission.checks.length ? (
                card.admission.checks.map((check) => (
                  <div
                    key={check.code}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge value={check.result === "FAIL" ? "blocked" : check.severity === "WARNING" ? "limited" : "admitted"} />
                      <p className="text-sm font-medium text-slate-900">{check.code}</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">
                      {check.message ?? "Сообщение не указано."}
                    </p>
                    {check.evidence.length ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Доказательства: {check.evidence.join(", ")}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <EmptyState className="min-h-24 justify-center text-left">
                  Проверки допуска пока недоступны.
                </EmptyState>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[24px]">
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">
                Примечания матрицы
              </h2>
            </CardHeader>
            <CardContent>
              <Textarea
                readOnly
                value={card.matrix?.payload.notes ?? "Примечаний к матрице нет."}
                className="min-h-32"
              />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
