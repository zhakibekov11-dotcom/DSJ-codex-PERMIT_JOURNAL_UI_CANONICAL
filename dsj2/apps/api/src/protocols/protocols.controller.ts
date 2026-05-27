import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res } from "@nestjs/common";
import {
  annulProtocolSchema,
  createProtocolSchema,
  prepareProtocolForSigningSchema,
  protocolFilterSchema,
  replaceProtocolSchema,
  signProtocolSchema,
  updateProtocolSchema,
} from "@dsj/types";
import type { Request, Response } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { ProtocolsService } from "./protocols.service";

@Controller("protocols")
export class ProtocolsController {
  constructor(private readonly protocolsService: ProtocolsService) {}

  @Get()
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(protocolFilterSchema.partial()))
    filters: Parameters<ProtocolsService["list"]>[1],
  ) {
    return this.protocolsService.list(user, filters);
  }

  @Get(":id")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.protocolsService.findOne(user, id);
  }

  @Get(":id/download")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Res() response: Response,
  ) {
    const buffer = await this.protocolsService.download(user, id);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="protocol-${id}.pdf"`);
    response.send(buffer);
  }

  @Post()
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createProtocolSchema))
    input: Parameters<ProtocolsService["create"]>[1],
  ) {
    return this.protocolsService.create(user, input);
  }

  @Patch(":id")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateProtocolSchema))
    input: Parameters<ProtocolsService["update"]>[2],
  ) {
    return this.protocolsService.update(user, id, input);
  }

  @Post(":id/prepare-sign")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async prepareForSigning(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(prepareProtocolForSigningSchema))
    input: Parameters<ProtocolsService["prepareForSigning"]>[2],
  ) {
    return this.protocolsService.prepareForSigning(user, id, input);
  }

  @Post(":id/sign")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async sign(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Req() request: Request,
    @Body(new ZodValidationPipe(signProtocolSchema))
    input: Parameters<ProtocolsService["sign"]>[2],
  ) {
    return this.protocolsService.sign(user, id, input, {
      ipAddress: request.ip ?? null,
      userAgent: request.get("user-agent") ?? null,
    });
  }

  @Post(":id/annul")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async annul(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(annulProtocolSchema))
    input: Parameters<ProtocolsService["annul"]>[2],
  ) {
    return this.protocolsService.annul(user, id, input);
  }

  @Post(":id/replace")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async replace(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(replaceProtocolSchema))
    input: Parameters<ProtocolsService["replace"]>[2],
  ) {
    return this.protocolsService.replace(user, id, input);
  }
}
