import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { hash } from "bcryptjs";
import type {
  CreateEmployeeInput,
  EmployeeFilters,
  UpdateEmployeeInput,
} from "@dsj/types";
import {
  encryptSensitiveValue,
  hashSensitiveValue,
  hashSensitiveValueLegacy,
  maskIin,
} from "@dsj/database";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import {
  getCompanyScope,
  requireCompanyScope,
} from "../common/utils/tenant-scope";

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private mapEmployee(
    employee: Awaited<ReturnType<EmployeesService["findRawById"]>>,
  ) {
    return {
      id: employee.id,
      companyId: employee.companyId,
      departmentId: employee.departmentId,
      siteId: employee.siteId,
      positionId: employee.positionId,
      userId: employee.userId,
      contractorCompanyId: employee.contractorCompanyId,
      fullName: employee.fullName,
      employeeNumber: employee.employeeNumber,
      jobTitle: employee.jobTitle,
      jobTitleKz: employee.jobTitleKz,
      photoDataUrl: employee.photoDataUrl,
      photoFileName: employee.photoFileName,
      email: employee.email,
      phone: employee.phone,
      employeeKind: employee.employeeKind,
      status: employee.status,
      iinMasked: maskIin(employee.iinLast4.padStart(12, "*")),
      department: employee.department,
      site: employee.site,
      position: employee.position,
      contractorCompany: employee.contractorCompany,
      hasAccount: Boolean(employee.user),
      accountEmail: employee.user?.email ?? null,
      accountRole: employee.user?.role ?? null,
      hasEmployeeSignerAccount:
        employee.user?.role === "EMPLOYEE_SIGNER" && employee.user.isActive,
      briefingCount: employee._count.briefingRecords,
      createdAt: employee.createdAt,
    };
  }

  private normalizeEmail(value?: string | null) {
    const normalized = value?.trim().toLowerCase() ?? "";
    return normalized.length > 0 ? normalized : null;
  }

  private buildIinHashes(iin: string) {
    return {
      current: hashSensitiveValue(iin),
      legacy: hashSensitiveValueLegacy(iin),
    };
  }

  private async ensureIinAvailable(
    companyId: string,
    iin: string,
    currentEmployeeId?: string,
  ) {
    const hashes = this.buildIinHashes(iin);
    const duplicate = await this.prisma.employee.findFirst({
      where: {
        companyId,
        iinHash: {
          in: [...new Set([hashes.current, hashes.legacy])],
        },
        ...(currentEmployeeId ? { id: { not: currentEmployeeId } } : {}),
      },
      select: {
        id: true,
      },
    });

    if (duplicate) {
      throw new ConflictException(
        "Сотрудник с таким ИИН уже существует в этой компании.",
      );
    }

    return hashes;
  }

  private getEmployeeKindSearchClauses(
    search: string,
  ): Prisma.EmployeeWhereInput[] {
    const normalized = search.trim().toLowerCase();
    const clauses: Prisma.EmployeeWhereInput[] = [];

    if (
      ["contractor", "подряд", "подрядчик", "подрядной", "контракт"].some(
        (marker) => normalized.includes(marker),
      )
    ) {
      clauses.push({ employeeKind: "CONTRACTOR" });
    }

    if (
      ["internal", "штат", "штатный", "внутрен", "сотрудник"].some((marker) =>
        normalized.includes(marker),
      )
    ) {
      clauses.push({ employeeKind: "INTERNAL" });
    }

    return clauses;
  }

  private async ensureContractorCompany(
    companyId: string,
    contractorCompanyId?: string | null,
  ) {
    if (!contractorCompanyId) {
      return null;
    }

    const contractorCompany = await this.prisma.contractorCompany.findFirst({
      where: {
        id: contractorCompanyId,
        companyId,
      },
    });

    if (!contractorCompany) {
      throw new NotFoundException("Подрядная компания не найдена.");
    }

    return contractorCompany;
  }

  private async ensureDepartment(
    companyId: string,
    departmentId?: string | null,
  ) {
    if (!departmentId) {
      return null;
    }

    const department = await this.prisma.department.findFirst({
      where: {
        id: departmentId,
        companyId,
      },
    });

    if (!department) {
      throw new BadRequestException(
        "Укажите подразделение из той же компании.",
      );
    }

    return department;
  }

  private async ensureSite(companyId: string, siteId?: string | null) {
    if (!siteId) {
      return null;
    }

    const site = await this.prisma.site.findFirst({
      where: {
        id: siteId,
        companyId,
      },
    });

    if (!site) {
      throw new BadRequestException("Укажите площадку из той же компании.");
    }

    return site;
  }

  private async ensurePosition(companyId: string, positionId?: string | null) {
    if (!positionId) {
      return null;
    }

    const position = await this.prisma.position.findFirst({
      where: {
        id: positionId,
        organizationId: companyId,
      },
    });

    if (!position) {
      throw new BadRequestException("Укажите позицию из той же организации.");
    }

    return position;
  }

  private async findRawById(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        department: true,
        site: true,
        position: true,
        user: true,
        contractorCompany: true,
        _count: {
          select: {
            briefingRecords: true,
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException("Сотрудник не найден.");
    }

    return employee;
  }

  async list(user: AuthenticatedUser, filters: EmployeeFilters) {
    const companyId = getCompanyScope(user, filters.companyId);

    const employees = await this.prisma.employee.findMany({
      where: {
        companyId,
        isArchived: false,
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
        ...(filters.siteId ? { siteId: filters.siteId } : {}),
        ...(filters.positionId ? { positionId: filters.positionId } : {}),
        ...(filters.contractorCompanyId
          ? { contractorCompanyId: filters.contractorCompanyId }
          : {}),
        ...(filters.employeeKind ? { employeeKind: filters.employeeKind } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.search
          ? {
              OR: [
                {
                  fullName: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                },
                {
                  employeeNumber: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                },
                {
                  jobTitle: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                },
                {
                  email: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                },
                {
                  contractorCompany: {
                    is: {
                      name: {
                        contains: filters.search,
                        mode: "insensitive",
                      },
                    },
                  },
                },
                ...this.getEmployeeKindSearchClauses(filters.search),
              ],
            }
          : {}),
      },
      include: {
        department: true,
        site: true,
        position: true,
        user: true,
        contractorCompany: true,
        _count: {
          select: {
            briefingRecords: true,
          },
        },
      },
      orderBy: {
        fullName: "asc",
      },
    });

    return employees.map((employee) => this.mapEmployee(employee));
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const employee = await this.findRawById(id);
    getCompanyScope(user, employee.companyId);
    return this.mapEmployee(employee);
  }

  async create(user: AuthenticatedUser, input: CreateEmployeeInput) {
    const companyId = requireCompanyScope(user, input.companyId);
    const contractorCompany = await this.ensureContractorCompany(
      companyId,
      input.contractorCompanyId,
    );
    const departmentId = input.departmentId ?? null;
    const siteId = input.siteId ?? null;
    const positionId = input.positionId ?? null;
    await Promise.all([
      this.ensureDepartment(companyId, departmentId),
      this.ensureSite(companyId, siteId),
      this.ensurePosition(companyId, positionId),
    ]);
    const employeeKind = contractorCompany ? "CONTRACTOR" : input.employeeKind;
    const shouldCreateAccount = input.createAccount === true;
    const normalizedEmail = this.normalizeEmail(input.email);

    if (shouldCreateAccount && !normalizedEmail) {
      throw new BadRequestException(
        "Укажите email сотрудника для создания личного кабинета.",
      );
    }

    if (shouldCreateAccount && !input.accountPassword) {
      throw new BadRequestException(
        "Укажите временный пароль для личного кабинета сотрудника.",
      );
    }

    const iinHashes = await this.ensureIinAvailable(companyId, input.iin);
    let employee;

    try {
      employee = await this.prisma.$transaction(async (transaction) => {
        let linkedUserId: string | null = null;

        if (shouldCreateAccount) {
          const existingUser = await transaction.user.findUnique({
            where: {
              email: normalizedEmail!,
            },
          });

          if (existingUser) {
            throw new ConflictException(
              "Пользователь с таким email уже существует.",
            );
          }

          const employeeUser = await transaction.user.create({
            data: {
              companyId,
              departmentId,
              siteId,
              email: normalizedEmail!,
              passwordHash: await hash(input.accountPassword!, 12),
              fullName: input.fullName,
              role: "EMPLOYEE_SIGNER",
            },
          });

          linkedUserId = employeeUser.id;
        }

        return transaction.employee.create({
          data: {
            companyId,
            departmentId,
            siteId,
            positionId,
            userId: linkedUserId,
            contractorCompanyId: contractorCompany?.id ?? null,
            fullName: input.fullName,
            iinEncrypted: encryptSensitiveValue(input.iin),
            iinHash: iinHashes.current,
            iinLast4: input.iin.slice(-4),
            employeeNumber: input.employeeNumber,
            jobTitle: input.jobTitle,
            jobTitleKz: input.jobTitleKz ?? null,
            photoDataUrl: input.photoDataUrl ?? null,
            photoFileName: input.photoDataUrl
              ? (input.photoFileName ?? null)
              : null,
            email: normalizedEmail,
            phone: input.phone ?? null,
            employeeKind,
            status: input.status,
          },
        });
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const target = Array.isArray(error.meta?.target)
          ? error.meta.target
          : [];

        if (target.includes("iinHash")) {
          throw new ConflictException(
            "Сотрудник с таким ИИН уже существует в этой компании.",
          );
        }

        if (target.includes("employeeNumber")) {
          throw new ConflictException(
            "Сотрудник с таким табельным номером уже существует в этой компании.",
          );
        }
      }

      throw error;
    }

    await this.auditService.log({
      actorUserId: user.userId,
      companyId,
      action: "employee.created",
      entityType: "Employee",
      entityId: employee.id,
      metadata: {
        employeeNumber: employee.employeeNumber,
        fullName: employee.fullName,
        employeeKind: employee.employeeKind,
        hasAccount: shouldCreateAccount,
        positionId: employee.positionId,
      },
    });

    return this.findOne(user, employee.id);
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    input: UpdateEmployeeInput,
  ) {
    const existing = await this.findRawById(id);
    getCompanyScope(user, existing.companyId);
    const contractorCompany = await this.ensureContractorCompany(
      existing.companyId,
      input.contractorCompanyId === undefined
        ? existing.contractorCompanyId
        : input.contractorCompanyId,
    );
    const departmentId = input.departmentId ?? existing.departmentId;
    const siteId = input.siteId ?? existing.siteId;
    const positionId = input.positionId ?? existing.positionId;
    await Promise.all([
      this.ensureDepartment(existing.companyId, departmentId),
      this.ensureSite(existing.companyId, siteId),
      this.ensurePosition(existing.companyId, positionId),
    ]);
    const employeeKind = contractorCompany
      ? "CONTRACTOR"
      : (input.employeeKind ?? existing.employeeKind);
    const shouldCreateAccount = input.createAccount === true;
    const normalizedEmail = this.normalizeEmail(
      input.email === undefined ? existing.email : input.email,
    );
    const iinHashes = input.iin
      ? await this.ensureIinAvailable(
          existing.companyId,
          input.iin,
          existing.id,
        )
      : null;

    if (shouldCreateAccount && !existing.userId && !normalizedEmail) {
      throw new BadRequestException(
        "Укажите email сотрудника для создания личного кабинета.",
      );
    }

    if (shouldCreateAccount && !existing.userId && !input.accountPassword) {
      throw new BadRequestException(
        "Укажите временный пароль для личного кабинета сотрудника.",
      );
    }

    try {
      await this.prisma.$transaction(async (transaction) => {
        let linkedUserId = existing.userId;

        if (existing.userId) {
          const updates: Prisma.UserUncheckedUpdateInput = {
            companyId: existing.companyId,
            departmentId,
            siteId,
            fullName: input.fullName ?? existing.fullName,
          };

          if (normalizedEmail && normalizedEmail !== existing.user?.email) {
            const duplicate = await transaction.user.findUnique({
              where: {
                email: normalizedEmail,
              },
            });

            if (duplicate && duplicate.id !== existing.userId) {
              throw new ConflictException(
                "Пользователь с таким email уже существует.",
              );
            }

            updates.email = normalizedEmail;
          }

          if (input.accountPassword) {
            updates.passwordHash = await hash(input.accountPassword, 12);
          }

          await transaction.user.update({
            where: { id: existing.userId },
            data: updates,
          });
        } else if (shouldCreateAccount) {
          const duplicate = await transaction.user.findUnique({
            where: {
              email: normalizedEmail!,
            },
          });

          if (duplicate) {
            throw new ConflictException(
              "Пользователь с таким email уже существует.",
            );
          }

          const employeeUser = await transaction.user.create({
            data: {
              companyId: existing.companyId,
              departmentId,
              siteId,
              email: normalizedEmail!,
              passwordHash: await hash(input.accountPassword!, 12),
              fullName: input.fullName ?? existing.fullName,
              role: "EMPLOYEE_SIGNER",
            },
          });

          linkedUserId = employeeUser.id;
        }

        await transaction.employee.update({
          where: { id },
          data: {
            departmentId,
            siteId,
            positionId,
            userId: linkedUserId,
            contractorCompanyId: contractorCompany?.id ?? null,
            fullName: input.fullName ?? existing.fullName,
            employeeNumber: input.employeeNumber ?? existing.employeeNumber,
            jobTitle: input.jobTitle ?? existing.jobTitle,
            jobTitleKz:
              input.jobTitleKz === undefined
                ? existing.jobTitleKz
                : input.jobTitleKz,
            photoDataUrl:
              input.removePhoto === true
                ? null
                : input.photoDataUrl === undefined
                  ? existing.photoDataUrl
                  : input.photoDataUrl,
            photoFileName:
              input.removePhoto === true
                ? null
                : input.photoDataUrl === undefined
                  ? existing.photoFileName
                  : input.photoDataUrl
                    ? (input.photoFileName ?? existing.photoFileName)
                    : null,
            email: normalizedEmail,
            phone: input.phone === undefined ? existing.phone : input.phone,
            employeeKind,
            status: input.status ?? existing.status,
            ...(input.iin
              ? {
                  iinEncrypted: encryptSensitiveValue(input.iin),
                  iinHash: iinHashes!.current,
                  iinLast4: input.iin.slice(-4),
                }
              : {}),
          },
        });
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const target = Array.isArray(error.meta?.target)
          ? error.meta.target
          : [];

        if (target.includes("iinHash")) {
          throw new ConflictException(
            "Сотрудник с таким ИИН уже существует в этой компании.",
          );
        }

        if (target.includes("employeeNumber")) {
          throw new ConflictException(
            "Сотрудник с таким табельным номером уже существует в этой компании.",
          );
        }
      }

      throw error;
    }

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: existing.companyId,
      action: "employee.updated",
      entityType: "Employee",
      entityId: id,
      metadata: {
        employeeNumber: input.employeeNumber ?? existing.employeeNumber,
        employeeKind,
        hasAccount: existing.userId ? true : shouldCreateAccount,
        positionId,
      },
    });

    return this.findOne(user, id);
  }

  async archive(user: AuthenticatedUser, id: string, companyIdInput?: string) {
    const existing = await this.findRawById(id);
    requireCompanyScope(user, companyIdInput ?? existing.companyId);

    if (existing.isArchived) {
      throw new BadRequestException(
        "Сотрудник уже уволен и убран из активного списка.",
      );
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.employee.update({
        where: { id },
        data: {
          status: "inactive",
          isArchived: true,
        },
      });

      if (existing.userId) {
        await transaction.user.update({
          where: { id: existing.userId },
          data: {
            isActive: false,
          },
        });
      }
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: existing.companyId,
      action: "employee.archived",
      entityType: "Employee",
      entityId: id,
      metadata: {
        employeeNumber: existing.employeeNumber,
        fullName: existing.fullName,
        hadAccount: Boolean(existing.userId),
      },
    });

    return {
      id,
      archived: true,
    };
  }
}
