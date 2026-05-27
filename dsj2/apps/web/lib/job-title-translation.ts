type TranslationResponse = {
  translatedText?: string;
  message?: string | string[];
  error?: string;
};

function normalizeTranslationErrorMessage(
  payload: TranslationResponse | string | null,
  fallback: string,
) {
  if (typeof payload === "string" && payload.trim().length) {
    return payload.trim();
  }

  if (typeof payload === "string") {
    return fallback;
  }

  if (!payload) {
    return fallback;
  }

  if (Array.isArray(payload.message) && payload.message.length) {
    return payload.message.join(", ");
  }

  if (typeof payload.message === "string" && payload.message.trim().length) {
    return payload.message.trim();
  }

  if (typeof payload.error === "string" && payload.error.trim().length) {
    return payload.error.trim();
  }

  return fallback;
}

export async function requestKazakhJobTitleTranslation(text: string) {
  const normalizedText = text.trim();

  if (!normalizedText) {
    throw new Error("Сначала заполните русское название должности.");
  }

  const response = await fetch("/api/translations/job-title", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: normalizedText,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    let message = "Не удалось перевести должность на казахский.";

    try {
      const payload = (await response.json()) as TranslationResponse;
      message = normalizeTranslationErrorMessage(payload, message);
    } catch {
      const payload = await response.text().catch(() => "");
      message = normalizeTranslationErrorMessage(payload, message);
    }

    throw new Error(message);
  }

  const payload = (await response.json()) as TranslationResponse;
  const translatedText = payload.translatedText?.trim();

  if (!translatedText) {
    throw new Error("Сервис перевода вернул пустой ответ.");
  }

  return translatedText;
}
