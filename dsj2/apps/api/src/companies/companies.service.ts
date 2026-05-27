import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { hash } from "bcryptjs";
import { PrismaService } from "../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { getCompanyScope } from "../common/utils/tenant-scope";

type CreateCompanyInput = {
  name: string;
  bin?: string | null;
  industry?: string | null;
  timezone: string;
  responsibleFullName: string;
  responsibleEmail: string;
  responsiblePassword: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(user: AuthenticatedUser, companyId?: string) {
    const scopedCompanyId = getCompanyScope(user, companyId);
    const companies = await this.prisma.company.findMany({
      where: scopedCompanyId ? { id: scopedCompanyId } : undefined,
      include: {
        _count: {
          select: {
            employees: true,
            briefingRecords: true,
            users: true,
          },
        },
        users: {
          where: {
            role: "COMPANY_ADMIN",
            isActive: true,
          },
          select: {
            id: true,
            fullName: true,
            email: true,
            lastLoginAt: true,
          },
          orderBy: {
            createdAt: "asc",
          },
          take: 1,
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return companies.map(({ users, ...company }) => ({
      ...company,
      responsibleAdmin: users[0] ?? null,
    }));
  }

  async create(user: AuthenticatedUser, input: CreateCompanyInput) {
    const normalizedResponsibleEmail = normalizeEmail(input.responsibleEmail);

    try {
      const company = await this.prisma.$transaction(async (transaction) => {
        const company = await transaction.company.create({
          data: {
            name: input.name,
            bin: input.bin ?? null,
            industry: input.industry ?? null,
            timezone: input.timezone,
          },
        });

        const responsibleAdmin = await transaction.user.create({
          data: {
            companyId: company.id,
            email: normalizedResponsibleEmail,
            passwordHash: await hash(input.responsiblePassword, 12),
            fullName: input.responsibleFullName.trim(),
            role: "COMPANY_ADMIN",
          },
          select: {
            id: true,
            fullName: true,
            email: true,
            lastLoginAt: true,
          },
        });

        return {
          ...company,
          responsibleAdmin,
        };
      });

      await this.auditService.log({
        actorUserId: user.userId,
        companyId: company.id,
        action: "company.created",
        entityType: "Company",
        entityId: company.id,
        metadata: {
          companyName: company.name,
          responsibleAdminName: company.responsibleAdmin.fullName,
          responsibleAdminEmail: company.responsibleAdmin.email,
        },
      });

      return company;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = Array.isArray(error.meta?.target) ? error.meta.target : [];

        if (target.includes("bin")) {
          throw new ConflictException("Компания с таким БИН уже существует.");
        }

        if (target.includes("email")) {
          throw new ConflictException(
            "Пользователь с таким email уже существует. Укажите другой email для ответственного.",
          );
        }
      }

      throw error;
    }
  }

  async remove(user: AuthenticatedUser, id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            employees: true,
            briefingRecords: true,
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException("Компания не найдена.");
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.user.updateMany({
        where: {
          companyId: company.id,
          role: "SUPER_ADMIN",
        },
        data: {
          companyId: null,
          departmentId: null,
          siteId: null,
        },
      });

      await transaction.user.deleteMany({
        where: {
          companyId: company.id,
          role: {
            not: "SUPER_ADMIN",
          },
        },
      });

      await transaction.company.delete({
        where: { id: company.id },
      });
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: null,
      action: "company.deleted",
      entityType: "Company",
      entityId: company.id,
      metadata: {
        companyName: company.name,
        removedUsers: company._count.users,
        removedEmployees: company._count.employees,
        removedBriefings: company._count.briefingRecords,
      },
    });

    return {
      success: true,
    };
  }
}
