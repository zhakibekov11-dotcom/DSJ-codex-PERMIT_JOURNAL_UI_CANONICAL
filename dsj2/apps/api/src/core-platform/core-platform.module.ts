import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PdfModule } from "../pdf/pdf.module";
import { MockSigningProvider } from "../signatures/providers/mock-signing.provider";
import { NcalayerSigningProvider } from "../signatures/providers/ncalayer-signing.provider";
import { CorePlatformController } from "./core-platform.controller";
import { CorePlatformService } from "./core-platform.service";
import { WorkPermitsService } from "./work-permits.service";

@Module({
  imports: [AuditModule, PdfModule],
  controllers: [CorePlatformController],
  providers: [
    CorePlatformService,
    WorkPermitsService,
    MockSigningProvider,
    NcalayerSigningProvider,
  ],
  exports: [CorePlatformService, WorkPermitsService],
})
export class CorePlatformModule {}
