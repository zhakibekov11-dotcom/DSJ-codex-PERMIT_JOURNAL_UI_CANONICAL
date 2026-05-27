import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import {
  createTrainingProgramSchema,
  trainingProgramFilterSchema,
} from "@dsj/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { TrainingProgramsService } from "./training-programs.service";

@Controller("training-assignments")
export class TrainingProgramsController {
  constructor(private readonly trainingProgramsService: TrainingProgramsService) {}

  @Get()
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(trainingProgramFilterSchema.partial()))
    filters: Parameters<TrainingProgramsService["list"]>[1],
  ) {
    return this.trainingProgramsService.list(user, filters);
  }

  @Get("my")
  @Roles("EMPLOYEE_SIGNER")
  async listMy(@CurrentUser() user: AuthenticatedUser) {
    return this.trainingProgramsService.listMy(user);
  }

  @Get(":id")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER", "EMPLOYEE_SIGNER")
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.trainingProgramsService.findOne(user, id);
  }

  @Post()
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createTrainingProgramSchema))
    input: Parameters<TrainingProgramsService["create"]>[1],
  ) {
    return this.trainingProgramsService.create(user, input);
  }

  @Post(":id/start")
  @Roles("EMPLOYEE_SIGNER")
  async startMy(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.trainingProgramsService.startMy(user, id);
  }

  @Post(":id/complete")
  @Roles("EMPLOYEE_SIGNER")
  async completeMy(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.trainingProgramsService.completeMy(user, id);
  }
}
