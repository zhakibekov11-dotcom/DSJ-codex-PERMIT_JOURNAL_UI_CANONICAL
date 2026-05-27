import { Injectable } from "@nestjs/common";
import type { UserRole } from "@dsj/types";
import { PrismaService } from "../database/prisma.service";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { getCompanyScope } from "../common/utils/tenant-scope";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser, role?: UserRole, companyId?: string) {
    const scopedCompanyId = getCompanyScope(user, companyId);

    return this.prisma.user.findMany({
      where: {
        ...(scopedCompanyId ? { companyId: scopedCompanyId } : {}),
        ...(role ? { role } : {}),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        companyId: true,
        departmentId: true,
      },
      orderBy: [{ role: "asc" }, { fullName: "asc" }],
    });
  }
}
