import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { createCompanySchema } from "@dsj/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { CompaniesService } from "./companies.service";

@Controller("companies")
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("companyId") companyId?: string,
  ) {
    return this.companiesService.list(user, companyId);
  }

  @Post()
  @Roles("SUPER_ADMIN")
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCompanySchema))
    input: Parameters<CompaniesService["create"]>[1],
  ) {
    return this.companiesService.create(user, input);
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN")
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.companiesService.remove(user, id);
  }
}
