"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "../lib/api";

function buildDocumentsUrl(
  companyId: string | null,
  options?: {
    error?: string;
    success?: string;
  },
) {
  const params = new URLSearchParams();

  if (companyId) {
    params.set("companyId", companyId);
  }

  if (options?.error) {
    params.set("error", options.error);
  }

  if (options?.success) {
    params.set("success", options.success);
  }

  const query = params.toString();
  return query ? `/documents?${query}` : "/documents";
}

export async function createEmployeeDocumentAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "") || null;

  try {
    await apiFetch("employee-documents", {
      method: "POST",
      body: JSON.stringify({
        companyId,
        employeeId: String(formData.get("employeeId") ?? ""),
        title: String(formData.get("title") ?? ""),
        documentType: String(formData.get("documentType") ?? "CERTIFICATE"),
        issueDate: String(formData.get("issueDate") ?? ""),
        expiryDate: String(formData.get("expiryDate") ?? "") || null,
        issuerName: String(formData.get("issuerName") ?? ""),
        status: String(formData.get("status") ?? "ACTIVE"),
        fileName: String(formData.get("fileName") ?? "") || null,
        fileUrl: String(formData.get("fileUrl") ?? "") || null,
      }),
    });
  } catch (error) {
    redirect(
      buildDocumentsUrl(
        companyId,
        {
          error:
            error instanceof Error
              ? error.message
              : "Не удалось создать документ сотрудника.",
        },
      ),
    );
  }

  revalidatePath("/documents");
  revalidatePath("/my-documents");
  redirect(buildDocumentsUrl(companyId));
}

export async function createCompanyDocumentAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "") || null;

  try {
    await apiFetch("company-documents", {
      method: "POST",
      body: JSON.stringify({
        companyId,
        category: String(formData.get("category") ?? "LOCAL_ACT"),
        documentName: String(formData.get("documentName") ?? ""),
        title: String(formData.get("title") ?? ""),
        summary: String(formData.get("summary") ?? "") || null,
        body: String(formData.get("body") ?? ""),
        issueDate: String(formData.get("issueDate") ?? "") || null,
        status: String(formData.get("status") ?? "DRAFT"),
      }),
    });
  } catch (error) {
    redirect(
      buildDocumentsUrl(companyId, {
        error:
          error instanceof Error
            ? error.message
            : "Не удалось добавить документ компании.",
      }),
    );
  }

  revalidatePath("/documents");
  redirect(
    buildDocumentsUrl(companyId, {
      success: "Документ добавлен в реестр.",
    }),
  );
}
