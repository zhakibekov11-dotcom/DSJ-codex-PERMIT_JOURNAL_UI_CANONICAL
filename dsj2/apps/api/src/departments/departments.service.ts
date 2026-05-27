import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { getCompanyScope, requireCompanyScope } from "../common/utils/tenant-scope";

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(user: AuthenticatedUser, companyId?: string) {
    const scopedCompanyId = getCompanyScope(user, companyId);

    return this.prisma.department.findMany({
      where: scopedCompanyId ? { companyId: scopedCompanyId } : undefined,
      include: {
        _count: {
          select: {
            employees: true,
            briefingRecords: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });
  }

  async create(
    user: AuthenticatedUser,
    input: { companyId?: string; name: string; code?: string | null },
  ) {
    const companyId = requireCompanyScope(user, input.companyId);

    const department = await this.prisma.department.create({
      data: {
        companyId,
        name: input.name,
        code: input.code ?? null,
      },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId,
      action: "department.created",
      entityType: "Department",
      entityId: department.id,
      metadata: {
        departmentName: department.name,
      },
    });

    return department;
  }
}
