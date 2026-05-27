"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "../lib/api";
import { readSigningInput } from "../lib/signing-payload";

function emptyToUndefined(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : undefined;
}

function getCreateBriefingPayload(formData: FormData) {
  return {
    companyId: emptyToUndefined(formData.get("companyId")),
    employeeIds: formData
      .getAll("employeeIds")
      .map((value) => String(value))
      .filter((value) => value.length > 0),
    journalKind: emptyToUndefined(formData.get("journalKind")),
    departmentId: emptyToUndefined(formData.get("departmentId")) ?? null,
    workSiteId:
      emptyToUndefined(formData.get("workSiteId")) ?? emptyToUndefined(formData.get("siteId")) ?? null,
    siteId: emptyToUndefined(formData.get("siteId")) ?? null,
    instructorUserId: String(formData.get("instructorUserId") ?? ""),
    briefingType: String(formData.get("briefingType") ?? "INTRODUCTORY"),
    briefingDate: String(formData.get("briefingDate") ?? ""),
    briefingTime: emptyToUndefined(formData.get("briefingTime")) ?? null,
    topic: String(formData.get("topic") ?? ""),
    program:
      emptyToUndefined(formData.get("program")) ??
      emptyToUndefined(formData.get("materialContent")) ??
      null,
    basis: emptyToUndefined(formData.get("basis")) ?? null,
    unscheduledReason: emptyToUndefined(formData.get("unscheduledReason")) ?? null,
    notes: emptyToUndefined(formData.get("notes")) ?? null,
    status: String(formData.get("status") ?? "DRAFT"),
  };
}

function getUpdateBriefingPayload(formData: FormData) {
  return {
    companyId: emptyToUndefined(formData.get("companyId")),
    employeeId: emptyToUndefined(formData.get("employeeId")),
    journalKind: emptyToUndefined(formData.get("journalKind")),
    departmentId: emptyToUndefined(formData.get("departmentId")) ?? null,
    workSiteId:
      emptyToUndefined(formData.get("workSiteId")) ?? emptyToUndefined(formData.get("siteId")) ?? null,
    siteId: emptyToUndefined(formData.get("siteId")) ?? null,
    instructorUserId: emptyToUndefined(formData.get("instructorUserId")),
    briefingType: emptyToUndefined(formData.get("briefingType")),
    briefingDate: emptyToUndefined(formData.get("briefingDate")),
    briefingTime: emptyToUndefined(formData.get("briefingTime")) ?? null,
    topic: emptyToUndefined(formData.get("topic")),
    program:
      emptyToUndefined(formData.get("program")) ??
      emptyToUndefined(formData.get("materialContent")) ??
      null,
    basis: emptyToUndefined(formData.get("basis")) ?? null,
    unscheduledReason: emptyToUndefined(formData.get("unscheduledReason")) ?? null,
    notes: emptyToUndefined(formData.get("notes")) ?? null,
    status: emptyToUndefined(formData.get("status")),
  };
}

function buildJournalUrl(pathname: string, companyId: string | null, error?: string) {
  const params = new URLSearchParams();

  if (companyId) {
    params.set("companyId", companyId);
  }

  if (error) {
    params.set("error", error);
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export async function createBriefingAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "") || null;
  let record: { id: string };

  try {
    record = await apiFetch<{ id: string }>("briefing-records", {
      method: "POST",
      body: JSON.stringify(getCreateBriefingPayload(formData)),
    });
  } catch (error) {
    redirect(
      buildJournalUrl(
        "/journal/new",
        companyId,
        error instanceof Error ? error.message : "Не удалось создать запись инструктажа.",
      ),
    );
  }

  revalidatePath("/journal");
  redirect(buildJournalUrl(`/journal/${record.id}`, companyId));
}

export async function updateBriefingAction(formData: FormData) {
  const briefingId = String(formData.get("briefingId") ?? "");
  const companyId = String(formData.get("companyId") ?? "") || null;

  try {
    await apiFetch(`briefing-records/${briefingId}`, {
      method: "PATCH",
      body: JSON.stringify(getUpdateBriefingPayload(formData)),
    });
  } catch (error) {
    redirect(
      buildJournalUrl(
        `/journal/${briefingId}/edit`,
        companyId,
        error instanceof Error ? error.message : "Не удалось обновить запись инструктажа.",
      ),
    );
  }

  revalidatePath("/journal");
  revalidatePath(`/journal/${briefingId}`);
  redirect(companyId ? `/journal/${briefingId}?companyId=${companyId}` : `/journal/${briefingId}`);
}

export async function prepareBriefingForSigningAction(formData: FormData) {
  const briefingId = String(formData.get("briefingId") ?? "");
  const companyId = String(formData.get("companyId") ?? "") || null;

  try {
    await apiFetch(`briefing-records/${briefingId}/prepare-signing`, {
      method: "POST",
    });
  } catch (error) {
    redirect(
      buildJournalUrl(
        `/journal/${briefingId}`,
        companyId,
        error instanceof Error ? error.message : "Не удалось подготовить запись к подписанию.",
      ),
    );
  }

  revalidatePath(`/journal/${briefingId}`);
  redirect(companyId ? `/journal/${briefingId}?companyId=${companyId}` : `/journal/${briefingId}`);
}

export async function archiveBriefingAction(formData: FormData) {
  const briefingId = String(formData.get("briefingId") ?? "");
  const companyId = String(formData.get("companyId") ?? "") || null;

  try {
    await apiFetch(`briefing-records/${briefingId}/archive`, {
      method: "POST",
    });
  } catch (error) {
    redirect(
      buildJournalUrl(
        `/journal/${briefingId}`,
        companyId,
        error instanceof Error ? error.message : "Не удалось архивировать запись.",
      ),
    );
  }

  revalidatePath(`/journal/${briefingId}`);
  redirect(companyId ? `/journal/${briefingId}?companyId=${companyId}` : `/journal/${briefingId}`);
}

export async function signBriefingAction(formData: FormData) {
  const briefingId = String(formData.get("briefingId") ?? "");
  const companyId = String(formData.get("companyId") ?? "") || null;

  try {
    const signingInput = readSigningInput(formData);

    await apiFetch(`signatures/briefing-records/${briefingId}/sign`, {
      method: "POST",
      body: JSON.stringify(signingInput ?? {}),
    });
  } catch (error) {
    redirect(
      buildJournalUrl(
        `/journal/${briefingId}`,
        companyId,
        error instanceof Error ? error.message : "Не удалось подписать запись.",
      ),
    );
  }

  revalidatePath(`/journal/${briefingId}`);
  redirect(companyId ? `/journal/${briefingId}?companyId=${companyId}` : `/journal/${briefingId}`);
}

export async function annulBriefingAction(formData: FormData) {
  const briefingId = String(formData.get("briefingId") ?? "");
  const companyId = emptyToUndefined(formData.get("companyId")) ?? null;
  const reason = emptyToUndefined(formData.get("reason")) ?? null;

  try {
    await apiFetch(`briefing-records/${briefingId}/annul`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  } catch (error) {
    redirect(
      buildJournalUrl(
        `/journal/${briefingId}`,
        companyId,
        error instanceof Error ? error.message : "Не удалось аннулировать запись.",
      ),
    );
  }

  revalidatePath("/journal");
  revalidatePath(`/journal/${briefingId}`);
  redirect(companyId ? `/journal/${briefingId}?companyId=${companyId}` : `/journal/${briefingId}`);
}

export async function replaceBriefingAction(formData: FormData) {
  const briefingId = String(formData.get("briefingId") ?? "");
  const companyId = emptyToUndefined(formData.get("companyId")) ?? null;
  const reason = emptyToUndefined(formData.get("reason")) ?? null;
  let replacement: { id: string };

  try {
    replacement = await apiFetch<{ id: string }>(`briefing-records/${briefingId}/replace`, {
      method: "POST",
      body: JSON.stringify({
        ...getCreateBriefingPayload(formData),
        reason,
      }),
    });
  } catch (error) {
    redirect(
      buildJournalUrl(
        `/journal/${briefingId}`,
        companyId,
        error instanceof Error ? error.message : "Failed to create replacement briefing entry.",
      ),
    );
  }

  revalidatePath("/journal");
  revalidatePath(`/journal/${briefingId}`);
  revalidatePath(`/journal/${replacement.id}`);
  redirect(buildJournalUrl(`/journal/${replacement.id}`, companyId));
}

export const mockSignBriefingAction = signBriefingAction;
