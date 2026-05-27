"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { apiFetch } from "../lib/api";

const ALLOWED_EMPLOYEE_PHOTO_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_EMPLOYEE_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;

function buildEmployeesRedirectUrl(companyId: string | null, error?: string) {
  const params = new URLSearchParams();

  if (companyId) {
    params.set("companyId", companyId);
  }

  if (error) {
    params.set("error", error);
  }

  const query = params.toString();
  return query ? `/employees?${query}` : "/employees";
}

function buildEmployeesSuccessUrl(companyId: string | null, success?: string) {
  const params = new URLSearchParams();

  if (companyId) {
    params.set("companyId", companyId);
  }

  if (success) {
    params.set("success", success);
  }

  const query = params.toString();
  return query ? `/employees?${query}` : "/employees";
}

function buildEditEmployeeUrl(employeeId: string, companyId: string | null, error?: string) {
  const params = new URLSearchParams();

  if (companyId) {
    params.set("companyId", companyId);
  }

  if (error) {
    params.set("error", error);
  }

  const query = params.toString();
  return query ? `/employees/${employeeId}/edit?${query}` : `/employees/${employeeId}/edit`;
}

function buildNewEmployeeUrl(companyId: string | null, error?: string) {
  const params = new URLSearchParams();

  if (companyId) {
    params.set("companyId", companyId);
  }

  if (error) {
    params.set("error", error);
  }

  const query = params.toString();
  return query ? `/employees/new?${query}` : "/employees/new";
}

function toJpegFileName(value: string) {
  return value.replace(/\.[^.]+$/u, "") + ".jpg";
}

async function processEmployeePhoto(formData: FormData) {
  const fileValue = formData.get("employeePhoto");

  if (!(fileValue instanceof File) || fileValue.size === 0) {
    return null;
  }

  const normalizedType = fileValue.type.toLowerCase();
  if (!ALLOWED_EMPLOYEE_PHOTO_TYPES.has(normalizedType)) {
    throw new Error("Для фото сотрудника подходят только файлы JPG или PNG.");
  }

  if (fileValue.size > MAX_EMPLOYEE_PHOTO_SIZE_BYTES) {
    throw new Error("Фото сотрудника должно быть не больше 10 МБ.");
  }

  const sourceBuffer = Buffer.from(await fileValue.arrayBuffer());
  const processedBuffer = await sharp(sourceBuffer)
    .rotate()
    .resize(180, 240, {
      fit: "cover",
      position: "centre",
    })
    .jpeg({ quality: 82 })
    .toBuffer();

  return {
    photoDataUrl: `data:image/jpeg;base64,${processedBuffer.toString("base64")}`,
    photoFileName: toJpegFileName(fileValue.name),
  };
}

export async function createEmployeeAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "") || null;
  let processedPhoto: Awaited<ReturnType<typeof processEmployeePhoto>> = null;

  try {
    processedPhoto = await processEmployeePhoto(formData);
    await apiFetch("employees", {
      method: "POST",
      body: JSON.stringify({
        companyId,
        fullName: String(formData.get("fullName") ?? ""),
        iin: String(formData.get("iin") ?? ""),
        employeeNumber: String(formData.get("employeeNumber") ?? ""),
        jobTitle: String(formData.get("jobTitle") ?? ""),
        jobTitleKz: String(formData.get("jobTitleKz") ?? ""),
        photoDataUrl: processedPhoto?.photoDataUrl ?? null,
        photoFileName: processedPhoto?.photoFileName ?? null,
        departmentId: String(formData.get("departmentId") ?? "") || null,
        positionId: String(formData.get("positionId") ?? "") || null,
        contractorCompanyId: String(formData.get("contractorCompanyId") ?? "") || null,
        email: String(formData.get("email") ?? "") || null,
        phone: String(formData.get("phone") ?? "") || null,
        employeeKind: String(formData.get("employeeKind") ?? "INTERNAL"),
        status: String(formData.get("status") ?? "active"),
        createAccount: formData.get("createAccount") === "on",
        accountPassword: String(formData.get("accountPassword") ?? "") || null,
      }),
    });
  } catch (error) {
    redirect(
      buildNewEmployeeUrl(
        companyId,
        error instanceof Error ? error.message : "Не удалось создать сотрудника.",
      ),
    );
  }

  revalidatePath("/employees");
  revalidatePath("/employees/new");
  redirect(buildEmployeesSuccessUrl(companyId, "Сотрудник создан."));
}

export async function archiveEmployeeAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "") || null;
  const employeeId = String(formData.get("employeeId") ?? "");

  if (!employeeId) {
    redirect(buildEmployeesRedirectUrl(companyId, "Не выбран сотрудник для увольнения."));
  }

  try {
    await apiFetch(`employees/${employeeId}/archive`, {
      method: "POST",
      body: JSON.stringify({
        companyId,
      }),
    });
  } catch (error) {
    redirect(
      buildEmployeesRedirectUrl(
        companyId,
        error instanceof Error ? error.message : "Не удалось уволить сотрудника.",
      ),
    );
  }

  revalidatePath("/employees");
  redirect(buildEmployeesSuccessUrl(companyId, "Сотрудник переведен в архив и убран из активного списка."));
}

export async function updateEmployeeAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "") || null;
  const employeeId = String(formData.get("employeeId") ?? "");

  if (!employeeId) {
    redirect(buildEmployeesRedirectUrl(companyId, "Не выбран сотрудник для редактирования."));
  }

  try {
    const processedPhoto = await processEmployeePhoto(formData);
    await apiFetch(`employees/${employeeId}`, {
      method: "PATCH",
      body: JSON.stringify({
        companyId,
        fullName: String(formData.get("fullName") ?? "") || undefined,
        iin: String(formData.get("iin") ?? "") || undefined,
        employeeNumber: String(formData.get("employeeNumber") ?? "") || undefined,
        jobTitle: String(formData.get("jobTitle") ?? "") || undefined,
        jobTitleKz: String(formData.get("jobTitleKz") ?? "") || undefined,
        photoDataUrl: processedPhoto?.photoDataUrl,
        photoFileName: processedPhoto?.photoFileName,
        removePhoto: formData.get("removePhoto") === "on",
        departmentId: String(formData.get("departmentId") ?? "") || null,
        positionId: String(formData.get("positionId") ?? "") || null,
        contractorCompanyId: String(formData.get("contractorCompanyId") ?? "") || null,
        email: String(formData.get("email") ?? "") || null,
        phone: String(formData.get("phone") ?? "") || null,
        employeeKind: String(formData.get("employeeKind") ?? "") || undefined,
        status: String(formData.get("status") ?? "") || undefined,
        createAccount: formData.get("createAccount") === "on",
        accountPassword: String(formData.get("accountPassword") ?? "") || null,
      }),
    });
  } catch (error) {
    redirect(
      buildEditEmployeeUrl(
        employeeId,
        companyId,
        error instanceof Error ? error.message : "Не удалось обновить сотрудника.",
      ),
    );
  }

  revalidatePath("/employees");
  revalidatePath(`/employees/${employeeId}/edit`);
  redirect(buildEmployeesSuccessUrl(companyId, "Данные сотрудника обновлены."));
}
