import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PdfModule } from "../pdf/pdf.module";
import { MockSigningProvider } from "../signatures/providers/mock-signing.provider";
import { NcalayerSigningProvider } from "../signatures/providers/ncalayer-signing.provider";
import { CorePlatformController } from "./core-platform.controller";
import { CorePlatformService } from "./core-platform.service";
import { ContractorAccessActsService } from "./contractor-access-acts.service";
import { WorkPermitsService } from "./work-permits.service";

@Module({
  imports: [AuditModule, PdfModule],
  controllers: [CorePlatformController],
  providers: [
    CorePlatformService,
    ContractorAccessActsService,
    WorkPermitsService,
    MockSigningProvider,
    NcalayerSigningProvider,
  ],
  exports: [CorePlatformService, ContractorAccessActsService, WorkPermitsService],
})
export class CorePlatformModule {}
