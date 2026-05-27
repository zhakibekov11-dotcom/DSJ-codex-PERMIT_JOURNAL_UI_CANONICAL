import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { TrainingProgramsController } from "./training-programs.controller";
import { TrainingProgramsService } from "./training-programs.service";

@Module({
  imports: [AuditModule],
  controllers: [TrainingProgramsController],
  providers: [TrainingProgramsService],
  exports: [TrainingProgramsService],
})
export class TrainingProgramsModule {}
