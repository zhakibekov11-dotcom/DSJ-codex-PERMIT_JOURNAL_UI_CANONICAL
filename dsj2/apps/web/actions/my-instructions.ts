"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "../lib/api";
import { readSigningInput } from "../lib/signing-payload";

function buildMyInstructionUrl(pathname: string, error?: string) {
  const params = new URLSearchParams();

  if (error) {
    params.set("error", error);
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export async function openMyInstructionAction(formData: FormData) {
  const briefingId = String(formData.get("briefingId") ?? "");

  try {
    await apiFetch(`briefing-records/${briefingId}/open`, {
      method: "POST",
    });
  } catch (error) {
    redirect(
      buildMyInstructionUrl(
        "/my-instructions",
        error instanceof Error ? error.message : "Не удалось открыть инструктаж.",
      ),
    );
  }

  revalidatePath("/my-instructions");
  revalidatePath(`/my-instructions/${briefingId}`);
  redirect(`/my-instructions/${briefingId}`);
}

export async function acknowledgeMyInstructionAction(formData: FormData) {
  const briefingId = String(formData.get("briefingId") ?? "");

  try {
    await apiFetch(`briefing-records/${briefingId}/acknowledge`, {
      method: "POST",
    });
  } catch (error) {
    redirect(
      buildMyInstructionUrl(
        `/my-instructions/${briefingId}`,
        error instanceof Error ? error.message : "Не удалось подтвердить ознакомление.",
      ),
    );
  }

  revalidatePath("/my-instructions");
  revalidatePath(`/my-instructions/${briefingId}`);
  revalidatePath(`/journal/${briefingId}`);
  redirect(`/my-instructions/${briefingId}`);
}

export async function signMyInstructionAction(formData: FormData) {
  const briefingId = String(formData.get("briefingId") ?? "");

  try {
    const signingInput = readSigningInput(formData);

    await apiFetch(
      `signatures/briefing-records/${briefingId}/sign`,
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
      buildMyInstructionUrl(
        `/my-instructions/${briefingId}`,
        error instanceof Error ? error.message : "Не удалось подписать инструктаж.",
      ),
    );
  }

  revalidatePath("/my-instructions");
  revalidatePath(`/my-instructions/${briefingId}`);
  revalidatePath(`/journal/${briefingId}`);
  redirect(`/my-instructions/${briefingId}`);
}
