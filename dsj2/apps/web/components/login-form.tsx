"use client";

import { useActionState } from "react";
import { Input } from "@dsj/ui";
import { loginAction, type LoginActionState } from "../actions/auth";
import { SubmitButton } from "./submit-button";

const initialState: LoginActionState = {};

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--ink)]">
          Электронная почта
        </label>
        <Input
          name="email"
          type="email"
          placeholder="name@company.kz"
          required
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--ink)]">Пароль</label>
        <Input
          name="password"
          type="password"
          placeholder="Пароль из настроек"
          required
        />
      </div>
      {state.error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
          {state.error}
        </p>
      ) : null}
      <SubmitButton label="Войти" pendingLabel="Вход..." className="w-full" />
    </form>
  );
}
