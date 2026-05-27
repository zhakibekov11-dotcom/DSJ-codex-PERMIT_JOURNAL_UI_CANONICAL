"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "../lib/api";
import { readSigningInput } from "../lib/signing-payload";

function buildMyDocumentUrl(pathname: string, error?: string) {
  const params = new URLSearchParams();

  if (error) {
    params.set("error", error);
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export async function signMyEmployeeDocumentAction(formData: FormData) {
  const documentId = String(formData.get("documentId") ?? "");

  try {
    const signingInput = readSigningInput(formData);

    await apiFetch(
      `employee-documents/${documentId}/sign`,
      signingInput
        ? {
            method: "POST",
            body: JSON.stringify(signingInput),
          }
        : {
            method: "POST",
          },
    );
  } catch (error) {
    redirect(
      buildMyDocumentUrl(
        `/my-documents/${documentId}`,
        error instanceof Error ? error.message : "Не удалось подписать документ.",
      ),
    );
  }

  revalidatePath("/my-documents");
  revalidatePath(`/my-documents/${documentId}`);
  redirect(`/my-documents/${documentId}`);
}
