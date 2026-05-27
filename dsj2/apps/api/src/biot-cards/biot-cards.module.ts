import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { BiotCardsController } from "./biot-cards.controller";
import { BiotCardsService } from "./biot-cards.service";

@Module({
  imports: [AuditModule],
  controllers: [BiotCardsController],
  providers: [BiotCardsService],
})
export class BiotCardsModule {}
