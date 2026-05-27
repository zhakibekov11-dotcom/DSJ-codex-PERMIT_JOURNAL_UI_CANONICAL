"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "../lib/api";
import { readSigningInput } from "../lib/signing-payload";

function firstString(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function optionalString(formData: FormData, name: string) {
  const value = firstString(formData, name);
  return value.length ? value : null;
}

function getAppointments(formData: FormData) {
  const employeeIds = formData
    .getAll("appointmentEmployeeId")
    .map((value) => String(value).trim());
  const effectiveFrom = formData
    .getAll("appointmentEffectiveFrom")
    .map((value) => String(value).trim());
  const effectiveTo = formData
    .getAll("appointmentEffectiveTo")
    .map((value) => String(value).trim());
  const zoneOfResponsibility = formData
    .getAll("appointmentZoneOfResponsibility")
    .map((value) => String(value).trim());
  const roleNotes = formData
    .getAll("appointmentRoleNotes")
    .map((value) => String(value).trim());

  return employeeIds
    .map((employeeId, index) => ({
      employeeId,
      effectiveFrom: effectiveFrom[index] ?? "",
      effectiveTo: effectiveTo[index]?.length ? effectiveTo[index] : null,
      zoneOfResponsibility: zoneOfResponsibility[index]?.length
        ? zoneOfResponsibility[index]
        : null,
      roleNotes: roleNotes[index]?.length ? roleNotes[index] : null,
    }))
    .filter((appointment) => appointment.employeeId.length > 0);
}

function getResponsibilityOrderPayload(formData: FormData) {
  return {
    organizationId: optionalString(formData, "companyId"),
    number: firstString(formData, "number"),
    date: firstString(formData, "date"),
    responsibilityType: firstString(formData, "responsibilityType"),
    title: firstString(formData, "title"),
    basis: firstString(formData, "basis"),
    branchId: optionalString(formData, "branchId"),
    departmentId: optionalString(formData, "departmentId"),
    workSiteId: optionalString(formData, "workSiteId"),
    notes: optionalString(formData, "notes"),
    appointments: getAppointments(formData),
    status: "DRAFT" as const,
  };
}

function buildRegistryUrl(
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
  return query ? `/orders/responsibility?${query}` : "/orders/responsibility";
}

function buildViewUrl(
  orderId: string,
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
  return query ? `/orders/responsibility/${orderId}?${query}` : `/orders/responsibility/${orderId}`;
}

function buildDraftUrl(
  pathname: string,
  companyId: string | null,
  options?: {
    error?: string;
    replaceOrderId?: string | null;
  },
) {
  const params = new URLSearchParams();

  if (companyId) {
    params.set("companyId", companyId);
  }

  if (options?.replaceOrderId) {
    params.set("replaceOrderId", options.replaceOrderId);
  }

  if (options?.error) {
    params.set("error", options.error);
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function revalidateResponsibilityOrderViews(orderId?: string) {
  revalidatePath("/orders/responsibility");
  revalidatePath("/employees");
  revalidatePath("/my-instructions");

  if (orderId) {
    revalidatePath(`/orders/responsibility/${orderId}`);
    revalidatePath(`/orders/responsibility/${orderId}/edit`);
    revalidatePath(`/orders/responsibility/${orderId}/sign`);
  }
}

export async function createOrReplaceResponsibilityOrderAction(formData: FormData) {
  const companyId = optionalString(formData, "companyId");
  const replaceOrderId = optionalString(formData, "replaceOrderId");
  const payload = getResponsibilityOrderPayload(formData);

  try {
    if (replaceOrderId) {
      const created = await apiFetch<{ id: string }>(`responsibility-orders/${replaceOrderId}/replace`, {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          reason: optionalString(formData, "reason"),
        }),
      });

      revalidateResponsibilityOrderViews(created.id);
      redirect(
        buildViewUrl(created.id, companyId, {
          success: "Replacement responsibility order draft was created.",
        }),
      );
    }

    const created = await apiFetch<{ id: string }>("responsibility-orders", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    revalidateResponsibilityOrderViews(created.id);
    redirect(
      buildViewUrl(created.id, companyId, {
        success: "Draft responsibility order was created.",
      }),
    );
  } catch (error) {
    redirect(
      buildDraftUrl("/orders/responsibility/new", companyId, {
        error:
          error instanceof Error ? error.message : "Failed to save responsibility order draft.",
        replaceOrderId,
      }),
    );
  }
}

export async function updateResponsibilityOrderAction(formData: FormData) {
  const orderId = firstString(formData, "orderId");
  const companyId = optionalString(formData, "companyId");

  try {
    await apiFetch(`responsibility-orders/${orderId}`, {
      method: "PATCH",
      body: JSON.stringify(getResponsibilityOrderPayload(formData)),
    });
  } catch (error) {
    redirect(
      buildDraftUrl(`/orders/responsibility/${orderId}/edit`, companyId, {
        error:
          error instanceof Error ? error.message : "Failed to update responsibility order draft.",
      }),
    );
  }

  revalidateResponsibilityOrderViews(orderId);
  redirect(
    buildViewUrl(orderId, companyId, {
      success: "Draft responsibility order was updated.",
    }),
  );
}

export async function prepareResponsibilityOrderForSigningAction(formData: FormData) {
  const orderId = firstString(formData, "orderId");
  const companyId = optionalString(formData, "companyId");

  try {
    await apiFetch(`responsibility-orders/${orderId}/prepare-sign`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  } catch (error) {
    redirect(
      buildViewUrl(orderId, companyId, {
        error:
          error instanceof Error
            ? error.message
            : "Failed to prepare responsibility order for signing.",
      }),
    );
  }

  revalidateResponsibilityOrderViews(orderId);
  redirect(
    buildViewUrl(orderId, companyId, {
      success: "Responsibility order is prepared for signing.",
    }),
  );
}

export async function signResponsibilityOrderAction(formData: FormData) {
  const orderId = firstString(formData, "orderId");
  const companyId = optionalString(formData, "companyId");

  try {
    const signingInput = readSigningInput(formData);

    await apiFetch(`responsibility-orders/${orderId}/sign`, {
      method: "POST",
      body: JSON.stringify(signingInput ?? {}),
    });
  } catch (error) {
    redirect(
      buildDraftUrl(`/orders/responsibility/${orderId}/sign`, companyId, {
        error: error instanceof Error ? error.message : "Failed to sign responsibility order.",
      }),
    );
  }

  revalidateResponsibilityOrderViews(orderId);
  redirect(
    buildViewUrl(orderId, companyId, {
      success: "Responsibility order was signed.",
    }),
  );
}

export async function annulResponsibilityOrderAction(formData: FormData) {
  const orderId = firstString(formData, "orderId");
  const companyId = optionalString(formData, "companyId");

  try {
    await apiFetch(`responsibility-orders/${orderId}/annul`, {
      method: "POST",
      body: JSON.stringify({
        reason: optionalString(formData, "reason"),
      }),
    });
  } catch (error) {
    redirect(
      buildViewUrl(orderId, companyId, {
        error: error instanceof Error ? error.message : "Failed to annul responsibility order.",
      }),
    );
  }

  revalidateResponsibilityOrderViews(orderId);
  redirect(
    buildViewUrl(orderId, companyId, {
      success: "Responsibility order was annulled.",
    }),
  );
}

export async function returnToResponsibilityOrderRegistryAction(formData: FormData) {
  const companyId = optionalString(formData, "companyId");
  redirect(buildRegistryUrl(companyId));
}
