import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { CorePlatformModule } from "../core-platform/core-platform.module";
import { EmployeesModule } from "../employees/employees.module";
import { PdfModule } from "../pdf/pdf.module";
import { MockSigningProvider } from "../signatures/providers/mock-signing.provider";
import { NcalayerSigningProvider } from "../signatures/providers/ncalayer-signing.provider";
import { EmployeeDocumentsController } from "./employee-documents.controller";
import { EmployeeDocumentsService } from "./employee-documents.service";

@Module({
  imports: [AuditModule, PdfModule, CorePlatformModule, EmployeesModule],
  controllers: [EmployeeDocumentsController],
  providers: [EmployeeDocumentsService, MockSigningProvider, NcalayerSigningProvider],
  exports: [EmployeeDocumentsService],
})
export class EmployeeDocumentsModule {}
