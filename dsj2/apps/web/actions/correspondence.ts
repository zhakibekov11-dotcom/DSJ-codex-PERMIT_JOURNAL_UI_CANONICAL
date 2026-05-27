"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "../lib/api";

function buildCorrespondenceUrl(companyId: string | null, error?: string, success?: string) {
  const params = new URLSearchParams();

  if (companyId) {
    params.set("companyId", companyId);
  }

  if (error) {
    params.set("error", error);
  }

  if (success) {
    params.set("success", success);
  }

  const query = params.toString();
  return query ? `/correspondence?${query}` : "/correspondence";
}

function parseRecipients(rawValue: FormDataEntryValue | null) {
  if (typeof rawValue !== "string" || !rawValue.trim().length) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as Array<{
      companyName?: string;
      contactName?: string;
      contactEmail?: string | null;
      contactPosition?: string | null;
    }>;

    return parsed
      .map((recipient) => ({
        companyName: recipient.companyName?.trim() ?? "",
        contactName: recipient.contactName?.trim() ?? "",
        contactEmail: recipient.contactEmail?.trim() || null,
        contactPosition: recipient.contactPosition?.trim() || null,
      }))
      .filter((recipient) => recipient.companyName.length > 0 && recipient.contactName.length > 0);
  } catch {
    return [];
  }
}

export async function createCorrespondenceAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "") || null;

  try {
    await apiFetch("correspondence", {
      method: "POST",
      body: JSON.stringify({
        companyId,
        title: String(formData.get("title") ?? ""),
        kind: String(formData.get("kind") ?? "LETTER"),
        subject: String(formData.get("subject") ?? ""),
        body: String(formData.get("body") ?? ""),
        recipients: parseRecipients(formData.get("recipientsJson")),
      }),
    });
  } catch (error) {
    redirect(
      buildCorrespondenceUrl(
        companyId,
        error instanceof Error ? error.message : "Не удалось создать письмо.",
      ),
    );
  }

  revalidatePath("/correspondence");
  redirect(buildCorrespondenceUrl(companyId, undefined, "Письмо сохранено в реестре."));
}

export async function sendCorrespondenceAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "") || null;
  const correspondenceId = String(formData.get("correspondenceId") ?? "");

  try {
    await apiFetch(`correspondence/${correspondenceId}/send`, {
      method: "POST",
    });
  } catch (error) {
    redirect(
      buildCorrespondenceUrl(
        companyId,
        error instanceof Error ? error.message : "Не удалось отправить письмо.",
      ),
    );
  }

  revalidatePath("/correspondence");
  redirect(buildCorrespondenceUrl(companyId, undefined, "Отправка по реестру выполнена."));
}
