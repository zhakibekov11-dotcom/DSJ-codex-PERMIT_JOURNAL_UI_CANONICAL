import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CreateContractorCompanyInput,
  UpdateContractorCompanyInput,
} from "@dsj/types";
import { Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import {
  getCompanyScope,
  requireCompanyScope,
} from "../common/utils/tenant-scope";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class ContractorCompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(user: AuthenticatedUser, companyId?: string) {
    const scopedCompanyId = getCompanyScope(user, companyId);

    return this.prisma.contractorCompany.findMany({
      where: scopedCompanyId ? { companyId: scopedCompanyId } : undefined,
      include: {
        _count: {
          select: {
            employees: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });
  }

  async create(user: AuthenticatedUser, input: CreateContractorCompanyInput) {
    const companyId = requireCompanyScope(user, input.companyId);

    try {
      const contractorCompany = await this.prisma.contractorCompany.create({
        data: {
          companyId,
          name: input.name,
          bin: input.bin ?? null,
          contactEmail: input.contactEmail ?? null,
          contactPhone: input.contactPhone ?? null,
          notes: input.notes ?? null,
        },
      });

      await this.auditService.log({
        actorUserId: user.userId,
        companyId,
        action: "contractor_company.created",
        entityType: "ContractorCompany",
        entityId: contractorCompany.id,
        metadata: {
          contractorCompanyName: contractorCompany.name,
        },
      });

      return contractorCompany;
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    input: UpdateContractorCompanyInput,
  ) {
    const existing = await this.prisma.contractorCompany.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException("Подрядная организация не найдена.");
    }

    requireCompanyScope(user, existing.companyId);

    try {
      const contractorCompany = await this.prisma.contractorCompany.update({
        where: { id },
        data: {
          name: input.name,
          bin: input.bin ?? null,
          contactEmail: input.contactEmail ?? null,
          contactPhone: input.contactPhone ?? null,
          notes: input.notes ?? null,
          isActive: input.isActive ?? existing.isActive,
        },
      });

      await this.auditService.log({
        actorUserId: user.userId,
        companyId: contractorCompany.companyId,
        action: "contractor_company.updated",
        entityType: "ContractorCompany",
        entityId: contractorCompany.id,
        metadata: {
          contractorCompanyName: contractorCompany.name,
          isActive: contractorCompany.isActive,
        },
      });

      return contractorCompany;
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  async remove(user: AuthenticatedUser, id: string, _companyId?: string) {
    const existing = await this.prisma.contractorCompany.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            employees: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException("Подрядная организация не найдена.");
    }

    requireCompanyScope(user, existing.companyId);

    await this.prisma.contractorCompany.delete({
      where: { id },
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: existing.companyId,
      action: "contractor_company.deleted",
      entityType: "ContractorCompany",
      entityId: existing.id,
      metadata: {
        contractorCompanyName: existing.name,
        detachedEmployees: existing._count.employees,
      },
    });

    return {
      success: true,
    };
  }

  private handlePersistenceError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException(
        "Подрядная организация с таким названием уже существует в этой компании.",
      );
    }

    throw error;
  }
}
