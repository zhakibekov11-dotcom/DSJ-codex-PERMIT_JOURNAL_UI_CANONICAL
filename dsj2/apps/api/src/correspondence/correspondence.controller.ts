import { Body, Controller, Get, Param, Post, Query, Res } from "@nestjs/common";
import {
  correspondenceAiAssistSchema,
  correspondenceFilterSchema,
  createCorrespondenceSchema,
} from "@dsj/types";
import type { Response } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { CorrespondenceService } from "./correspondence.service";

@Controller("correspondence")
export class CorrespondenceController {
  constructor(private readonly correspondenceService: CorrespondenceService) {}

  @Get()
  @Roles("SUPER_ADMIN", "COMPANY_ADMIN", "SAFETY_ENGINEER")
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(correspondenceFilterSchema.partial()))
    filters: Parameters<CorrespondenceService["list"]>[1],
  ) {
    return this.correspondenceService.list(user, filters);
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "COMPANY_ADMIN", "SAFETY_ENGINEER")
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.correspondenceService.findOne(user, id);
  }

  @Get(":id/docx")
  @Roles("SUPER_ADMIN", "COMPANY_ADMIN", "SAFETY_ENGINEER")
  async downloadDocx(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Res() response: Response,
  ) {
    const buffer = await this.correspondenceService.downloadDocx(user, id);
    response.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    response.setHeader("Content-Disposition", `attachment; filename="correspondence-${id}.docx"`);
    response.send(buffer);
  }

  @Get(":id/pdf")
  @Roles("SUPER_ADMIN", "COMPANY_ADMIN", "SAFETY_ENGINEER")
  async downloadPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Res() response: Response,
  ) {
    const buffer = await this.correspondenceService.downloadPdf(user, id);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="correspondence-${id}.pdf"`);
    response.send(buffer);
  }

  @Post()
  @Roles("SUPER_ADMIN", "COMPANY_ADMIN", "SAFETY_ENGINEER")
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCorrespondenceSchema))
    input: Parameters<CorrespondenceService["create"]>[1],
  ) {
    return this.correspondenceService.create(user, input);
  }

  @Post(":id/send")
  @Roles("SUPER_ADMIN", "COMPANY_ADMIN", "SAFETY_ENGINEER")
  async send(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.correspondenceService.send(user, id);
  }

  @Post("ai-assist")
  @Roles("SUPER_ADMIN", "COMPANY_ADMIN", "SAFETY_ENGINEER")
  async aiAssist(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(correspondenceAiAssistSchema))
    input: Parameters<CorrespondenceService["aiAssist"]>[1],
  ) {
    return this.correspondenceService.aiAssist(user, input);
  }
}
