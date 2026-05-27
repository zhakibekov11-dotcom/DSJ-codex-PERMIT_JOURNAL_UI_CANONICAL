"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "../lib/api";

function buildContractorsRedirectUrl(args: {
  companyId: string | null;
  error?: string;
  editId?: string | null;
}) {
  const params = new URLSearchParams();

  if (args.companyId) {
    params.set("companyId", args.companyId);
  }

  if (args.editId) {
    params.set("edit", args.editId);
  }

  if (args.error) {
    params.set("error", args.error);
  }

  const query = params.toString();
  return query ? `/contractors?${query}` : "/contractors";
}

function readContractorPayload(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    bin: String(formData.get("bin") ?? "") || null,
    contactEmail: String(formData.get("contactEmail") ?? "") || null,
    contactPhone: String(formData.get("contactPhone") ?? "") || null,
    notes: String(formData.get("notes") ?? "") || null,
  };
}

export async function createContractorCompanyAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "") || null;

  try {
    await apiFetch("contractor-companies", {
      method: "POST",
      body: JSON.stringify({
        companyId,
        ...readContractorPayload(formData),
      }),
    });
  } catch (error) {
    redirect(
      buildContractorsRedirectUrl({
        companyId,
        error:
          error instanceof Error
            ? error.message
            : "Не удалось добавить подрядную организацию.",
      }),
    );
  }

  revalidatePath("/contractors");
  revalidatePath("/employees");
  redirect(buildContractorsRedirectUrl({ companyId }));
}

export async function updateContractorCompanyAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "") || null;
  const contractorCompanyId =
    String(formData.get("contractorCompanyId") ?? "") || null;
  const isActive = String(formData.get("isActive") ?? "true") === "true";

  if (!contractorCompanyId) {
    redirect(
      buildContractorsRedirectUrl({
        companyId,
        error: "Не удалось определить подрядную организацию для редактирования.",
      }),
    );
  }

  try {
    await apiFetch(`contractor-companies/${contractorCompanyId}`, {
      method: "PATCH",
      body: JSON.stringify({
        companyId,
        isActive,
        ...readContractorPayload(formData),
      }),
    });
  } catch (error) {
    redirect(
      buildContractorsRedirectUrl({
        companyId,
        editId: contractorCompanyId,
        error:
          error instanceof Error
            ? error.message
            : "Не удалось обновить подрядную организацию.",
      }),
    );
  }

  revalidatePath("/contractors");
  revalidatePath("/employees");
  redirect(buildContractorsRedirectUrl({ companyId }));
}

export async function deleteContractorCompanyAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "") || null;
  const contractorCompanyId =
    String(formData.get("contractorCompanyId") ?? "") || null;

  if (!contractorCompanyId) {
    redirect(
      buildContractorsRedirectUrl({
        companyId,
        error: "Не удалось определить подрядную организацию для удаления.",
      }),
    );
  }

  try {
    const query = new URLSearchParams();

    if (companyId) {
      query.set("companyId", companyId);
    }

    await apiFetch(
      `contractor-companies/${contractorCompanyId}${query.toString() ? `?${query.toString()}` : ""}`,
      {
        method: "DELETE",
      },
    );
  } catch (error) {
    redirect(
      buildContractorsRedirectUrl({
        companyId,
        error:
          error instanceof Error
            ? error.message
            : "Не удалось удалить подрядную организацию.",
      }),
    );
  }

  revalidatePath("/contractors");
  revalidatePath("/employees");
  redirect(buildContractorsRedirectUrl({ companyId }));
}
