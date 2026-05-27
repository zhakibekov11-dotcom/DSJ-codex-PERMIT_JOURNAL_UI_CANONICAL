"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "../lib/api";

function buildComplianceUrl(
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
  return query ? `/compliance?${query}` : "/compliance";
}

function buildEmployeeCardUrl(
  employeeId: string,
  companyId: string | null,
  options?: {
    error?: string;
    success?: string;
    replaceDocumentId?: string | null;
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

  if (options?.replaceDocumentId) {
    params.set("replaceDocumentId", options.replaceDocumentId);
  }

  const query = params.toString();
  return query ? `/employees/${employeeId}?${query}` : `/employees/${employeeId}`;
}

function getStringArray(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .map((value) => String(value))
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function createPositionAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "") || null;

  try {
    await apiFetch("core-platform/positions", {
      method: "POST",
      body: JSON.stringify({
        organizationId: companyId,
        code: String(formData.get("code") ?? ""),
        name: String(formData.get("name") ?? ""),
        grade: String(formData.get("grade") ?? "") || null,
        isActive: formData.get("isActive") === "on",
      }),
    });
  } catch (error) {
    redirect(
      buildComplianceUrl(companyId, {
        error: error instanceof Error ? error.message : "Не удалось создать должность.",
      }),
    );
  }

  revalidatePath("/compliance");
  revalidatePath("/employees");
  redirect(
    buildComplianceUrl(companyId, {
      success: "Должность создана.",
    }),
  );
}

export async function createComplianceDocumentTypeAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "") || null;

  try {
    await apiFetch("core-platform/document-types", {
      method: "POST",
      body: JSON.stringify({
        organizationId: companyId,
        code: String(formData.get("code") ?? ""),
        name: String(formData.get("name") ?? ""),
        category: String(formData.get("category") ?? "DOCUMENT"),
        description: String(formData.get("description") ?? "") || null,
        defaultValidityDays: Number(formData.get("defaultValidityDays") ?? 0) || null,
        requiresExpiry: formData.get("requiresExpiry") === "on",
        requiresVerification: formData.get("requiresVerification") === "on",
        isActive: formData.get("isActive") === "on",
      }),
    });
  } catch (error) {
    redirect(
      buildComplianceUrl(companyId, {
          error:
          error instanceof Error ? error.message : "Не удалось создать тип документа.",
      }),
    );
  }

  revalidatePath("/compliance");
  redirect(
    buildComplianceUrl(companyId, {
      success: "Тип документа создан.",
    }),
  );
}

export async function createRetentionPolicyAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "") || null;

  try {
    await apiFetch("core-platform/retention-policies", {
      method: "POST",
      body: JSON.stringify({
        organizationId: companyId,
        retentionCode: String(formData.get("retentionCode") ?? ""),
        documentKind: String(formData.get("documentKind") ?? "EMPLOYEE_DOCUMENT"),
        scopeType: String(formData.get("scopeType") ?? "ORGANIZATION"),
        retentionValue: Number(formData.get("retentionValue") ?? 0),
        retentionUnit: String(formData.get("retentionUnit") ?? "YEARS"),
        archiveFormat: String(formData.get("archiveFormat") ?? "PDF_A_1"),
        legalBasis: String(formData.get("legalBasis") ?? ""),
        holdAllowed: formData.get("holdAllowed") === "on",
        destructionApprovalRequired:
          formData.get("destructionApprovalRequired") === "on",
        effectiveFrom: String(formData.get("effectiveFrom") ?? ""),
        effectiveTo: String(formData.get("effectiveTo") ?? "") || null,
        description: String(formData.get("description") ?? "") || null,
      }),
    });
  } catch (error) {
    redirect(
      buildComplianceUrl(companyId, {
          error:
          error instanceof Error ? error.message : "Не удалось создать правило хранения.",
      }),
    );
  }

  revalidatePath("/compliance");
  redirect(
    buildComplianceUrl(companyId, {
      success: "Правило хранения создано.",
    }),
  );
}

export async function createComplianceMatrixAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "") || null;
  const positionId = String(formData.get("positionId") ?? "") || null;

  if (!positionId) {
    redirect(
      buildComplianceUrl(companyId, {
        error: "Для матрицы нужна должность.",
      }),
    );
  }

  try {
    const matrix = await apiFetch<{
      id: string;
    }>("core-platform/job-requirement-matrices", {
      method: "POST",
      body: JSON.stringify({
        organizationId: companyId,
        positionId,
        matrixCode: String(formData.get("matrixCode") ?? ""),
        status: "DRAFT",
        effectiveFrom: String(formData.get("effectiveFrom") ?? "") || null,
        effectiveTo: String(formData.get("effectiveTo") ?? "") || null,
      }),
    });

    await apiFetch("core-platform/job-requirement-matrix-versions", {
      method: "POST",
      body: JSON.stringify({
        matrixId: matrix.id,
        status: "ACTIVE",
        effectiveFrom: String(formData.get("effectiveFrom") ?? "") || null,
        effectiveTo: String(formData.get("effectiveTo") ?? "") || null,
        payloadJson: {
          requiredDocuments: getStringArray(formData, "requiredDocumentIds").map(
            (documentTypeId) => ({
              documentTypeId,
            }),
          ),
          requiredTrainings: getStringArray(formData, "requiredTrainingIds").map(
            (documentTypeId) => ({
              documentTypeId,
            }),
          ),
          requiredInstructions: getStringArray(
            formData,
            "requiredInstructionIds",
          ).map((documentTypeId) => ({
            documentTypeId,
          })),
          notes: String(formData.get("notes") ?? "") || null,
        },
      }),
    });
  } catch (error) {
    redirect(
      buildComplianceUrl(companyId, {
          error:
          error instanceof Error ? error.message : "Не удалось создать матрицу требований.",
      }),
    );
  }

  revalidatePath("/compliance");
  revalidatePath("/employees");
  redirect(
    buildComplianceUrl(companyId, {
      success: "Матрица требований создана.",
    }),
  );
}

export async function createEmployeeComplianceDocumentAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "") || null;
  const employeeId = String(formData.get("employeeId") ?? "");

  if (!employeeId) {
    redirect(
      buildComplianceUrl(companyId, {
        error: "Employee is required for document registration.",
      }),
    );
  }

  try {
    await apiFetch("employee-documents", {
      method: "POST",
      body: JSON.stringify({
        companyId,
        employeeId,
        title: String(formData.get("title") ?? ""),
        documentNumber: String(formData.get("documentNumber") ?? "") || null,
        documentTypeDefinitionId:
          String(formData.get("documentTypeDefinitionId") ?? "") || null,
        documentType: "CERTIFICATE",
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
      buildEmployeeCardUrl(employeeId, companyId, {
        error:
          error instanceof Error
            ? error.message
            : "Failed to register employee document.",
      }),
    );
  }

  revalidatePath("/employees");
  revalidatePath(`/employees/${employeeId}`);
  redirect(
    buildEmployeeCardUrl(employeeId, companyId, {
      success: "Employee document registered.",
    }),
  );
}

export async function verifyEmployeeDocumentAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "") || null;
  const employeeId = String(formData.get("employeeId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");

  if (!employeeId || !documentId) {
    redirect(
      buildComplianceUrl(companyId, {
        error: "Employee document verification request is incomplete.",
      }),
    );
  }

  try {
    await apiFetch(`employee-documents/${documentId}/verify`, {
      method: "POST",
      body: JSON.stringify({
        verificationStatus: String(formData.get("verificationStatus") ?? "VERIFIED"),
        verificationNotes: String(formData.get("verificationNotes") ?? "") || null,
      }),
    });
  } catch (error) {
    redirect(
      buildEmployeeCardUrl(employeeId, companyId, {
        error:
          error instanceof Error
            ? error.message
            : "Failed to verify employee document.",
      }),
    );
  }

  revalidatePath(`/employees/${employeeId}`);
  redirect(
    buildEmployeeCardUrl(employeeId, companyId, {
      success: "Employee document verification updated.",
    }),
  );
}

export async function prepareEmployeeDocumentForSigningAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "") || null;
  const employeeId = String(formData.get("employeeId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");

  if (!employeeId || !documentId) {
    redirect(
      buildComplianceUrl(companyId, {
        error: "Employee document prepare-sign request is incomplete.",
      }),
    );
  }

  try {
    await apiFetch(`employee-documents/${documentId}/prepare-sign`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  } catch (error) {
    redirect(
      buildEmployeeCardUrl(employeeId, companyId, {
        error:
          error instanceof Error
            ? error.message
            : "Failed to prepare employee document for signing.",
      }),
    );
  }

  revalidatePath("/employees");
  revalidatePath(`/employees/${employeeId}`);
  redirect(
    buildEmployeeCardUrl(employeeId, companyId, {
      success: "Employee document is prepared for signing.",
    }),
  );
}

export async function annulEmployeeDocumentAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "") || null;
  const employeeId = String(formData.get("employeeId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");
  const reason = String(formData.get("reason") ?? "") || null;

  if (!employeeId || !documentId) {
    redirect(
      buildComplianceUrl(companyId, {
        error: "Employee document annul request is incomplete.",
      }),
    );
  }

  try {
    await apiFetch(`employee-documents/${documentId}/annul`, {
      method: "POST",
      body: JSON.stringify({
        reason,
      }),
    });
  } catch (error) {
    redirect(
      buildEmployeeCardUrl(employeeId, companyId, {
        error:
          error instanceof Error ? error.message : "Failed to annul employee document.",
      }),
    );
  }

  revalidatePath("/employees");
  revalidatePath(`/employees/${employeeId}`);
  redirect(
    buildEmployeeCardUrl(employeeId, companyId, {
      success: "Employee document was annulled.",
    }),
  );
}

export async function replaceEmployeeDocumentAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "") || null;
  const employeeId = String(formData.get("employeeId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");

  if (!employeeId || !documentId) {
    redirect(
      buildComplianceUrl(companyId, {
        error: "Employee document replacement request is incomplete.",
      }),
    );
  }

  try {
    await apiFetch(`employee-documents/${documentId}/replace`, {
      method: "POST",
      body: JSON.stringify({
        title: String(formData.get("title") ?? ""),
        documentNumber: String(formData.get("documentNumber") ?? "") || null,
        documentTypeDefinitionId:
          String(formData.get("documentTypeDefinitionId") ?? "") || null,
        documentType: "CERTIFICATE",
        issueDate: String(formData.get("issueDate") ?? ""),
        expiryDate: String(formData.get("expiryDate") ?? "") || null,
        issuerName: String(formData.get("issuerName") ?? ""),
        status: String(formData.get("status") ?? "ACTIVE"),
        fileName: String(formData.get("fileName") ?? "") || null,
        fileUrl: String(formData.get("fileUrl") ?? "") || null,
        reason: String(formData.get("reason") ?? "") || null,
      }),
    });
  } catch (error) {
    redirect(
      buildEmployeeCardUrl(employeeId, companyId, {
        error:
          error instanceof Error
            ? error.message
            : "Failed to replace employee document.",
        replaceDocumentId: documentId,
      }),
    );
  }

  revalidatePath("/employees");
  revalidatePath(`/employees/${employeeId}`);
  redirect(
    buildEmployeeCardUrl(employeeId, companyId, {
      success: "Employee document replacement was created.",
    }),
  );
}

export async function recalculateEmployeeAdmissionAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "") || null;
  const employeeId = String(formData.get("employeeId") ?? "");

  if (!employeeId) {
    redirect(
      buildComplianceUrl(companyId, {
        error: "Employee is not selected.",
      }),
    );
  }

  try {
    await apiFetch(`employees/${employeeId}/recalculate-admission`, {
      method: "POST",
    });
  } catch (error) {
    redirect(
      buildEmployeeCardUrl(employeeId, companyId, {
        error:
          error instanceof Error
            ? error.message
            : "Failed to recalculate employee admission.",
      }),
    );
  }

  revalidatePath("/employees");
  revalidatePath(`/employees/${employeeId}`);
  redirect(
    buildEmployeeCardUrl(employeeId, companyId, {
      success: "Admission status was recalculated.",
    }),
  );
}
