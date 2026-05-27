import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../database/prisma.module";
import { PdfModule } from "../pdf/pdf.module";
import { CompanyDocumentsController } from "./company-documents.controller";
import { CompanyDocumentsService } from "./company-documents.service";

@Module({
  imports: [AuditModule, PrismaModule, PdfModule],
  controllers: [CompanyDocumentsController],
  providers: [CompanyDocumentsService],
})
export class CompanyDocumentsModule {}
