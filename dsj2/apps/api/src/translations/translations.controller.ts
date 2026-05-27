import { Body, Controller, Post } from "@nestjs/common";
import { z } from "zod";
import { Roles } from "../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { TranslationsService } from "./translations.service";

const translateJobTitleSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Введите русское название должности для перевода.")
    .max(255, "Название должности слишком длинное для перевода."),
});

@Controller("translations")
export class TranslationsController {
  constructor(private readonly translationsService: TranslationsService) {}

  @Post("job-title")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async translateJobTitle(
    @Body(new ZodValidationPipe(translateJobTitleSchema))
    input: { text: string },
  ) {
    return this.translationsService.translateJobTitle(input.text);
  }
}
