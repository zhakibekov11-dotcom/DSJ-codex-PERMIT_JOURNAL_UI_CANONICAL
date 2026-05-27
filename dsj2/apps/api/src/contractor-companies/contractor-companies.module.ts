import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { ContractorCompaniesController } from "./contractor-companies.controller";
import { ContractorCompaniesService } from "./contractor-companies.service";

@Module({
  imports: [AuditModule],
  controllers: [ContractorCompaniesController],
  providers: [ContractorCompaniesService],
  exports: [ContractorCompaniesService],
})
export class ContractorCompaniesModule {}
