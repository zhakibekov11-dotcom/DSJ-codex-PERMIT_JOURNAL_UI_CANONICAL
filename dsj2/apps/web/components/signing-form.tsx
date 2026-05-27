"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { SignatureProvider } from "@dsj/types";
import { Input } from "@dsj/ui";
import { checkNcalayerBridge, signWithNcalayerBridge } from "@/lib/ncalayer-bridge";
import { SubmitButton } from "@/components/submit-button";

type SigningField = {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  helperText?: string;
  required?: boolean;
  type?: string;
};

type SigningFormProps = {
  mode: SignatureProvider;
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields: Array<{ name: string; value: string | null | undefined }>;
  fields?: SigningField[];
  digest: string | null;
  bridgeUrl: string;
  bridgeTimeoutMs: number;
  bridgeContext: {
    briefingRecordId?: string;
    briefingJournalEntryId?: string;
    employeeDocumentId?: string;
    protocolId?: string;
    responsibilityOrderId?: string;
    inviteToken?: string;
    documentNumber?: string | null;
    registrationNo?: string | null;
  };
  title: string;
  description?: string;
  submitLabel: string;
  pendingLabel: string;
  mockHint?: string;
  bridgeHint?: string;
  testMode?: boolean;
};

type BridgeStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "ready"; message: string }
  | { state: "error"; message: string };

export function SigningForm({
  mode,
  action,
  hiddenFields,
  fields = [],
  digest,
  bridgeUrl,
  bridgeTimeoutMs,
  bridgeContext,
  title,
  description,
  submitLabel,
  pendingLabel,
  mockHint,
  bridgeHint,
  testMode = false,
}: SigningFormProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const bridgePayloadRef = useRef<HTMLInputElement | null>(null);
  const bridgeSubmissionStartedRef = useRef(false);
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>(
    mode === "NCALAYER" ? { state: "checking" } : { state: "idle" },
  );

  const isNcalayerMode = mode === "NCALAYER";
  const isMockMode = mode === "MOCK_NCALAYER";

  useEffect(() => {
    if (!isNcalayerMode) {
      setBridgeStatus({ state: "idle" });
      return;
    }

    let cancelled = false;
    setBridgeStatus({ state: "checking" });

    void checkNcalayerBridge({ bridgeUrl, timeoutMs: bridgeTimeoutMs })
      .then((health) => {
        if (cancelled) {
          return;
        }

        if (!health.ok) {
          throw new Error("Мост NCALayer сообщил о нерабочем состоянии.");
        }

        const suffix =
          health.version || health.bridgeUrl
            ? ` ${[health.version, health.bridgeUrl].filter(Boolean).join(" · ")}`
            : "";

        setBridgeStatus({
          state: "ready",
          message: `Мост NCALayer готов${suffix ? `: ${suffix.trim()}` : "."}`,
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setBridgeStatus({
          state: "error",
          message: error instanceof Error ? error.message : "Мост NCALayer недоступен.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [bridgeTimeoutMs, bridgeUrl, isNcalayerMode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!isNcalayerMode || bridgePayloadRef.current?.value) {
      return;
    }

    event.preventDefault();

    if (bridgeSubmissionStartedRef.current) {
      return;
    }

    if (!digest) {
      setBridgeStatus({
        state: "error",
        message: "Не удалось найти digest для подписи.",
      });
      return;
    }

    bridgeSubmissionStartedRef.current = true;

    try {
      const signature = await signWithNcalayerBridge(
        { bridgeUrl, timeoutMs: bridgeTimeoutMs },
        {
          digest,
          testMode,
          context: bridgeContext,
        },
      );

      if (!bridgePayloadRef.current) {
        throw new Error("Не удалось подготовить payload для моста.");
      }

      bridgePayloadRef.current.value = JSON.stringify(signature);
      formRef.current?.requestSubmit();
    } catch (error) {
      setBridgeStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Не удалось подписать через NCALayer.",
      });
    } finally {
      bridgeSubmissionStartedRef.current = false;
    }
  }

  return (
    <form ref={formRef} action={action} onSubmit={handleSubmit} className="space-y-4">
      {hiddenFields.map((field) => (
        <input key={field.name} type="hidden" name={field.name} value={field.value ?? ""} />
      ))}
      <input ref={bridgePayloadRef} type="hidden" name="bridgePayloadJson" defaultValue="" />

      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <p className="font-medium text-slate-800">{title}</p>
        {description ? <p className="mt-1 text-slate-600">{description}</p> : null}
        {testMode ? (
          <p className="mt-2 text-xs uppercase tracking-[0.12em] text-slate-400">
            Тестовый контур подписи активен
          </p>
        ) : null}
      </div>

      {isMockMode ? (
        <>
          {mockHint ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              {mockHint}
            </div>
          ) : null}
          {fields.map((field) => (
            <div key={field.name} className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor={field.name}>
                {field.label}
              </label>
              <Input
                id={field.name}
                name={field.name}
                defaultValue={field.defaultValue}
                placeholder={field.placeholder}
                required={field.required}
                type={field.type}
              />
              {field.helperText ? <p className="text-xs text-slate-400">{field.helperText}</p> : null}
            </div>
          ))}
        </>
      ) : null}

      {isNcalayerMode ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium text-slate-800">Мост NCALayer</p>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
              {bridgeStatus.state === "checking"
                ? "Проверка"
                : bridgeStatus.state === "ready"
                  ? "Готов"
                  : "Ошибка"}
            </span>
          </div>
          <p>{bridgeHint ?? "Подпись будет собрана через локальный мост и передана на сервер."}</p>
          <p className="text-xs text-slate-500">URL моста: {bridgeUrl}</p>
          <p className="text-xs text-slate-500">
            Хэш: {digest ?? "не задан"}
            {bridgeContext.documentNumber ? ` · ${bridgeContext.documentNumber}` : ""}
          </p>
          {bridgeStatus.state === "ready" || bridgeStatus.state === "error" ? (
            <p
              className={
                bridgeStatus.state === "ready"
                  ? "text-xs text-emerald-700"
                  : "text-xs text-rose-700"
              }
            >
              {bridgeStatus.message}
            </p>
          ) : null}
        </div>
      ) : null}

      <SubmitButton
        label={submitLabel}
        pendingLabel={pendingLabel}
        disabled={isNcalayerMode && bridgeStatus.state === "checking"}
      />
    </form>
  );
}
