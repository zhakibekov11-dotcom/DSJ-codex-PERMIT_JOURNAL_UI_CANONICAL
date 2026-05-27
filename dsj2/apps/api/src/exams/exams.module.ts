import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { TrainingProgramsModule } from "../training-programs/training-programs.module";
import { ExamsController } from "./exams.controller";
import { ExamsService } from "./exams.service";

@Module({
  imports: [AuditModule, TrainingProgramsModule],
  controllers: [ExamsController],
  providers: [ExamsService],
})
export class ExamsModule {}
