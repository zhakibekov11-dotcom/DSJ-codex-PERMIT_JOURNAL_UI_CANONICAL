import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { CorePlatformModule } from "../core-platform/core-platform.module";
import { EmployeesModule } from "../employees/employees.module";
import { PdfModule } from "../pdf/pdf.module";
import { MockSigningProvider } from "../signatures/providers/mock-signing.provider";
import { NcalayerSigningProvider } from "../signatures/providers/ncalayer-signing.provider";
import { ProtocolsController } from "./protocols.controller";
import { ProtocolsService } from "./protocols.service";

@Module({
  imports: [AuditModule, PdfModule, CorePlatformModule, EmployeesModule],
  controllers: [ProtocolsController],
  providers: [ProtocolsService, MockSigningProvider, NcalayerSigningProvider],
  exports: [ProtocolsService],
})
export class ProtocolsModule {}
