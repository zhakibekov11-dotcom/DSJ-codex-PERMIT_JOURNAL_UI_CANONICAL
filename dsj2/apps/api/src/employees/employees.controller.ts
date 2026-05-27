import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import {
  archiveEmployeeSchema,
  createEmployeeSchema,
  employeeFilterSchema,
  updateEmployeeSchema,
} from "@dsj/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { EmployeeComplianceService } from "./employee-compliance.service";
import { EmployeesService } from "./employees.service";

@Controller("employees")
export class EmployeesController {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly employeeComplianceService: EmployeeComplianceService,
  ) {}

  @Get()
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(employeeFilterSchema.partial()))
    filters: Parameters<EmployeesService["list"]>[1],
  ) {
    return this.employeesService.list(user, filters);
  }

  @Get(":id/card")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async getCard(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.employeeComplianceService.getCard(user, id);
  }

  @Get(":id")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.employeesService.findOne(user, id);
  }

  @Post()
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createEmployeeSchema))
    input: Parameters<EmployeesService["create"]>[1],
  ) {
    return this.employeesService.create(user, input);
  }

  @Patch(":id")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateEmployeeSchema))
    input: Parameters<EmployeesService["update"]>[2],
  ) {
    return this.employeesService.update(user, id, input);
  }

  @Post(":id/recalculate-admission")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async recalculateAdmission(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.employeeComplianceService.recalculate(user, id);
  }

  @Post(":id/archive")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(archiveEmployeeSchema))
    input: { companyId?: string },
  ) {
    return this.employeesService.archive(user, id, input.companyId);
  }
}
