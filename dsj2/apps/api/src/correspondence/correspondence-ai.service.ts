import { Injectable } from "@nestjs/common";
import type { CorrespondenceAiAssistInput, CorrespondenceAiResponse } from "@dsj/types";
import { ConfigService } from "@nestjs/config";

type OpenAiResponsesApiPayload = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

@Injectable()
export class CorrespondenceAiService {
  constructor(private readonly configService: ConfigService) {}

  private getModel() {
    return this.configService.get<string>("OPENAI_MODEL")?.trim() || "gpt-5-mini";
  }

  private extractText(payload: OpenAiResponsesApiPayload) {
    if (typeof payload.output_text === "string" && payload.output_text.trim().length) {
      return payload.output_text.trim();
    }

    const chunks: string[] = [];

    for (const item of payload.output ?? []) {
      for (const content of item.content ?? []) {
        if (typeof content.text === "string" && content.text.trim().length) {
          chunks.push(content.text.trim());
        }
      }
    }

    return chunks.join("\n\n").trim();
  }

  private buildJsonPrompt(input: CorrespondenceAiAssistInput) {
    const kindLabel = input.kind === "COMMERCIAL_PROPOSAL" ? "коммерческое предложение" : "деловое письмо";
    const modeLabel =
      input.mode === "DRAFT"
        ? "сгенерировать черновик"
        : input.mode === "IMPROVE"
          ? "улучшить существующий текст"
          : "проанализировать письмо перед отправкой";

    return [
      "Ты помощник по деловой B2B-переписке на русском языке.",
      "Пиши официально, ясно, без лишней воды.",
      `Нужно ${modeLabel}. Тип документа: ${kindLabel}.`,
      "Верни строго JSON без markdown и без пояснений вне JSON.",
      'Формат JSON: {"suggestedSubject":"...","suggestedBody":"...","analysis":"..."}',
      `Текущая тема: ${input.subject?.trim() || "не указана"}`,
      `Текущий текст: ${input.body?.trim() || "не указан"}`,
      `Компания-получатель: ${input.recipientCompanyName?.trim() || "не указана"}`,
      `Контактное лицо: ${input.recipientContactName?.trim() || "не указано"}`,
      "Если текста ещё нет, сформируй полноценный черновик с приветствием, сутью обращения и понятным следующим шагом.",
      "Если режим ANALYZE, analysis должен содержать замечания по тону, полноте, конкретике и рискам перед отправкой.",
    ].join("\n");
  }

  private buildFallback(input: CorrespondenceAiAssistInput): CorrespondenceAiResponse {
    const recipientCompany = input.recipientCompanyName?.trim() || "компанию-получателя";
    const recipientName = input.recipientContactName?.trim();
    const greeting = recipientName ? `Уважаемый(ая) ${recipientName},` : "Добрый день,";
    const suggestedSubject =
      input.subject?.trim() ||
      (input.kind === "COMMERCIAL_PROPOSAL"
        ? `Коммерческое предложение для ${recipientCompany}`
        : `Письмо для ${recipientCompany}`);
    const suggestedBody =
      input.mode === "IMPROVE" && input.body?.trim()
        ? `${greeting}\n\n${input.body.trim()}\n\nПросим рассмотреть обращение и сообщить удобный формат обратной связи.\n\nС уважением,\nКоманда DSJ`
        : `${greeting}\n\nНаправляем ${input.kind === "COMMERCIAL_PROPOSAL" ? "коммерческое предложение" : "деловое письмо"} для ${recipientCompany}. Просим ознакомиться с содержанием и сообщить удобный формат дальнейшего взаимодействия.\n\nПри необходимости готовы оперативно направить уточняющие материалы и сопроводительные документы.\n\nС уважением,\nКоманда DSJ`;

    return {
      provider: "fallback",
      isFallback: true,
      suggestedSubject,
      suggestedBody,
      analysis: [
        `Получатель: ${recipientCompany}${recipientName ? `, ${recipientName}` : ""}.`,
        input.body?.trim().length
          ? "Проверь конкретику предложения, сроки и ожидаемое действие от получателя."
          : "Черновик сгенерирован по шаблону. Добавь предмет обращения, сроки и следующий шаг.",
        "Если письмо содержит коммерческие условия, укажи стоимость, сроки и контакт для обратной связи.",
      ].join("\n"),
    };
  }

  private parseJsonResponse(rawText: string, input: CorrespondenceAiAssistInput): CorrespondenceAiResponse {
    try {
      const parsed = JSON.parse(rawText) as Partial<CorrespondenceAiResponse>;
      const fallback = this.buildFallback(input);

      return {
        provider: "openai",
        isFallback: false,
        suggestedSubject:
          typeof parsed.suggestedSubject === "string" && parsed.suggestedSubject.trim().length
            ? parsed.suggestedSubject.trim()
            : fallback.suggestedSubject,
        suggestedBody:
          typeof parsed.suggestedBody === "string" && parsed.suggestedBody.trim().length
            ? parsed.suggestedBody.trim()
            : fallback.suggestedBody,
        analysis:
          typeof parsed.analysis === "string" && parsed.analysis.trim().length
            ? parsed.analysis.trim()
            : fallback.analysis,
      };
    } catch {
      return {
        provider: "openai",
        isFallback: false,
        suggestedSubject: input.subject?.trim() || this.buildFallback(input).suggestedSubject,
        suggestedBody: rawText.trim() || this.buildFallback(input).suggestedBody,
        analysis: "Ответ модели пришёл в свободной форме. Проверь формулировки вручную перед отправкой.",
      };
    }
  }

  async assist(input: CorrespondenceAiAssistInput): Promise<CorrespondenceAiResponse> {
    const apiKey = this.configService.get<string>("OPENAI_API_KEY")?.trim();

    if (!apiKey) {
      return this.buildFallback(input);
    }

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.getModel(),
          input: [
            {
              role: "user",
              content: this.buildJsonPrompt(input),
            },
          ],
        }),
      });

      if (!response.ok) {
        return this.buildFallback(input);
      }

      const payload = (await response.json()) as OpenAiResponsesApiPayload;
      const rawText = this.extractText(payload);

      if (!rawText.length) {
        return this.buildFallback(input);
      }

      return this.parseJsonResponse(rawText, input);
    } catch {
      return this.buildFallback(input);
    }
  }
}
