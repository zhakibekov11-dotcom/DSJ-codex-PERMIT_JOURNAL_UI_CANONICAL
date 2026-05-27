import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { optionalPublicSignBriefingSchema, publicSignBriefingSchema } from "@dsj/types";
import type { Request } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { SignaturesService } from "./signatures.service";

@Controller("signatures")
export class SignaturesController {
  constructor(private readonly signaturesService: SignaturesService) {}

  @Get("briefing-records/:briefingRecordId")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER", "EMPLOYEE_SIGNER")
  async listForRecord(
    @CurrentUser() user: AuthenticatedUser,
    @Param("briefingRecordId") briefingRecordId: string,
  ) {
    return this.signaturesService.listForRecord(user, briefingRecordId);
  }

  @Post("briefing-records/:briefingRecordId/sign")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER", "EMPLOYEE_SIGNER")
  async signBriefingRecord(
    @CurrentUser() user: AuthenticatedUser,
    @Param("briefingRecordId") briefingRecordId: string,
    @Req() request: Request,
    @Body(new ZodValidationPipe(optionalPublicSignBriefingSchema))
    input: Parameters<SignaturesService["signBriefingRecord"]>[2],
  ) {
    return this.signaturesService.signBriefingRecord(user, briefingRecordId, input, {
      ipAddress: request.ip ?? null,
      userAgent: request.get("user-agent") ?? null,
    });
  }

  @Post("briefing-records/:briefingRecordId/mock-sign")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async mockSign(
    @CurrentUser() user: AuthenticatedUser,
    @Param("briefingRecordId") briefingRecordId: string,
    @Req() request: Request,
    @Body(new ZodValidationPipe(publicSignBriefingSchema))
    input: Parameters<SignaturesService["mockSign"]>[2],
  ) {
    return this.signaturesService.mockSign(user, briefingRecordId, input, {
      ipAddress: request.ip ?? null,
      userAgent: request.get("user-agent") ?? null,
    });
  }

  @Post("briefing-records/:briefingRecordId/employee-sign")
  @Roles("EMPLOYEE_SIGNER")
  async employeeSign(
    @CurrentUser() user: AuthenticatedUser,
    @Param("briefingRecordId") briefingRecordId: string,
    @Req() request: Request,
    @Body(new ZodValidationPipe(optionalPublicSignBriefingSchema))
    input: Parameters<SignaturesService["employeeSign"]>[2],
  ) {
    return this.signaturesService.employeeSign(user, briefingRecordId, input, {
      ipAddress: request.ip ?? null,
      userAgent: request.get("user-agent") ?? null,
    });
  }

  @Public()
  @Get("public/briefing-invites/:inviteToken")
  async getPublicInvite(@Param("inviteToken") inviteToken: string) {
    return this.signaturesService.getPublicInvite(inviteToken);
  }

  @Public()
  @Post("public/briefing-invites/:inviteToken/sign")
  async signPublicInvite(
    @Param("inviteToken") inviteToken: string,
    @Req() request: Request,
    @Body(new ZodValidationPipe(publicSignBriefingSchema))
    input: Parameters<SignaturesService["signPublicInvite"]>[1],
  ) {
    return this.signaturesService.signPublicInvite(inviteToken, input, {
      ipAddress: request.ip ?? null,
      userAgent: request.get("user-agent") ?? null,
    });
  }

  @Public()
  @Post("public/briefing-invites/:inviteToken/mock-sign")
  async publicMockSign(
    @Param("inviteToken") inviteToken: string,
    @Req() request: Request,
    @Body(new ZodValidationPipe(publicSignBriefingSchema))
    input: Parameters<SignaturesService["publicMockSign"]>[1],
  ) {
    return this.signaturesService.publicMockSign(inviteToken, input, {
      ipAddress: request.ip ?? null,
      userAgent: request.get("user-agent") ?? null,
    });
  }
}
