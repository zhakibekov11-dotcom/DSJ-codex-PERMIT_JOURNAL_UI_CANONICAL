"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "../lib/api";

export async function createDepartmentAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "") || null;

  await apiFetch("departments", {
    method: "POST",
    body: JSON.stringify({
      companyId,
      name: String(formData.get("name") ?? ""),
      code: String(formData.get("code") ?? "") || null,
    }),
  });

  revalidatePath("/departments");
  redirect(companyId ? `/departments?companyId=${companyId}` : "/departments");
}
