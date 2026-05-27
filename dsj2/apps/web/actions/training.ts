"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "../lib/api";

function buildTrainingUrl(pathname: string, companyId: string | null, error?: string) {
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

export async function createTrainingAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "") || null;

  try {
    await apiFetch("training-assignments", {
      method: "POST",
      body: JSON.stringify({
        companyId,
        employeeIds: formData
          .getAll("employeeIds")
          .map((value) => String(value))
          .filter((value) => value.length > 0),
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? ""),
        materialContent: String(formData.get("materialContent") ?? "") || null,
        materialFileName: String(formData.get("materialFileName") ?? "") || null,
        materialFileUrl: String(formData.get("materialFileUrl") ?? "") || null,
        videoUrl: String(formData.get("videoUrl") ?? "") || null,
        issuerName: String(formData.get("issuerName") ?? "") || null,
        dueAt: String(formData.get("dueAt") ?? "") || null,
        requiresExam: formData.get("requiresExam") === "on",
        createsDocument: formData.get("createsDocument") === "on",
        createsSafetyCertificate: formData.get("createsSafetyCertificate") === "on",
      }),
    });
  } catch (error) {
    redirect(
      buildTrainingUrl(
        "/training",
        companyId,
        error instanceof Error ? error.message : "Не удалось назначить обучение.",
      ),
    );
  }

  revalidatePath("/training");
  revalidatePath("/my-training");
  redirect(buildTrainingUrl("/training", companyId));
}

export async function startMyTrainingAction(formData: FormData) {
  const assignmentId = String(formData.get("assignmentId") ?? "");

  try {
    await apiFetch(`training-assignments/${assignmentId}/start`, {
      method: "POST",
    });
  } catch (error) {
    redirect(
      buildTrainingUrl(
        `/my-training/${assignmentId}`,
        null,
        error instanceof Error ? error.message : "Не удалось открыть обучение.",
      ),
    );
  }

  revalidatePath("/my-training");
  revalidatePath(`/my-training/${assignmentId}`);
  redirect(`/my-training/${assignmentId}`);
}

export async function completeMyTrainingAction(formData: FormData) {
  const assignmentId = String(formData.get("assignmentId") ?? "");

  try {
    await apiFetch(`training-assignments/${assignmentId}/complete`, {
      method: "POST",
    });
  } catch (error) {
    redirect(
      buildTrainingUrl(
        `/my-training/${assignmentId}`,
        null,
        error instanceof Error ? error.message : "Не удалось завершить обучение.",
      ),
    );
  }

  revalidatePath("/my-training");
  revalidatePath(`/my-training/${assignmentId}`);
  revalidatePath("/my-testing");
  redirect(`/my-training/${assignmentId}`);
}
