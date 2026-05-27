import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { getCompanyScope } from "../common/utils/tenant-scope";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(user: AuthenticatedUser, requestedCompanyId?: string) {
    const organizationId = getCompanyScope(user, requestedCompanyId);
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);

    const [
      totalEmployees,
      completedBriefings,
      unsignedRecords,
      overdueRepeatBriefings,
      expiringActions,
      recentBriefingEntries,
    ] =
      await Promise.all([
        this.prisma.employee.count({
          where: {
            ...(organizationId ? { companyId: organizationId } : {}),
            status: "active",
          },
        }),
        this.prisma.briefingJournalEntry.count({
          where: {
            ...(organizationId ? { organizationId } : {}),
            status: "SIGNED",
          },
        }),
        this.prisma.briefingJournalEntry.count({
          where: {
            ...(organizationId ? { organizationId } : {}),
            status: "SIGNING_READY",
          },
        }),
        this.prisma.briefingJournalEntry.count({
          where: {
            ...(organizationId ? { organizationId } : {}),
            briefingType: "REPEATED",
            status: {
              notIn: ["SIGNED", "ARCHIVED"],
            },
            briefingDate: { lt: now },
          },
        }),
        this.prisma.reminder.count({
          where: {
            ...(organizationId ? { companyId: organizationId } : {}),
            status: "pending",
            dueAt: {
              lte: nextWeek,
            },
          },
        }),
        this.prisma.briefingJournalEntry.findMany({
          where: {
            ...(organizationId ? { organizationId } : {}),
          },
          orderBy: {
            briefingDate: "desc",
          },
          take: 6,
        }),
      ]);

    const employees = recentBriefingEntries.length
      ? await this.prisma.employee.findMany({
          where: {
            id: { in: [...new Set(recentBriefingEntries.map((entry) => entry.employeeId))] },
            ...(organizationId ? { companyId: organizationId } : {}),
          },
          select: {
            id: true,
            fullName: true,
          },
        })
      : [];
    const employeeNames = new Map(employees.map((employee) => [employee.id, employee.fullName]));
    const recentBriefings = recentBriefingEntries.map((entry) => ({
      id: entry.id,
      documentNumber: entry.registrationNo,
      briefingType: entry.briefingType,
      briefingDate: entry.briefingDate.toISOString(),
      status: entry.status,
      employee: {
        fullName: employeeNames.get(entry.employeeId) ?? "Неизвестный сотрудник",
      },
    }));

    return {
      metrics: [
        {
          label: "Активные сотрудники",
          value: totalEmployees,
          deltaLabel: "Сотрудники в текущем контуре",
          tone: "neutral",
        },
        {
          label: "Завершённые инструктажи",
          value: completedBriefings,
          deltaLabel: "Подписаны и готовы к аудиту",
          tone: "positive",
        },
        {
          label: "Неподписанные записи",
          value: unsignedRecords,
          deltaLabel: "Требуют действия подписанта",
          tone: unsignedRecords > 0 ? "warning" : "positive",
        },
        {
          label: "Просроченные повторные инструктажи",
          value: overdueRepeatBriefings,
          deltaLabel: "Операционный риск несоответствия",
          tone: overdueRepeatBriefings > 0 ? "danger" : "positive",
        },
      ],
      overdueRepeatBriefings,
      unsignedRecords,
      readyForSigning: unsignedRecords,
      expiringActions,
      recentBriefings,
    };
  }
}
