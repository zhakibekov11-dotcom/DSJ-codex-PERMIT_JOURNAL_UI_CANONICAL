"use server";

import { redirect } from "next/navigation";
import { apiFetch } from "../lib/api";
import { readSigningInput } from "../lib/signing-payload";

function buildInviteUrl(token: string, error?: string, success?: boolean) {
  const params = new URLSearchParams();

  if (error) {
    params.set("error", error);
  }

  if (success) {
    params.set("success", "1");
  }

  const query = params.toString();
  return query ? `/invite/${token}?${query}` : `/invite/${token}`;
}

export async function publicInviteSignAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");

  try {
    const signingInput = readSigningInput(formData);

    await apiFetch(
      `signatures/public/briefing-invites/${token}/sign`,
      {
        method: "POST",
        body: JSON.stringify(signingInput ?? {}),
      },
      {
        auth: false,
      },
    );
  } catch (error) {
    redirect(
      buildInviteUrl(
        token,
        error instanceof Error ? error.message : "Не удалось завершить регистрацию и подписание.",
      ),
    );
  }

  redirect(buildInviteUrl(token, undefined, true));
}
