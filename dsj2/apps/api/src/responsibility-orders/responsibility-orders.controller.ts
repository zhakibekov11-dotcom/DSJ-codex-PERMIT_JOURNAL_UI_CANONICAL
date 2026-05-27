import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res } from "@nestjs/common";
import {
  annulResponsibilityOrderSchema,
  createResponsibilityOrderSchema,
  prepareResponsibilityOrderForSigningSchema,
  responsibilityAppointmentFilterSchema,
  responsibilityOrderFilterSchema,
  replaceResponsibilityOrderSchema,
  signResponsibilityOrderSchema,
  updateResponsibilityOrderSchema,
} from "@dsj/types";
import type { Request, Response } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { ResponsibilityOrdersService } from "./responsibility-orders.service";

@Controller("responsibility-orders")
export class ResponsibilityOrdersController {
  constructor(private readonly responsibilityOrdersService: ResponsibilityOrdersService) {}

  @Get()
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(responsibilityOrderFilterSchema.partial()))
    filters: Parameters<ResponsibilityOrdersService["list"]>[1],
  ) {
    return this.responsibilityOrdersService.list(user, filters);
  }

  @Get("appointments")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async listAppointments(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(responsibilityAppointmentFilterSchema.partial()))
    filters: Parameters<ResponsibilityOrdersService["listAppointments"]>[1],
  ) {
    return this.responsibilityOrdersService.listAppointments(user, filters);
  }

  @Get("my")
  @Roles("EMPLOYEE_SIGNER")
  async listMy(@CurrentUser() user: AuthenticatedUser) {
    return this.responsibilityOrdersService.listMy(user);
  }

  @Get(":id")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.responsibilityOrdersService.findOne(user, id);
  }

  @Get(":id/download")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER", "EMPLOYEE_SIGNER")
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Res() response: Response,
  ) {
    const buffer = await this.responsibilityOrdersService.download(user, id);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="responsibility-order-${id}.pdf"`,
    );
    response.send(buffer);
  }

  @Post()
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createResponsibilityOrderSchema))
    input: Parameters<ResponsibilityOrdersService["create"]>[1],
  ) {
    return this.responsibilityOrdersService.create(user, input);
  }

  @Patch(":id")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateResponsibilityOrderSchema))
    input: Parameters<ResponsibilityOrdersService["update"]>[2],
  ) {
    return this.responsibilityOrdersService.update(user, id, input);
  }

  @Post(":id/prepare-sign")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async prepareForSigning(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(prepareResponsibilityOrderForSigningSchema))
    input: Parameters<ResponsibilityOrdersService["prepareForSigning"]>[2],
  ) {
    return this.responsibilityOrdersService.prepareForSigning(user, id, input);
  }

  @Post(":id/sign")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async sign(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Req() request: Request,
    @Body(new ZodValidationPipe(signResponsibilityOrderSchema))
    input: Parameters<ResponsibilityOrdersService["sign"]>[2],
  ) {
    return this.responsibilityOrdersService.sign(user, id, input, {
      ipAddress: request.ip ?? null,
      userAgent: request.get("user-agent") ?? null,
    });
  }

  @Post(":id/annul")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async annul(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(annulResponsibilityOrderSchema))
    input: Parameters<ResponsibilityOrdersService["annul"]>[2],
  ) {
    return this.responsibilityOrdersService.annul(user, id, input);
  }

  @Post(":id/replace")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async replace(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(replaceResponsibilityOrderSchema))
    input: Parameters<ResponsibilityOrdersService["replace"]>[2],
  ) {
    return this.responsibilityOrdersService.replace(user, id, input);
  }
}
