import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import {
  createExamSchema,
  examFilterSchema,
  submitExamSchema,
} from "@dsj/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { ExamsService } from "./exams.service";

@Controller("exams")
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Get()
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(examFilterSchema.partial()))
    filters: Parameters<ExamsService["list"]>[1],
  ) {
    return this.examsService.list(user, filters);
  }

  @Get("my")
  @Roles("EMPLOYEE_SIGNER")
  async listMy(@CurrentUser() user: AuthenticatedUser) {
    return this.examsService.listMy(user);
  }

  @Get("my/:assignmentId")
  @Roles("EMPLOYEE_SIGNER")
  async findMy(
    @CurrentUser() user: AuthenticatedUser,
    @Param("assignmentId") assignmentId: string,
  ) {
    return this.examsService.findMy(user, assignmentId);
  }

  @Get(":id")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.examsService.findOne(user, id);
  }

  @Post()
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createExamSchema))
    input: Parameters<ExamsService["create"]>[1],
  ) {
    return this.examsService.create(user, input);
  }

  @Post("my/:assignmentId/start")
  @Roles("EMPLOYEE_SIGNER")
  async startMy(
    @CurrentUser() user: AuthenticatedUser,
    @Param("assignmentId") assignmentId: string,
  ) {
    return this.examsService.startMy(user, assignmentId);
  }

  @Post("my/:assignmentId/submit")
  @Roles("EMPLOYEE_SIGNER")
  async submitMy(
    @CurrentUser() user: AuthenticatedUser,
    @Param("assignmentId") assignmentId: string,
    @Body(new ZodValidationPipe(submitExamSchema))
    input: Parameters<ExamsService["submitMy"]>[2],
  ) {
    return this.examsService.submitMy(user, assignmentId, input);
  }
}
