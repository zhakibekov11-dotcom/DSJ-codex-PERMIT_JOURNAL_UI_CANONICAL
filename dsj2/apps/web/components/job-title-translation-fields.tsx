"use client";

import { useId, useState, type ChangeEvent } from "react";
import { Button, Input } from "@dsj/ui";
import { requestKazakhJobTitleTranslation } from "../lib/job-title-translation";

type JobTitleTranslationFieldsProps = {
  ruName: string;
  kzName: string;
  ruLabel: string;
  kzLabel: string;
  ruDefaultValue?: string;
  kzDefaultValue?: string;
  ruRequired?: boolean;
  kzRequired?: boolean;
  ruPlaceholder?: string;
  kzPlaceholder?: string;
};

export function JobTitleTranslationFields({
  ruName,
  kzName,
  ruLabel,
  kzLabel,
  ruDefaultValue = "",
  kzDefaultValue = "",
  ruRequired = false,
  kzRequired = false,
  ruPlaceholder,
  kzPlaceholder,
}: JobTitleTranslationFieldsProps) {
  const kzInputId = useId();
  const [ruValue, setRuValue] = useState(ruDefaultValue);
  const [kzValue, setKzValue] = useState(kzDefaultValue);
  const [isTranslating, setIsTranslating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleRuChange(event: ChangeEvent<HTMLInputElement>) {
    setRuValue(event.target.value);
    setErrorMessage(null);
  }

  function handleKzChange(event: ChangeEvent<HTMLInputElement>) {
    setKzValue(event.target.value);
    setErrorMessage(null);
  }

  async function handleTranslate() {
    const trimmedValue = ruValue.trim();

    if (!trimmedValue || isTranslating) {
      return;
    }

    setIsTranslating(true);
    setErrorMessage(null);

    try {
      const translatedText = await requestKazakhJobTitleTranslation(trimmedValue);
      setKzValue(translatedText);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не удалось перевести должность на казахский.",
      );
    } finally {
      setIsTranslating(false);
    }
  }

  return (
    <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">{ruLabel}</label>
        <Input
          name={ruName}
          value={ruValue}
          onChange={handleRuChange}
          placeholder={ruPlaceholder}
          required={ruRequired}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor={kzInputId} className="text-sm font-medium text-slate-700">
          {kzLabel}
        </label>
        <div className="flex items-start gap-2">
          <Input
            id={kzInputId}
            name={kzName}
            value={kzValue}
            onChange={handleKzChange}
            placeholder={kzPlaceholder}
            required={kzRequired}
            className="flex-1"
          />
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0"
            disabled={!ruValue.trim() || isTranslating}
            onClick={() => void handleTranslate()}
          >
            {isTranslating ? "Перевод..." : "Перевести в KZ"}
          </Button>
        </div>
        {errorMessage ? (
          <p className="text-xs text-rose-600">{errorMessage}</p>
        ) : null}
      </div>
    </div>
  );
}
