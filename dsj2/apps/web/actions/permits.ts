"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hashDocumentPayload } from "@dsj/utils";
import { apiFetch } from "@/lib/api";
import {
  buildPermitPayload,
  deriveScopeType,
  mapPermitWorkTypeToCore,
  type PermitEntry,
  type PermitWorkType,
} from "@/lib/permits";
import { readSigningInput } from "@/lib/signing-payload";

function firstString(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function optionalString(formData: FormData, name: string) {
  return firstString(formData, name) || null;
}

function stringArray(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function linesArray(formData: FormData, name: string) {
  return firstString(formData, name)
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function combinedArray(formData: FormData, name: string) {
  return [...stringArray(formData, name), ...linesArray(formData, `${name}Text`)];
}

function buildPermitsUrl(
  companyId: string | null,
  options?: {
    error?: string;
    success?: string;
  },
) {
  const params = new URLSearchParams();

  if (companyId) {
    params.set("companyId", companyId);
  }

  if (options?.error) {
    params.set("error", options.error);
  }

  if (options?.success) {
    params.set("success", options.success);
  }

  const query = params.toString();
  return query ? `/permits?${query}` : "/permits";
}

function buildPermitUrl(
  permitId: string,
  companyId: string | null,
  options?: {
    error?: string;
    success?: string;
    suffix?: string;
  },
) {
  const params = new URLSearchParams();

  if (companyId) {
    params.set("companyId", companyId);
  }

  if (options?.error) {
    params.set("error", options.error);
  }

  if (options?.success) {
    params.set("success", options.success);
  }

  const path = `/permits/${permitId}${options?.suffix ?? ""}`;
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function revalidatePermitViews(permitId: string) {
  revalidatePath("/permits");
  revalidatePath(`/permits/${permitId}`);
  revalidatePath(`/permits/${permitId}/edit`);
  revalidatePath(`/permits/${permitId}/precheck`);
  revalidatePath(`/permits/${permitId}/approvals`);
  revalidatePath(`/permits/${permitId}/signatures`);
  revalidatePath(`/permits/${permitId}/closure`);
  revalidatePath(`/permits/${permitId}/audit`);
}

function readPermitEntry(formData: FormData, status: PermitEntry["status"]): PermitEntry {
  const now = new Date().toISOString();
  const workType = firstString(formData, "workType") as PermitWorkType;
  const entryWithoutHash: PermitEntry = {
    companyId: optionalString(formData, "companyId"),
    journalId: "PERMIT_JOURNAL_MAIN",
    permitNumber: firstString(formData, "permitNumber"),
    journalRegistrationNumber: firstString(formData, "journalRegistrationNumber"),
    permitType: firstString(formData, "permitType") as PermitEntry["permitType"],
    workType,
    status,
    workDescription: firstString(formData, "workDescription"),
    workplace: firstString(formData, "workplace"),
    workZoneId: optionalString(formData, "workSiteId"),
    departmentId: optionalString(formData, "departmentId"),
    startAt: firstString(formData, "startAt"),
    endAt: firstString(formData, "endAt"),
    validUntil: optionalString(formData, "endAt"),
    contractorId: optionalString(formData, "contractorId"),
    contractorRepresentativeId: optionalString(formData, "contractorRepresentativeId"),
    issuerId: optionalString(formData, "issuerId"),
    responsibleManagerId: optionalString(formData, "responsibleManagerId"),
    workProducerId: optionalString(formData, "workProducerId"),
    admitterId: optionalString(formData, "admitterId"),
    observerId: optionalString(formData, "observerId"),
    crewMemberIds: stringArray(formData, "crewMemberIds"),
    hazardFactors: linesArray(formData, "hazardFactors"),
    safetyMeasures: firstString(formData, "safetyMeasures"),
    ppeRequirements: optionalString(formData, "ppeRequirements"),
    ppeIssuedConfirmed: formData.get("ppeIssuedConfirmed") === "on",
    legalBasis: stringArray(formData, "legalBasis"),
    legalBasisVersion: "PERMIT_JOURNAL_UI_CANONICAL",
    legalBasisEffectiveDate: new Date().toISOString().slice(0, 10),
    trainingEvidenceIds: combinedArray(formData, "trainingEvidenceIds"),
    briefingEvidenceIds: combinedArray(formData, "briefingEvidenceIds"),
    certificateEvidenceIds: combinedArray(formData, "certificateEvidenceIds"),
    medicalEvidenceIds: combinedArray(formData, "medicalEvidenceIds"),
    requiredDocumentIds: combinedArray(formData, "requiredDocumentIds"),
    approvalStatus: status === "pending_approval" ? "pending_approval" : null,
    signatureStatus: null,
    createdAt: firstString(formData, "createdAt") || now,
    updatedAt: now,
  };
  const normalizedPayload = JSON.stringify({
    permitNumber: entryWithoutHash.permitNumber,
    permitType: entryWithoutHash.permitType,
    workType: entryWithoutHash.workType,
    workDescription: entryWithoutHash.workDescription,
    workplace: entryWithoutHash.workplace,
    startAt: entryWithoutHash.startAt,
    endAt: entryWithoutHash.endAt,
    participants: {
      issuerId: entryWithoutHash.issuerId,
      responsibleManagerId: entryWithoutHash.responsibleManagerId,
      workProducerId: entryWithoutHash.workProducerId,
      admitterId: entryWithoutHash.admitterId,
      crewMemberIds: entryWithoutHash.crewMemberIds,
    },
    hazardFactors: entryWithoutHash.hazardFactors,
    safetyMeasures: entryWithoutHash.safetyMeasures,
    legalBasis: entryWithoutHash.legalBasis,
  });

  return {
    ...entryWithoutHash,
    documentVersionHash: hashDocumentPayload(normalizedPayload),
  };
}

export async function createPermitAction(formData: FormData) {
  const companyId = optionalString(formData, "companyId");
  const permitEntry = readPermitEntry(formData, "draft");
  const workType = mapPermitWorkTypeToCore(permitEntry.workType);
  const branchId = optionalString(formData, "branchId");
  const departmentId = optionalString(formData, "departmentId");
  const workSiteId = optionalString(formData, "workSiteId");
  const scopeType = deriveScopeType({ branchId, departmentId, workSiteId });
  let createdPermitId: string | null = null;

  try {
    const permit = await apiFetch<{ id: string }>("core-platform/work-permits", {
      method: "POST",
      body: JSON.stringify({
        organizationId: companyId,
        permitCode: permitEntry.permitNumber,
        permitType: workType,
        title: permitEntry.workDescription || permitEntry.permitNumber,
        scopeType,
        branchId,
        departmentId,
        workSiteId,
        status: "DRAFT",
        effectiveFrom: permitEntry.startAt || null,
        effectiveTo: permitEntry.endAt || null,
      }),
    });
    createdPermitId = permit.id;

    await apiFetch("core-platform/work-permit-versions", {
      method: "POST",
      body: JSON.stringify({
        permitId: permit.id,
        status: "DRAFT",
        payloadJson: buildPermitPayload(permitEntry),
      }),
    });

    if (permitEntry.crewMemberIds.length) {
      const brigade = await apiFetch<{ id: string }>("core-platform/brigades", {
        method: "POST",
        body: JSON.stringify({
          permitId: permit.id,
          brigadeCode: `${permitEntry.permitNumber}-BRG`,
          title: "Основная бригада",
          leaderEmployeeId: permitEntry.workProducerId,
        }),
      });

      await Promise.all(
        permitEntry.crewMemberIds.map((employeeId) =>
          apiFetch("core-platform/brigade-members", {
            method: "POST",
            body: JSON.stringify({
              brigadeId: brigade.id,
              employeeId,
              roleCode: "EXECUTOR",
              status: "ASSIGNED",
            }),
          }),
        ),
      );
    }
  } catch (error) {
    redirect(
      buildPermitsUrl(companyId, {
        error: error instanceof Error ? error.message : "Не удалось создать допуск.",
      }),
    );
  }

  if (!createdPermitId) {
    redirect(
      buildPermitsUrl(companyId, {
        error: "Не удалось определить созданный допуск.",
      }),
    );
  }

  redirect(
    buildPermitUrl(createdPermitId, companyId, {
      success: "Допуск создан.",
    }),
  );
}

export async function updatePermitAction(formData: FormData) {
  const permitId = firstString(formData, "permitId");
  const companyId = optionalString(formData, "companyId");
  const permitEntry = readPermitEntry(formData, "draft");
  const branchId = optionalString(formData, "branchId");
  const departmentId = optionalString(formData, "departmentId");
  const workSiteId = optionalString(formData, "workSiteId");
  const scopeType = deriveScopeType({ branchId, departmentId, workSiteId });

  try {
    await apiFetch(`core-platform/work-permits/${permitId}`, {
      method: "PATCH",
      body: JSON.stringify({
        permitCode: permitEntry.permitNumber,
        permitType: mapPermitWorkTypeToCore(permitEntry.workType),
        title: permitEntry.workDescription || permitEntry.permitNumber,
        scopeType,
        branchId,
        departmentId,
        workSiteId,
        effectiveFrom: permitEntry.startAt || null,
        effectiveTo: permitEntry.endAt || null,
        payloadJson: buildPermitPayload(permitEntry),
      }),
    });
  } catch (error) {
    redirect(
      buildPermitUrl(permitId, companyId, {
        suffix: "/edit",
        error: error instanceof Error ? error.message : "Не удалось сохранить допуск.",
      }),
    );
  }

  revalidatePermitViews(permitId);
  redirect(
    buildPermitUrl(permitId, companyId, {
      success: "Допуск обновлён.",
    }),
  );
}

export async function runPermitPrecheckAction(formData: FormData) {
  const permitId = firstString(formData, "permitId");
  const companyId = optionalString(formData, "companyId");

  try {
    await apiFetch(`core-platform/work-permits/${permitId}/precheck`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  } catch (error) {
    redirect(
      buildPermitUrl(permitId, companyId, {
        suffix: "/precheck",
        error: error instanceof Error ? error.message : "Не удалось выполнить precheck.",
      }),
    );
  }

  revalidatePermitViews(permitId);
  redirect(
    buildPermitUrl(permitId, companyId, {
      suffix: "/precheck",
      success: "Precheck выполнен.",
    }),
  );
}

export async function submitPermitAction(formData: FormData) {
  const permitId = firstString(formData, "permitId");
  const companyId = optionalString(formData, "companyId");

  try {
    await apiFetch(`core-platform/work-permits/${permitId}/submit`, {
      method: "POST",
      body: JSON.stringify({
        comment: optionalString(formData, "comment"),
      }),
    });
  } catch (error) {
    redirect(
      buildPermitUrl(permitId, companyId, {
        suffix: "/approvals",
        error:
          error instanceof Error ? error.message : "Не удалось отправить на согласование.",
      }),
    );
  }

  revalidatePermitViews(permitId);
  redirect(
    buildPermitUrl(permitId, companyId, {
      suffix: "/approvals",
      success: "Допуск отправлен на согласование.",
    }),
  );
}

export async function approvePermitAction(formData: FormData) {
  const permitId = firstString(formData, "permitId");
  const companyId = optionalString(formData, "companyId");

  try {
    await apiFetch(`core-platform/work-permits/${permitId}/approve`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  } catch (error) {
    redirect(
      buildPermitUrl(permitId, companyId, {
        suffix: "/approvals",
        error: error instanceof Error ? error.message : "Не удалось согласовать допуск.",
      }),
    );
  }

  revalidatePermitViews(permitId);
  redirect(
    buildPermitUrl(permitId, companyId, {
      success: "Допуск согласован.",
    }),
  );
}

export async function activatePermitAction(formData: FormData) {
  const permitId = firstString(formData, "permitId");
  const companyId = optionalString(formData, "companyId");

  try {
    await apiFetch(`core-platform/work-permits/${permitId}/activate`, {
      method: "POST",
      body: JSON.stringify({
        comment: optionalString(formData, "comment"),
      }),
    });
  } catch (error) {
    redirect(
      buildPermitUrl(permitId, companyId, {
        error: error instanceof Error ? error.message : "Не удалось активировать допуск.",
      }),
    );
  }

  revalidatePermitViews(permitId);
  redirect(
    buildPermitUrl(permitId, companyId, {
      success: "Допуск активирован.",
    }),
  );
}

export async function suspendPermitAction(formData: FormData) {
  const permitId = firstString(formData, "permitId");
  const companyId = optionalString(formData, "companyId");

  try {
    await apiFetch(`core-platform/work-permits/${permitId}/suspend`, {
      method: "POST",
      body: JSON.stringify({
        reason: optionalString(formData, "reason"),
      }),
    });
  } catch (error) {
    redirect(
      buildPermitUrl(permitId, companyId, {
        suffix: "/closure",
        error: error instanceof Error ? error.message : "Не удалось приостановить допуск.",
      }),
    );
  }

  revalidatePermitViews(permitId);
  redirect(
    buildPermitUrl(permitId, companyId, {
      suffix: "/closure",
      success: "Допуск приостановлен.",
    }),
  );
}

export async function closePermitAction(formData: FormData) {
  const permitId = firstString(formData, "permitId");
  const companyId = optionalString(formData, "companyId");

  try {
    await apiFetch(`core-platform/work-permits/${permitId}/close`, {
      method: "POST",
      body: JSON.stringify({
        comment: optionalString(formData, "comment"),
        closure: {
          result: optionalString(formData, "result"),
          inspection: optionalString(formData, "inspection"),
          closedAt: new Date().toISOString(),
        },
      }),
    });
  } catch (error) {
    redirect(
      buildPermitUrl(permitId, companyId, {
        suffix: "/closure",
        error: error instanceof Error ? error.message : "Не удалось закрыть допуск.",
      }),
    );
  }

  revalidatePermitViews(permitId);
  redirect(
    buildPermitUrl(permitId, companyId, {
      success: "Допуск закрыт.",
    }),
  );
}

export async function annulPermitAction(formData: FormData) {
  const permitId = firstString(formData, "permitId");
  const companyId = optionalString(formData, "companyId");

  try {
    await apiFetch(`core-platform/work-permits/${permitId}/annul`, {
      method: "POST",
      body: JSON.stringify({
        reason: optionalString(formData, "reason"),
      }),
    });
  } catch (error) {
    redirect(
      buildPermitUrl(permitId, companyId, {
        error: error instanceof Error ? error.message : "Не удалось отменить допуск.",
      }),
    );
  }

  revalidatePermitViews(permitId);
  redirect(
    buildPermitUrl(permitId, companyId, {
      success: "Допуск отменён.",
    }),
  );
}

export async function signPermitAction(formData: FormData) {
  const permitId = firstString(formData, "permitId");
  const companyId = optionalString(formData, "companyId");

  try {
    const signingInput = readSigningInput(formData);

    await apiFetch(`core-platform/work-permits/${permitId}/sign`, {
      method: "POST",
      body: JSON.stringify(signingInput ?? {}),
    });
  } catch (error) {
    redirect(
      buildPermitUrl(permitId, companyId, {
        suffix: "/signatures",
        error: error instanceof Error ? error.message : "Не удалось подписать допуск.",
      }),
    );
  }

  revalidatePermitViews(permitId);
  redirect(
    buildPermitUrl(permitId, companyId, {
      suffix: "/signatures",
      success: "Допуск подписан.",
    }),
  );
}
