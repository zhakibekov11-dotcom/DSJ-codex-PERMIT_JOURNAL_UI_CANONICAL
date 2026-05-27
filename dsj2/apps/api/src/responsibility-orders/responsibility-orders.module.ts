import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { CorePlatformModule } from "../core-platform/core-platform.module";
import { EmployeesModule } from "../employees/employees.module";
import { PdfModule } from "../pdf/pdf.module";
import { MockSigningProvider } from "../signatures/providers/mock-signing.provider";
import { NcalayerSigningProvider } from "../signatures/providers/ncalayer-signing.provider";
import { ResponsibilityOrdersController } from "./responsibility-orders.controller";
import { ResponsibilityOrdersService } from "./responsibility-orders.service";

@Module({
  imports: [AuditModule, PdfModule, CorePlatformModule, EmployeesModule],
  controllers: [ResponsibilityOrdersController],
  providers: [ResponsibilityOrdersService, MockSigningProvider, NcalayerSigningProvider],
  exports: [ResponsibilityOrdersService],
})
export class ResponsibilityOrdersModule {}
