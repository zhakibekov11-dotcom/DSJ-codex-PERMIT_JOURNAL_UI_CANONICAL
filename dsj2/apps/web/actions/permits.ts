"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { deriveScopeType, type PermitWorkType } from "@/lib/permits";
import { readSigningInput } from "@/lib/signing-payload";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function optionalText(formData: FormData, name: string) {
  return text(formData, name) || null;
}

function values(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function lines(formData: FormData, name: string) {
  return text(formData, name)
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function isoDate(formData: FormData, name: string) {
  const value = text(formData, name);
  return value ? new Date(value).toISOString() : "";
}

function permitInput(formData: FormData) {
  const branchId = optionalText(formData, "branchId");
  const departmentId = optionalText(formData, "departmentId");
  const workSiteId = optionalText(formData, "workSiteId");

  return {
    permitNumber: text(formData, "permitNumber"),
    journalRegistrationNumber: text(formData, "journalRegistrationNumber"),
    permitType: text(formData, "permitType"),
    workType: text(formData, "workType") as PermitWorkType,
    workDescription: text(formData, "workDescription"),
    workplace: text(formData, "workplace"),
    scopeType: deriveScopeType({ branchId, departmentId, workSiteId }),
    branchId,
    departmentId,
    workSiteId,
    startAt: isoDate(formData, "startAt"),
    endAt: isoDate(formData, "endAt"),
    contractorId: optionalText(formData, "contractorId"),
    contractorRepresentativeId: optionalText(
      formData,
      "contractorRepresentativeId",
    ),
    issuerId: optionalText(formData, "issuerId"),
    responsibleManagerId: optionalText(formData, "responsibleManagerId"),
    workProducerId: optionalText(formData, "workProducerId"),
    admitterId: optionalText(formData, "admitterId"),
    observerId: optionalText(formData, "observerId"),
    crew: {
      employeeIds: values(formData, "crewEmployeeIds"),
      contractorWorkerIds: values(formData, "crewContractorWorkerIds"),
    },
    hazardFactors: lines(formData, "hazardFactors"),
    safetyMeasures: text(formData, "safetyMeasures"),
    ppeRequirements: optionalText(formData, "ppeRequirements"),
    ppeIssueRecordIds: values(formData, "ppeIssueRecordIds"),
    legalBasis: values(formData, "legalBasis"),
    trainingEvidenceIds: values(formData, "trainingEvidenceIds"),
    briefingEvidenceIds: values(formData, "briefingEvidenceIds"),
    certificateEvidenceIds: values(formData, "certificateEvidenceIds"),
    medicalEvidenceIds: values(formData, "medicalEvidenceIds"),
    requiredDocumentIds: values(formData, "requiredDocumentIds"),
  };
}

function permitUrl(
  permitId: string,
  companyId: string | null,
  options?: { suffix?: string; error?: string; success?: string },
) {
  const params = new URLSearchParams();
  if (companyId) params.set("companyId", companyId);
  if (options?.error) params.set("error", options.error);
  if (options?.success) params.set("success", options.success);
  const query = params.toString();
  const path = `/permits/${permitId}${options?.suffix ?? ""}`;
  return query ? `${path}?${query}` : path;
}

function permitsUrl(
  companyId: string | null,
  options?: { error?: string; success?: string },
) {
  const params = new URLSearchParams();
  if (companyId) params.set("companyId", companyId);
  if (options?.error) params.set("error", options.error);
  if (options?.success) params.set("success", options.success);
  return params.size ? `/permits?${params.toString()}` : "/permits";
}

function refresh(permitId: string) {
  revalidatePath("/permits");
  for (const suffix of [
    "",
    "/edit",
    "/precheck",
    "/approvals",
    "/signatures",
    "/closure",
    "/audit",
  ]) {
    revalidatePath(`/permits/${permitId}${suffix}`);
  }
}

async function workflowAction(
  formData: FormData,
  endpoint: string,
  body: unknown,
  options: { suffix?: string; success: string },
) {
  const permitId = text(formData, "permitId");
  const companyId = optionalText(formData, "companyId");
  try {
    await apiFetch(`core-platform/work-permits/${permitId}/${endpoint}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch (error) {
    redirect(
      permitUrl(permitId, companyId, {
        suffix: options.suffix,
        error:
          error instanceof Error ? error.message : "Операция не выполнена.",
      }),
    );
  }
  refresh(permitId);
  redirect(
    permitUrl(permitId, companyId, {
      suffix: options.suffix,
      success: options.success,
    }),
  );
}

export async function createPermitAction(formData: FormData) {
  const companyId = optionalText(formData, "companyId");
  let permitId: string;
  try {
    const permit = await apiFetch<{ id: string }>(
      "core-platform/work-permits",
      {
        method: "POST",
        body: JSON.stringify({
          organizationId: companyId,
          ...permitInput(formData),
        }),
      },
    );
    permitId = permit.id;
  } catch (error) {
    redirect(
      permitsUrl(companyId, {
        error:
          error instanceof Error ? error.message : "Не удалось создать допуск.",
      }),
    );
  }
  redirect(
    permitUrl(permitId, companyId, {
      success: "Допуск создан одной транзакцией.",
    }),
  );
}

export async function updatePermitAction(formData: FormData) {
  const permitId = text(formData, "permitId");
  const companyId = optionalText(formData, "companyId");
  try {
    await apiFetch(`core-platform/work-permits/${permitId}`, {
      method: "PATCH",
      body: JSON.stringify(permitInput(formData)),
    });
  } catch (error) {
    redirect(
      permitUrl(permitId, companyId, {
        suffix: "/edit",
        error:
          error instanceof Error
            ? error.message
            : "Не удалось сохранить допуск.",
      }),
    );
  }
  refresh(permitId);
  redirect(permitUrl(permitId, companyId, { success: "Допуск обновлён." }));
}

export async function runPermitPrecheckAction(formData: FormData) {
  return workflowAction(
    formData,
    "precheck",
    {},
    {
      suffix: "/precheck",
      success: "Precheck выполнен по реальным источникам.",
    },
  );
}

export async function submitPermitAction(formData: FormData) {
  return workflowAction(
    formData,
    "submit",
    { comment: optionalText(formData, "comment") },
    { suffix: "/approvals", success: "Допуск отправлен на согласование." },
  );
}

export async function confirmPermitAction(formData: FormData) {
  return workflowAction(
    formData,
    "confirm",
    { comment: optionalText(formData, "comment") },
    { suffix: "/approvals", success: "Производитель работ подтвердил допуск." },
  );
}

export async function approvePermitAction(formData: FormData) {
  return workflowAction(
    formData,
    "approve",
    { comment: optionalText(formData, "comment") },
    { suffix: "/approvals", success: "Допуск согласован." },
  );
}

export async function rejectPermitAction(formData: FormData) {
  return workflowAction(
    formData,
    "reject",
    { reason: text(formData, "reason") },
    { suffix: "/approvals", success: "Допуск отклонён." },
  );
}

export async function preparePermitSignAction(formData: FormData) {
  return workflowAction(
    formData,
    "prepare-sign",
    { comment: optionalText(formData, "comment") },
    { suffix: "/signatures", success: "Подписываемая версия зафиксирована." },
  );
}

export async function activatePermitAction(formData: FormData) {
  return workflowAction(
    formData,
    "activate",
    { comment: optionalText(formData, "comment") },
    { success: "Допуск активирован допускающим." },
  );
}

export async function suspendPermitAction(formData: FormData) {
  return workflowAction(
    formData,
    "suspend",
    { reason: text(formData, "reason") },
    { suffix: "/closure", success: "Допуск приостановлен." },
  );
}

export async function resumePermitAction(formData: FormData) {
  return workflowAction(
    formData,
    "resume",
    { comment: optionalText(formData, "comment") },
    { suffix: "/closure", success: "Допуск возобновлён." },
  );
}

export async function closePermitAction(formData: FormData) {
  return workflowAction(
    formData,
    "close",
    {
      comment: optionalText(formData, "comment"),
      closure: {
        result: text(formData, "result"),
        inspection: text(formData, "inspection"),
        notes: optionalText(formData, "comment"),
        closedAt: new Date().toISOString(),
      },
    },
    { suffix: "/closure", success: "Допуск закрыт." },
  );
}

export async function annulPermitAction(formData: FormData) {
  return workflowAction(
    formData,
    "cancel",
    { reason: text(formData, "reason") },
    { success: "Допуск отменён." },
  );
}

export async function archivePermitAction(formData: FormData) {
  return workflowAction(
    formData,
    "archive",
    {},
    {
      success: "Допуск и evidence package архивированы.",
    },
  );
}

export async function signPermitAction(formData: FormData) {
  const permitId = text(formData, "permitId");
  const companyId = optionalText(formData, "companyId");
  try {
    const signingInput = readSigningInput(formData);
    if (!signingInput) {
      throw new Error("Заполните данные подписанта.");
    }
    const ncalayer = "cms" in signingInput;
    const session = await apiFetch<{ id: string }>("signing/sessions", {
      method: "POST",
      body: JSON.stringify({
        documentType: "WORK_PERMIT",
        documentId: permitId,
        provider: ncalayer ? "NCALAYER_PROVIDER" : "MOCK_PROVIDER",
      }),
    });
    await apiFetch(
      `signing/sessions/${session.id}/${ncalayer ? "ncalayer" : "mock"}/submit`,
      {
        method: "POST",
        body: JSON.stringify(signingInput),
      },
    );
  } catch (error) {
    redirect(
      permitUrl(permitId, companyId, {
        suffix: "/signatures",
        error:
          error instanceof Error
            ? error.message
            : "Не удалось подписать допуск.",
      }),
    );
  }
  refresh(permitId);
  redirect(
    permitUrl(permitId, companyId, {
      suffix: "/signatures",
      success: "Допуск подписан через signing session.",
    }),
  );
}
