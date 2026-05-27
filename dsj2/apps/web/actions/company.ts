"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "../lib/api";

export async function createCompanyAction(formData: FormData) {
  await apiFetch("companies", {
    method: "POST",
    body: JSON.stringify({
      name: String(formData.get("name") ?? ""),
      bin: String(formData.get("bin") ?? "") || null,
      industry: String(formData.get("industry") ?? "") || null,
      timezone: String(formData.get("timezone") ?? "Asia/Almaty"),
      responsibleFullName: String(formData.get("responsibleFullName") ?? ""),
      responsibleEmail: String(formData.get("responsibleEmail") ?? ""),
      responsiblePassword: String(formData.get("responsiblePassword") ?? ""),
    }),
  });

  revalidatePath("/companies");
  redirect("/companies");
}

export async function deleteCompanyAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "").trim();

  if (!companyId) {
    throw new Error("Не удалось определить компанию для удаления.");
  }

  await apiFetch(`companies/${companyId}`, {
    method: "DELETE",
  });

  revalidatePath("/companies");
  redirect("/companies");
}
