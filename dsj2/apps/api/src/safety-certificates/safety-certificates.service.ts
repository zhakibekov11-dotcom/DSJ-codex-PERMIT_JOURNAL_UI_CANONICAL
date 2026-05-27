import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateSafetyCertificateInput,
  SafetyCertificateFilters,
} from "@dsj/types";
import { Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { requireEmployeeScope } from "../common/utils/employee-scope";
import {
  assertCompanyAccess,
  getCompanyScope,
  requireCompanyScope,
} from "../common/utils/tenant-scope";
import { PrismaService } from "../database/prisma.service";
import { PdfService } from "../pdf/pdf.service";

type RawSafetyCertificate = Awaited<ReturnType<SafetyCertificatesService["findRawById"]>>;

@Injectable()
export class SafetyCertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly pdfService: PdfService,
  ) {}

  private getEffectiveStatus(certificate: {
    status: RawSafetyCertificate["status"];
    expiryDate: Date;
  }) {
    const now = Date.now();
    const expiryTime = certificate.expiryDate.getTime();
    const thirtyDaysAhead = now + 1000 * 60 * 60 * 24 * 30;

    if (expiryTime < now) {
      return "EXPIRED" as const;
    }

    if (expiryTime <= thirtyDaysAhead) {
      return "EXPIRING_SOON" as const;
    }

    return certificate.status === "EXPIRED" ? "EXPIRED" : "ACTIVE";
  }

  private mapCertificate(certificate: RawSafetyCertificate) {
    const status = this.getEffectiveStatus(certificate);

    return {
      id: certificate.id,
      companyId: certificate.companyId,
      employeeId: certificate.employeeId,
      trainingAssignmentId: certificate.trainingAssignmentId,
      documentId: certificate.documentId,
      certificateNumber: certificate.certificateNumber,
      issueDate: certificate.issueDate,
      expiryDate: certificate.expiryDate,
      issuerName: certificate.issuerName,
      status,
      fileName: certificate.fileName,
      fileUrl: certificate.fileUrl,
      employee: {
        id: certificate.employee.id,
        fullName: certificate.employee.fullName,
        employeeNumber: certificate.employee.employeeNumber,
        jobTitle: certificate.employee.jobTitle,
      },
      trainingAssignment: certificate.trainingAssignment
        ? {
            id: certificate.trainingAssignment.id,
            trainingProgram: {
              id: certificate.trainingAssignment.trainingProgram.id,
              title: certificate.trainingAssignment.trainingProgram.title,
            },
          }
        : null,
      document: certificate.document
        ? {
            id: certificate.document.id,
            title: certificate.document.title,
          }
        : null,
    };
  }

  private async findRawById(id: string) {
    const certificate = await this.prisma.safetyCertificate.findUnique({
      where: { id },
      include: {
        employee: true,
        trainingAssignment: {
          include: {
            trainingProgram: true,
          },
        },
        document: true,
      },
    });

    if (!certificate) {
      throw new NotFoundException("Удостоверение не найдено.");
    }

    return certificate;
  }

  private async ensureEmployee(companyId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        companyId,
      },
    });

    if (!employee) {
      throw new NotFoundException("Сотрудник не найден.");
    }

    return employee;
  }

  private async ensureAccess(user: AuthenticatedUser, certificate: RawSafetyCertificate) {
    if (user.role === "EMPLOYEE_SIGNER") {
      const employee = await requireEmployeeScope(this.prisma, user);

      if (employee.id !== certificate.employeeId) {
        throw new NotFoundException("Удостоверение не найдено.");
      }

      return;
    }

    assertCompanyAccess(user, certificate.companyId);
  }

  private mapCertificateStatusToDocumentStatus(status: "ACTIVE" | "EXPIRING_SOON" | "EXPIRED") {
    if (status === "EXPIRING_SOON") {
      return "EXPIRING" as const;
    }

    if (status === "EXPIRED") {
      return "EXPIRED" as const;
    }

    return "ACTIVE" as const;
  }

  async list(user: AuthenticatedUser, filters: SafetyCertificateFilters) {
    const companyId = getCompanyScope(user, filters.companyId);
    const certificates = await this.prisma.safetyCertificate.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
        ...(filters.search
          ? {
              OR: [
                {
                  certificateNumber: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                },
                {
                  issuerName: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                },
                {
                  employee: {
                    fullName: {
                      contains: filters.search,
                      mode: "insensitive",
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        employee: true,
        trainingAssignment: {
          include: {
            trainingProgram: true,
          },
        },
        document: true,
      },
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
    });

    const mapped = certificates.map((certificate) => this.mapCertificate(certificate));

    if (filters.status) {
      return mapped.filter((certificate) => certificate.status === filters.status);
    }

    return mapped;
  }

  async listMy(user: AuthenticatedUser) {
    const employee = await requireEmployeeScope(this.prisma, user);
    const certificates = await this.prisma.safetyCertificate.findMany({
      where: {
        employeeId: employee.id,
      },
      include: {
        employee: true,
        trainingAssignment: {
          include: {
            trainingProgram: true,
          },
        },
        document: true,
      },
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
    });

    return certificates.map((certificate) => this.mapCertificate(certificate));
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const certificate = await this.findRawById(id);
    await this.ensureAccess(user, certificate);
    return this.mapCertificate(certificate);
  }

  async create(user: AuthenticatedUser, input: CreateSafetyCertificateInput) {
    const companyId = requireCompanyScope(user, input.companyId);
    const employee = await this.ensureEmployee(companyId, input.employeeId);
    const issueDate = new Date(input.issueDate);
    const expiryDate = new Date(input.expiryDate);

    let certificateId = "";

    try {
      await this.prisma.$transaction(async (transaction) => {
        const effectiveStatus = this.getEffectiveStatus({
          status: input.status,
          expiryDate,
        });

        const linkedDocument = await transaction.employeeDocument.create({
          data: {
            companyId,
            employeeId: input.employeeId,
            title: `Удостоверение по ТБ №${input.certificateNumber}`,
            documentType: "SAFETY_CERTIFICATE",
            issueDate,
            expiryDate,
            issuerName: input.issuerName,
            status: this.mapCertificateStatusToDocumentStatus(effectiveStatus),
            fileName: input.fileName ?? null,
            fileUrl: input.fileUrl ?? null,
          },
        });

        const certificate = await transaction.safetyCertificate.create({
          data: {
            companyId,
            employeeId: input.employeeId,
            documentId: linkedDocument.id,
            certificateNumber: input.certificateNumber,
            issueDate,
            expiryDate,
            issuerName: input.issuerName,
            status: input.status,
            fileName: input.fileName ?? null,
            fileUrl: input.fileUrl ?? null,
          },
        });

        certificateId = certificate.id;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Удостоверение с таким номером уже существует в этой компании.");
      }

      throw error;
    }

    await this.auditService.log({
      actorUserId: user.userId,
      companyId,
      action: "certificate.created",
      entityType: "SafetyCertificate",
      entityId: certificateId,
      metadata: {
        employeeId: employee.id,
        certificateNumber: input.certificateNumber,
      },
    });

    return this.findOne(user, certificateId);
  }

  async download(user: AuthenticatedUser, id: string) {
    const certificate = await this.findRawById(id);
    await this.ensureAccess(user, certificate);

    return this.pdfService.renderSafetyCertificate({
      certificateNumber: certificate.certificateNumber,
      issueDate: certificate.issueDate,
      expiryDate: certificate.expiryDate,
      status: this.getEffectiveStatus(certificate),
      issuerName: certificate.issuerName,
      employee: {
        fullName: certificate.employee.fullName,
        employeeNumber: certificate.employee.employeeNumber,
        jobTitle: certificate.employee.jobTitle,
      },
      trainingTitle: certificate.trainingAssignment?.trainingProgram.title ?? null,
    });
  }
}
