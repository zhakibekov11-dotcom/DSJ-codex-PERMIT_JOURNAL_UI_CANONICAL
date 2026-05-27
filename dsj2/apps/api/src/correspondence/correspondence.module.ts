import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../database/prisma.module";
import { PdfModule } from "../pdf/pdf.module";
import { CorrespondenceAiService } from "./correspondence-ai.service";
import { CorrespondenceController } from "./correspondence.controller";
import { CorrespondenceService } from "./correspondence.service";

@Module({
  imports: [PrismaModule, AuditModule, PdfModule],
  controllers: [CorrespondenceController],
  providers: [CorrespondenceService, CorrespondenceAiService],
})
export class CorrespondenceModule {}
