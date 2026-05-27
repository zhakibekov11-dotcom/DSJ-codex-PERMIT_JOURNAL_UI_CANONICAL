import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import {
  annulBriefingSchema,
  briefingFilterSchema,
  createBriefingSchema,
  replaceBriefingSchema,
  updateBriefingSchema,
} from "@dsj/types";
import type { Response } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { BriefingRecordsService } from "./briefing-records.service";

@Controller("briefing-records")
export class BriefingRecordsController {
  constructor(private readonly briefingRecordsService: BriefingRecordsService) {}

  @Get("export/journal.pdf")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async exportJournalPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(briefingFilterSchema))
    filters: Parameters<BriefingRecordsService["list"]>[1],
    @Res() response: Response,
  ) {
    const buffer = await this.briefingRecordsService.exportJournalPdf(user, filters);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", 'attachment; filename="zhurnal-instruktazhey.pdf"');
    response.send(buffer);
  }

  @Get()
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(briefingFilterSchema))
    filters: Parameters<BriefingRecordsService["list"]>[1],
  ) {
    return this.briefingRecordsService.list(user, filters);
  }

  @Get("my")
  @Roles("EMPLOYEE_SIGNER")
  async listMy(@CurrentUser() user: AuthenticatedUser) {
    return this.briefingRecordsService.listMy(user);
  }

  @Get(":id")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER", "EMPLOYEE_SIGNER")
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.briefingRecordsService.findOne(user, id);
  }

  @Get(":id/export/pdf")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER", "EMPLOYEE_SIGNER")
  async exportRecordPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Res() response: Response,
  ) {
    const buffer = await this.briefingRecordsService.exportRecordPdf(user, id);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="instruktazh-${id}.pdf"`);
    response.send(buffer);
  }

  @Post()
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createBriefingSchema))
    input: Parameters<BriefingRecordsService["create"]>[1],
  ) {
    return this.briefingRecordsService.create(user, input);
  }

  @Patch(":id")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateBriefingSchema))
    input: Parameters<BriefingRecordsService["update"]>[2],
  ) {
    return this.briefingRecordsService.update(user, id, input);
  }

  @Post(":id/prepare-signing")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async prepareForSigning(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.briefingRecordsService.prepareForSigning(user, id);
  }

  @Post(":id/archive")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async archive(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.briefingRecordsService.archive(user, id);
  }

  @Post(":id/annul")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async annul(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(annulBriefingSchema))
    input: Parameters<BriefingRecordsService["annul"]>[2],
  ) {
    return this.briefingRecordsService.annul(user, id, input);
  }

  @Post(":id/replace")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async replace(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(replaceBriefingSchema))
    input: Parameters<BriefingRecordsService["replace"]>[2],
  ) {
    return this.briefingRecordsService.replace(user, id, input);
  }

  @Get(":id/evidence")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER", "EMPLOYEE_SIGNER")
  async evidence(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.briefingRecordsService.evidence(user, id);
  }

  @Get(":id/archive-summary")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER", "EMPLOYEE_SIGNER")
  async archiveSummary(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.briefingRecordsService.archiveSummary(user, id);
  }

  @Post(":id/open")
  @Roles("EMPLOYEE_SIGNER")
  async markOpened(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.briefingRecordsService.markOpened(user, id);
  }

  @Post(":id/acknowledge")
  @Roles("EMPLOYEE_SIGNER")
  async acknowledge(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.briefingRecordsService.acknowledge(user, id);
  }
}
