"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "../lib/api";
import { normalizeSafeReturnPath } from "../lib/safe-return-path";

function buildWorkSitesUrl(
  companyId: string | null,
  returnTo: string | null,
  error?: string,
) {
  const params = new URLSearchParams();

  if (companyId) {
    params.set("companyId", companyId);
  }

  if (returnTo) {
    params.set("returnTo", returnTo);
  }

  if (error) {
    params.set("error", error);
  }

  const query = params.toString();
  return query ? `/work-sites?${query}` : "/work-sites";
}

export async function createWorkSiteAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "") || null;
  const returnTo = normalizeSafeReturnPath(formData.get("returnTo"));

  try {
    await apiFetch("core-platform/work-sites", {
      method: "POST",
      body: JSON.stringify({
        organizationId: companyId,
        branchId: String(formData.get("branchId") ?? "") || null,
        code: String(formData.get("code") ?? "").trim(),
        name: String(formData.get("name") ?? "").trim(),
        location: String(formData.get("location") ?? "").trim() || null,
        isActive: true,
      }),
    });
  } catch (error) {
    redirect(
      buildWorkSitesUrl(
        companyId,
        returnTo,
        error instanceof Error ? error.message : "Не удалось создать рабочую площадку.",
      ),
    );
  }

  revalidatePath("/work-sites");
  revalidatePath("/protocols");
  revalidatePath("/orders/responsibility");
  revalidatePath("/permits");

  if (returnTo) {
    redirect(returnTo);
  }

  redirect(buildWorkSitesUrl(companyId, null));
}
