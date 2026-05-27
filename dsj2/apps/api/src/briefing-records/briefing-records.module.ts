import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { CorePlatformModule } from "../core-platform/core-platform.module";
import { EmployeesModule } from "../employees/employees.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PdfModule } from "../pdf/pdf.module";
import { BriefingRecordsController } from "./briefing-records.controller";
import { BriefingRecordsService } from "./briefing-records.service";

@Module({
  imports: [AuditModule, NotificationsModule, PdfModule, CorePlatformModule, EmployeesModule],
  controllers: [BriefingRecordsController],
  providers: [BriefingRecordsService],
  exports: [BriefingRecordsService],
})
export class BriefingRecordsModule {}

