"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "../lib/api";

function buildCertificatesUrl(companyId: string | null, error?: string) {
  const params = new URLSearchParams();

  if (companyId) {
    params.set("companyId", companyId);
  }

  if (error) {
    params.set("error", error);
  }

  const query = params.toString();
  return query
    ? `/certificates/biot-experimental?${query}`
    : "/certificates/biot-experimental";
}

export async function createSafetyCertificateAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "") || null;

  try {
    await apiFetch("safety-certificates", {
      method: "POST",
      body: JSON.stringify({
        companyId,
        employeeId: String(formData.get("employeeId") ?? ""),
        certificateNumber: String(formData.get("certificateNumber") ?? ""),
        issueDate: String(formData.get("issueDate") ?? ""),
        expiryDate: String(formData.get("expiryDate") ?? ""),
        issuerName: String(formData.get("issuerName") ?? ""),
        status: String(formData.get("status") ?? "ACTIVE"),
        fileName: String(formData.get("fileName") ?? "") || null,
        fileUrl: String(formData.get("fileUrl") ?? "") || null,
      }),
    });
  } catch (error) {
    redirect(
      buildCertificatesUrl(
        companyId,
        error instanceof Error ? error.message : "Не удалось создать удостоверение.",
      ),
    );
  }

  revalidatePath("/certificates");
  revalidatePath("/certificates/biot-experimental");
  revalidatePath("/my-certificates");
  redirect(buildCertificatesUrl(companyId));
}
