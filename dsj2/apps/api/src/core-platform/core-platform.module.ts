import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { CorePlatformController } from "./core-platform.controller";
import { CorePlatformService } from "./core-platform.service";

@Module({
  imports: [AuditModule],
  controllers: [CorePlatformController],
  providers: [CorePlatformService],
  exports: [CorePlatformService],
})
export class CorePlatformModule {}
