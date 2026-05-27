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

function getEmployeeIds(formData: FormData) {
  return formData
    .getAll("employeeIds")
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0);
}

function getMembers(formData: FormData) {
  const names = formData.getAll("memberFullName").map((value) => String(value).trim());
  const titles = formData.getAll("memberJobTitle").map((value) => String(value).trim());

  return names
    .map((fullName, index) => ({
      fullName,
      jobTitle: titles[index]?.length ? titles[index] : null,
    }))
    .filter((member) => member.fullName.length > 0);
}

function getProtocolPayload(formData: FormData) {
  return {
    organizationId: optionalString(formData, "companyId"),
    number: firstString(formData, "number"),
    date: firstString(formData, "date"),
    protocolType: firstString(formData, "protocolType"),
    basis: firstString(formData, "basis"),
    departmentId: optionalString(formData, "departmentId"),
    workSiteId: optionalString(formData, "workSiteId"),
    decision: firstString(formData, "decision"),
    notes: optionalString(formData, "notes"),
    employeeIds: getEmployeeIds(formData),
    chairman: {
      fullName: firstString(formData, "chairmanFullName"),
      jobTitle: optionalString(formData, "chairmanJobTitle"),
    },
    members: getMembers(formData),
    status: "DRAFT" as const,
  };
}

function buildProtocolRegistryUrl(
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
  return query ? `/protocols?${query}` : "/protocols";
}

function buildProtocolViewUrl(
  protocolId: string,
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
  return query ? `/protocols/${protocolId}?${query}` : `/protocols/${protocolId}`;
}

function buildProtocolDraftUrl(
  pathname: string,
  companyId: string | null,
  options?: {
    error?: string;
    replaceProtocolId?: string | null;
  },
) {
  const params = new URLSearchParams();

  if (companyId) {
    params.set("companyId", companyId);
  }

  if (options?.replaceProtocolId) {
    params.set("replaceProtocolId", options.replaceProtocolId);
  }

  if (options?.error) {
    params.set("error", options.error);
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function revalidateProtocolViews(protocolId?: string) {
  revalidatePath("/protocols");
  revalidatePath("/employees");

  if (protocolId) {
    revalidatePath(`/protocols/${protocolId}`);
    revalidatePath(`/protocols/${protocolId}/edit`);
    revalidatePath(`/protocols/${protocolId}/sign`);
  }
}

export async function createOrReplaceProtocolAction(formData: FormData) {
  const companyId = optionalString(formData, "companyId");
  const replaceProtocolId = optionalString(formData, "replaceProtocolId");
  const payload = getProtocolPayload(formData);

  try {
    if (replaceProtocolId) {
      const created = await apiFetch<{ id: string }>(`protocols/${replaceProtocolId}/replace`, {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          reason: optionalString(formData, "reason"),
        }),
      });

      revalidateProtocolViews(created.id);
      redirect(
        buildProtocolViewUrl(created.id, companyId, {
          success: "Replacement draft protocol was created.",
        }),
      );
    }

    const created = await apiFetch<{ id: string }>("protocols", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    revalidateProtocolViews(created.id);
    redirect(
      buildProtocolViewUrl(created.id, companyId, {
        success: "Draft protocol was created.",
      }),
    );
  } catch (error) {
    redirect(
      buildProtocolDraftUrl("/protocols/new", companyId, {
        error: error instanceof Error ? error.message : "Failed to save draft protocol.",
        replaceProtocolId,
      }),
    );
  }
}

export async function updateProtocolAction(formData: FormData) {
  const protocolId = firstString(formData, "protocolId");
  const companyId = optionalString(formData, "companyId");

  try {
    await apiFetch(`protocols/${protocolId}`, {
      method: "PATCH",
      body: JSON.stringify(getProtocolPayload(formData)),
    });
  } catch (error) {
    redirect(
      buildProtocolDraftUrl(`/protocols/${protocolId}/edit`, companyId, {
        error: error instanceof Error ? error.message : "Failed to update draft protocol.",
      }),
    );
  }

  revalidateProtocolViews(protocolId);
  redirect(
    buildProtocolViewUrl(protocolId, companyId, {
      success: "Draft protocol was updated.",
    }),
  );
}

export async function prepareProtocolForSigningAction(formData: FormData) {
  const protocolId = firstString(formData, "protocolId");
  const companyId = optionalString(formData, "companyId");

  try {
    await apiFetch(`protocols/${protocolId}/prepare-sign`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  } catch (error) {
    redirect(
      buildProtocolViewUrl(protocolId, companyId, {
        error:
          error instanceof Error ? error.message : "Failed to prepare protocol for signing.",
      }),
    );
  }

  revalidateProtocolViews(protocolId);
  redirect(
    buildProtocolViewUrl(protocolId, companyId, {
      success: "Protocol is prepared for signing.",
    }),
  );
}

export async function signProtocolAction(formData: FormData) {
  const protocolId = firstString(formData, "protocolId");
  const companyId = optionalString(formData, "companyId");

  try {
    const signingInput = readSigningInput(formData);

    await apiFetch(`protocols/${protocolId}/sign`, {
      method: "POST",
      body: JSON.stringify(signingInput ?? {}),
    });
  } catch (error) {
    redirect(
      buildProtocolDraftUrl(`/protocols/${protocolId}/sign`, companyId, {
        error: error instanceof Error ? error.message : "Failed to sign protocol.",
      }),
    );
  }

  revalidateProtocolViews(protocolId);
  redirect(
    buildProtocolViewUrl(protocolId, companyId, {
      success: "Protocol was signed.",
    }),
  );
}

export async function annulProtocolAction(formData: FormData) {
  const protocolId = firstString(formData, "protocolId");
  const companyId = optionalString(formData, "companyId");

  try {
    await apiFetch(`protocols/${protocolId}/annul`, {
      method: "POST",
      body: JSON.stringify({
        reason: optionalString(formData, "reason"),
      }),
    });
  } catch (error) {
    redirect(
      buildProtocolViewUrl(protocolId, companyId, {
        error: error instanceof Error ? error.message : "Failed to annul protocol.",
      }),
    );
  }

  revalidateProtocolViews(protocolId);
  redirect(
    buildProtocolViewUrl(protocolId, companyId, {
      success: "Protocol was annulled.",
    }),
  );
}

export async function returnToProtocolRegistryAction(formData: FormData) {
  const companyId = optionalString(formData, "companyId");
  redirect(buildProtocolRegistryUrl(companyId));
}
