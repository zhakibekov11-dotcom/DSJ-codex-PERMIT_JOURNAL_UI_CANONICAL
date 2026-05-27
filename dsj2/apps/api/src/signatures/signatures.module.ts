import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { CorePlatformModule } from "../core-platform/core-platform.module";
import { EmployeesModule } from "../employees/employees.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { MockSigningProvider } from "./providers/mock-signing.provider";
import { NcalayerSigningProvider } from "./providers/ncalayer-signing.provider";
import { SignaturesController } from "./signatures.controller";
import { SignaturesService } from "./signatures.service";

@Module({
  imports: [AuditModule, NotificationsModule, CorePlatformModule, EmployeesModule],
  controllers: [SignaturesController],
  providers: [SignaturesService, MockSigningProvider, NcalayerSigningProvider],
})
export class SignaturesModule {}

