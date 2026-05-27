import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { createContractorCompanySchema, updateContractorCompanySchema } from "@dsj/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { ContractorCompaniesService } from "./contractor-companies.service";

@Controller("contractor-companies")
export class ContractorCompaniesController {
  constructor(private readonly contractorCompaniesService: ContractorCompaniesService) {}

  @Get()
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("companyId") companyId?: string,
  ) {
    return this.contractorCompaniesService.list(user, companyId);
  }

  @Post()
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createContractorCompanySchema))
    input: Parameters<ContractorCompaniesService["create"]>[1],
  ) {
    return this.contractorCompaniesService.create(user, input);
  }

  @Patch(":id")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateContractorCompanySchema))
    input: Parameters<ContractorCompaniesService["update"]>[2],
  ) {
    return this.contractorCompaniesService.update(user, id, input);
  }

  @Delete(":id")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Query("companyId") companyId?: string,
  ) {
    return this.contractorCompaniesService.remove(user, id, companyId);
  }
}
