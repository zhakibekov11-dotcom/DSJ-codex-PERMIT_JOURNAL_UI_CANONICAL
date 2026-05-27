"use server";

import type { SessionUser, UserRole } from "@dsj/types";
import { loginSchema } from "@dsj/types";
import { redirect } from "next/navigation";
import { apiFetch, clearSessionToken, setSessionToken } from "../lib/api";
import { getDefaultAuthenticatedPath } from "../lib/auth";

export type LoginActionState = {
  error?: string;
};

type LoginResult = {
  accessToken: string;
  user: Pick<SessionUser, "hasLinkedEmployeeRecord"> & {
    role: UserRole;
  };
};

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      error: "Проверьте email и пароль.",
    };
  }

  let result: LoginResult;

  try {
    result = await apiFetch<LoginResult>(
      "auth/login",
      {
        method: "POST",
        body: JSON.stringify(parsed.data),
      },
      { auth: false },
    );

    await setSessionToken(result.accessToken);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Не удалось войти.",
    };
  }

  redirect(getDefaultAuthenticatedPath(result.user));
}

export async function logoutAction() {
  await clearSessionToken();
  redirect("/login");
}
