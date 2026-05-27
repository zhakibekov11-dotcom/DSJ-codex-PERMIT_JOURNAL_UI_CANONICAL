import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";

type AuditPayload = {
  companyId?: string | null;
  actorUserId?: string | null;
  briefingRecordId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(payload: AuditPayload) {
    return this.prisma.auditLog.create({
      data: {
        companyId: payload.companyId ?? null,
        actorUserId: payload.actorUserId ?? null,
        briefingRecordId: payload.briefingRecordId ?? null,
        action: payload.action,
        entityType: payload.entityType,
        entityId: payload.entityId,
        metadata: (payload.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        ipAddress: payload.ipAddress ?? null,
        userAgent: payload.userAgent ?? null,
      },
    });
  }

  async list(companyId: string | null, limit = 30, entityType?: string) {
    return this.prisma.auditLog.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(entityType ? { entityType } : {}),
      },
      include: {
        actorUser: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });
  }
}
