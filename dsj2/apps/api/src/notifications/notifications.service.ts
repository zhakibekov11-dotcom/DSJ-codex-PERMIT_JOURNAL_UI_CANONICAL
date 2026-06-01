import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { getCompanyScope } from "../common/utils/tenant-scope";

type ReminderInput = {
  companyId: string;
  briefingRecordId: string;
  employeeId: string;
  type: "UNSIGNED_RECORD_PENDING";
  title: string;
  message: string;
  dueAt: Date;
  assigneeUserId: string;
};

type SigningInviteInput = {
  companyId: string;
  briefingRecordId: string;
  assigneeUserId: string;
  channel: "IN_APP" | "EMAIL";
  scheduledAt?: Date;
  payload: {
    title: string;
    message: string;
    link: string;
    employeeName: string;
    contractorCompanyName?: string | null;
    deliveryTarget?: string | null;
  };
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async queueUnsignedReminder(input: ReminderInput) {
    return this.prisma.$transaction(async (transaction) => {
      const existingReminder = await transaction.reminder.findFirst({
        where: {
          companyId: input.companyId,
          briefingRecordId: input.briefingRecordId,
          type: input.type,
          status: {
            in: ["pending", "sent"],
          },
        },
      });

      if (existingReminder) {
        return existingReminder;
      }

      const reminder = await transaction.reminder.create({
        data: {
          companyId: input.companyId,
          briefingRecordId: input.briefingRecordId,
          employeeId: input.employeeId,
          type: input.type,
          title: input.title,
          message: input.message,
          dueAt: input.dueAt,
        },
      });

      await transaction.notificationJob.create({
        data: {
          companyId: input.companyId,
          reminderId: reminder.id,
          briefingRecordId: input.briefingRecordId,
          assigneeUserId: input.assigneeUserId,
          channel: "IN_APP",
          type: input.type,
          scheduledAt: new Date(),
          payload: {
            title: input.title,
            message: input.message,
          },
        },
      });

      return reminder;
    });
  }

  async queueSigningInvite(input: SigningInviteInput) {
    return this.prisma.$transaction(async (transaction) => {
      const existingJob = await transaction.notificationJob.findFirst({
        where: {
          companyId: input.companyId,
          briefingRecordId: input.briefingRecordId,
          type: "SIGNING_LINK_INVITE",
          status: {
            in: ["queued", "processing", "sent"],
          },
        },
      });

      if (existingJob) {
        return existingJob;
      }

      return transaction.notificationJob.create({
        data: {
          companyId: input.companyId,
          briefingRecordId: input.briefingRecordId,
          assigneeUserId: input.assigneeUserId,
          channel: input.channel,
          type: "SIGNING_LINK_INVITE",
          scheduledAt: input.scheduledAt ?? new Date(),
          payload: input.payload,
        },
      });
    });
  }

  async resolveBriefingReminders(companyId: string, briefingRecordId: string) {
    await this.prisma.reminder.updateMany({
      where: {
        companyId,
        briefingRecordId,
        status: {
          in: ["pending", "sent"],
        },
      },
      data: {
        status: "resolved",
        resolvedAt: new Date(),
      },
    });

    await this.prisma.notificationJob.updateMany({
      where: {
        companyId,
        briefingRecordId,
        status: {
          in: ["queued", "processing"],
        },
      },
      data: {
        status: "skipped",
        processedAt: new Date(),
      },
    });
  }

  async list(user: AuthenticatedUser, requestedCompanyId?: string) {
    const companyId = getCompanyScope(user, requestedCompanyId);

    return this.prisma.notificationJob.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
      },
      include: {
        reminder: true,
        briefingRecord: true,
        assigneeUser: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: {
        scheduledAt: "desc",
      },
      take: 50,
    });
  }
}
