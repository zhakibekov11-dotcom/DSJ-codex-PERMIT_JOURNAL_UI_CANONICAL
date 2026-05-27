import { Body, Controller, Get, Param, Post, Query, Res } from "@nestjs/common";
import {
  companyDocumentFilterSchema,
  createCompanyDocumentSchema,
} from "@dsj/types";
import type { Response } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { CompanyDocumentsService } from "./company-documents.service";

@Controller("company-documents")
export class CompanyDocumentsController {
  constructor(
    private readonly companyDocumentsService: CompanyDocumentsService,
  ) {}

  @Get()
  @Roles("SUPER_ADMIN", "COMPANY_ADMIN", "SAFETY_ENGINEER")
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(companyDocumentFilterSchema.partial()))
    filters: Parameters<CompanyDocumentsService["list"]>[1],
  ) {
    return this.companyDocumentsService.list(user, filters);
  }

  @Post()
  @Roles("SUPER_ADMIN", "COMPANY_ADMIN", "SAFETY_ENGINEER")
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCompanyDocumentSchema))
    input: Parameters<CompanyDocumentsService["create"]>[1],
  ) {
    return this.companyDocumentsService.create(user, input);
  }

  @Get(":id/pdf")
  @Roles("SUPER_ADMIN", "COMPANY_ADMIN", "SAFETY_ENGINEER")
  async downloadPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Res() response: Response,
  ) {
    const file = await this.companyDocumentsService.downloadPdf(user, id);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.fileName}"`,
    );
    response.send(file.buffer);
  }

  @Get(":id/docx")
  @Roles("SUPER_ADMIN", "COMPANY_ADMIN", "SAFETY_ENGINEER")
  async downloadDocx(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Res() response: Response,
  ) {
    const file = await this.companyDocumentsService.downloadDocx(user, id);
    response.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.fileName}"`,
    );
    response.send(file.buffer);
  }
}
