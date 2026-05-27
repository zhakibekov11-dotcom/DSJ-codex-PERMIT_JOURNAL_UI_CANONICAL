import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { BiotCardsModule } from "./biot-cards/biot-cards.module";
import { BriefingRecordsModule } from "./briefing-records/briefing-records.module";
import { CompaniesModule } from "./companies/companies.module";
import { CompanyDocumentsModule } from "./company-documents/company-documents.module";
import { RolesGuard } from "./common/guards/roles.guard";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { CorrespondenceModule } from "./correspondence/correspondence.module";
import { PrismaModule } from "./database/prisma.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { DepartmentsModule } from "./departments/departments.module";
import { EmployeesModule } from "./employees/employees.module";
import { EmployeeDocumentsModule } from "./employee-documents/employee-documents.module";
import { ExamsModule } from "./exams/exams.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PdfModule } from "./pdf/pdf.module";
import { ProtocolsModule } from "./protocols/protocols.module";
import { ResponsibilityOrdersModule } from "./responsibility-orders/responsibility-orders.module";
import { SafetyCertificatesModule } from "./safety-certificates/safety-certificates.module";
import { SignaturesModule } from "./signatures/signatures.module";
import { SigningModule } from "./signing/signing.module";
import { ContractorCompaniesModule } from "./contractor-companies/contractor-companies.module";
import { CorePlatformModule } from "./core-platform/core-platform.module";
import { TrainingProgramsModule } from "./training-programs/training-programs.module";
import { TranslationsModule } from "./translations/translations.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env.local", "../../.env"],
    }),
    PrismaModule,
    AuthModule,
    BiotCardsModule,
    BriefingRecordsModule,
    CompaniesModule,
    CompanyDocumentsModule,
    CorrespondenceModule,
    ContractorCompaniesModule,
    CorePlatformModule,
    DepartmentsModule,
    EmployeesModule,
    EmployeeDocumentsModule,
    DashboardModule,
    ExamsModule,
    NotificationsModule,
    PdfModule,
    ProtocolsModule,
    ResponsibilityOrdersModule,
    SafetyCertificatesModule,
    SignaturesModule,
    SigningModule,
    TrainingProgramsModule,
    TranslationsModule,
    UsersModule,
    AuditModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
