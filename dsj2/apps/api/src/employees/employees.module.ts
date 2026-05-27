import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { EmployeeComplianceService } from "./employee-compliance.service";
import { EmployeesController } from "./employees.controller";
import { EmployeesService } from "./employees.service";

@Module({
  imports: [AuditModule],
  controllers: [EmployeesController],
  providers: [EmployeesService, EmployeeComplianceService],
  exports: [EmployeesService, EmployeeComplianceService],
})
export class EmployeesModule {}

