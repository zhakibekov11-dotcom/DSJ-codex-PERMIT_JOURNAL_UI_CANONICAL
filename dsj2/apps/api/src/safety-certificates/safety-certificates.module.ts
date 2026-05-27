import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PdfModule } from "../pdf/pdf.module";
import { SafetyCertificatesController } from "./safety-certificates.controller";
import { SafetyCertificatesService } from "./safety-certificates.service";

@Module({
  imports: [AuditModule, PdfModule],
  controllers: [SafetyCertificatesController],
  providers: [SafetyCertificatesService],
  exports: [SafetyCertificatesService],
})
export class SafetyCertificatesModule {}
