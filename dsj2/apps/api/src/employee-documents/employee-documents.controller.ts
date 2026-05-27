import { Body, Controller, Get, Param, Post, Query, Req, Res } from "@nestjs/common";
import {
  annulEmployeeDocumentSchema,
  createEmployeeDocumentSchema,
  employeeDocumentFilterSchema,
  prepareEmployeeDocumentForSigningSchema,
  replaceEmployeeDocumentSchema,
  signEmployeeDocumentSchema,
  verifyEmployeeDocumentSchema,
} from "@dsj/types";
import type { Request, Response } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { EmployeeDocumentsService } from "./employee-documents.service";

@Controller("employee-documents")
export class EmployeeDocumentsController {
  constructor(private readonly employeeDocumentsService: EmployeeDocumentsService) {}

  @Get()
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(employeeDocumentFilterSchema.partial()))
    filters: Parameters<EmployeeDocumentsService["list"]>[1],
  ) {
    return this.employeeDocumentsService.list(user, filters);
  }

  @Get("my")
  @Roles("EMPLOYEE_SIGNER")
  async listMy(@CurrentUser() user: AuthenticatedUser) {
    return this.employeeDocumentsService.listMy(user);
  }

  @Get(":id")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER", "EMPLOYEE_SIGNER")
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.employeeDocumentsService.findOne(user, id);
  }

  @Get(":id/download")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER", "EMPLOYEE_SIGNER")
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Res() response: Response,
  ) {
    const buffer = await this.employeeDocumentsService.download(user, id);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="document-${id}.pdf"`);
    response.send(buffer);
  }

  @Post()
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createEmployeeDocumentSchema))
    input: Parameters<EmployeeDocumentsService["create"]>[1],
  ) {
    return this.employeeDocumentsService.create(user, input);
  }

  @Post(":id/prepare-sign")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async prepareForSigning(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(prepareEmployeeDocumentForSigningSchema))
    input: Parameters<EmployeeDocumentsService["prepareForSigning"]>[2],
  ) {
    return this.employeeDocumentsService.prepareForSigning(user, id, input);
  }

  @Post(":id/sign")
  @Roles("EMPLOYEE_SIGNER")
  async sign(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Req() request: Request,
    @Body(new ZodValidationPipe(signEmployeeDocumentSchema))
    input: Parameters<EmployeeDocumentsService["sign"]>[2],
  ) {
    return this.employeeDocumentsService.sign(user, id, input, {
      ipAddress: request.ip ?? null,
      userAgent: request.get("user-agent") ?? null,
    });
  }

  @Post(":id/annul")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async annul(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(annulEmployeeDocumentSchema))
    input: Parameters<EmployeeDocumentsService["annul"]>[2],
  ) {
    return this.employeeDocumentsService.annul(user, id, input);
  }

  @Post(":id/replace")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async replace(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(replaceEmployeeDocumentSchema))
    input: Parameters<EmployeeDocumentsService["replace"]>[2],
  ) {
    return this.employeeDocumentsService.replace(user, id, input);
  }

  @Post(":id/verify")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async verify(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(verifyEmployeeDocumentSchema))
    input: Parameters<EmployeeDocumentsService["verify"]>[2],
  ) {
    return this.employeeDocumentsService.verify(user, id, input);
  }
}
