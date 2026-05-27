import { Body, Controller, Get, Param, Post, Query, Res } from "@nestjs/common";
import {
  createSafetyCertificateSchema,
  safetyCertificateFilterSchema,
} from "@dsj/types";
import type { Response } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { SafetyCertificatesService } from "./safety-certificates.service";

@Controller("safety-certificates")
export class SafetyCertificatesController {
  constructor(private readonly safetyCertificatesService: SafetyCertificatesService) {}

  @Get()
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(safetyCertificateFilterSchema.partial()))
    filters: Parameters<SafetyCertificatesService["list"]>[1],
  ) {
    return this.safetyCertificatesService.list(user, filters);
  }

  @Get("my")
  @Roles("EMPLOYEE_SIGNER")
  async listMy(@CurrentUser() user: AuthenticatedUser) {
    return this.safetyCertificatesService.listMy(user);
  }

  @Get(":id")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER", "EMPLOYEE_SIGNER")
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.safetyCertificatesService.findOne(user, id);
  }

  @Get(":id/download")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER", "EMPLOYEE_SIGNER")
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Res() response: Response,
  ) {
    const buffer = await this.safetyCertificatesService.download(user, id);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="safety-certificate-${id}.pdf"`);
    response.send(buffer);
  }

  @Post()
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createSafetyCertificateSchema))
    input: Parameters<SafetyCertificatesService["create"]>[1],
  ) {
    return this.safetyCertificatesService.create(user, input);
  }
}
