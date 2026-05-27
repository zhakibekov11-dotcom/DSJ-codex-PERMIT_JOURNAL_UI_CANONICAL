"use client";

import { useMemo, useState } from "react";
import { Button, Input, Select, Textarea } from "@dsj/ui";
import type { CorrespondenceAiResponse } from "@dsj/types";
import { createCorrespondenceAction } from "../actions/correspondence";
import { SubmitButton } from "./submit-button";

type RecipientFormItem = {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPosition: string;
};

function createRecipient(): RecipientFormItem {
  return {
    id: crypto.randomUUID(),
    companyName: "",
    contactName: "",
    contactEmail: "",
    contactPosition: "",
  };
}

type CorrespondenceEditorProps = {
  companyId: string | null;
};

export function CorrespondenceEditor({ companyId }: CorrespondenceEditorProps) {
  const [kind, setKind] = useState<"LETTER" | "COMMERCIAL_PROPOSAL">("LETTER");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<RecipientFormItem[]>([
    {
      id: "recipient-1",
      companyName: "",
      contactName: "",
      contactEmail: "",
      contactPosition: "",
    },
  ]);

  const recipientsJson = useMemo(
    () =>
      JSON.stringify(
        recipients.map((recipient) => ({
          companyName: recipient.companyName,
          contactName: recipient.contactName,
          contactEmail: recipient.contactEmail || null,
          contactPosition: recipient.contactPosition || null,
        })),
      ),
    [recipients],
  );

  async function requestAi(mode: "DRAFT" | "IMPROVE" | "ANALYZE") {
    setAiBusy(true);
    setAiError(null);

    try {
      const primaryRecipient = recipients[0];
      const response = await fetch("/api/correspondence/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId,
          mode,
          kind,
          subject,
          body,
          recipientCompanyName: primaryRecipient?.companyName || "",
          recipientContactName: primaryRecipient?.contactName || "",
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          typeof payload?.message === "string" ? payload.message : "Не удалось получить ответ ИИ.",
        );
      }

      const payload = (await response.json()) as CorrespondenceAiResponse;
      setSubject(payload.suggestedSubject);
      setBody(payload.suggestedBody);
      setAnalysis(payload.analysis);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Не удалось получить подсказку ИИ.");
    } finally {
      setAiBusy(false);
    }
  }

  function updateRecipient(id: string, field: keyof Omit<RecipientFormItem, "id">, value: string) {
    setRecipients((current) =>
      current.map((recipient) => (recipient.id === id ? { ...recipient, [field]: value } : recipient)),
    );
  }

  function removeRecipient(id: string) {
    setRecipients((current) => (current.length === 1 ? current : current.filter((recipient) => recipient.id !== id)));
  }

  return (
    <form action={createCorrespondenceAction} className="space-y-5">
      <input type="hidden" name="companyId" value={companyId ?? ""} />
      <input type="hidden" name="recipientsJson" value={recipientsJson} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Тип документа</label>
          <Select name="kind" value={kind} onChange={(event) => setKind(event.target.value as "LETTER" | "COMMERCIAL_PROPOSAL")}>
            <option value="LETTER">Деловое письмо</option>
            <option value="COMMERCIAL_PROPOSAL">Коммерческое предложение</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Название в реестре</label>
          <Input
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={kind === "COMMERCIAL_PROPOSAL" ? "КП на услуги по охране труда" : "Письмо о сотрудничестве"}
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Тема письма</label>
        <Input
          name="subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Тема письма или коммерческого предложения"
          required
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">Получатели</p>
            <p className="text-xs text-slate-500">Можно подготовить один документ и отправить его сразу нескольким адресатам.</p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => setRecipients((current) => [...current, createRecipient()])}>
            Добавить получателя
          </Button>
        </div>

        <div className="space-y-3">
          {recipients.map((recipient, index) => (
            <div key={recipient.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">Получатель {index + 1}</p>
                <Button type="button" variant="subtle" size="sm" onClick={() => removeRecipient(recipient.id)}>
                  Убрать
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="Компания получателя"
                  value={recipient.companyName}
                  onChange={(event) => updateRecipient(recipient.id, "companyName", event.target.value)}
                />
                <Input
                  placeholder="Контактное лицо"
                  value={recipient.contactName}
                  onChange={(event) => updateRecipient(recipient.id, "contactName", event.target.value)}
                />
                <Input
                  type="email"
                  placeholder="email@company.kz"
                  value={recipient.contactEmail}
                  onChange={(event) => updateRecipient(recipient.id, "contactEmail", event.target.value)}
                />
                <Input
                  placeholder="Должность"
                  value={recipient.contactPosition}
                  onChange={(event) => updateRecipient(recipient.id, "contactPosition", event.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={aiBusy} onClick={() => requestAi("DRAFT")}>
            {aiBusy ? "ИИ думает..." : "ИИ: Сгенерировать черновик"}
          </Button>
          <Button type="button" variant="secondary" size="sm" disabled={aiBusy} onClick={() => requestAi("IMPROVE")}>
            {aiBusy ? "ИИ думает..." : "ИИ: Улучшить текст"}
          </Button>
          <Button type="button" variant="secondary" size="sm" disabled={aiBusy} onClick={() => requestAi("ANALYZE")}>
            {aiBusy ? "ИИ думает..." : "ИИ: Проверить письмо"}
          </Button>
        </div>
        {aiError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {aiError}
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Содержание</label>
        <Textarea
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Текст письма или коммерческого предложения"
          required
          className="min-h-56"
        />
      </div>

      {analysis ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
          <p className="text-sm font-medium text-slate-900">ИИ-анализ письма</p>
          <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{analysis}</pre>
        </div>
      ) : null}

      <SubmitButton label="Сохранить в реестре" pendingLabel="Сохранение..." />
    </form>
  );
}
