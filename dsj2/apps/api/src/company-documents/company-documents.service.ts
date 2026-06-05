import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  CompanyDocumentFilters,
  CreateCompanyDocumentInput,
} from "@dsj/types";
import { Prisma } from "@prisma/client";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import {
  assertPythonModuleAvailable,
  assertPython3Available,
  assertReadablePath,
  getPythonCommand,
  getPythonProcessEnv,
  toRuntimeDependencyError,
} from "../common/utils/runtime-dependencies";
import {
  assertCompanyAccess,
  getCompanyScope,
  requireCompanyScope,
} from "../common/utils/tenant-scope";
import {
  getWorkspaceRoot,
  resolveWorkspacePath,
} from "../common/utils/workspace-path";
import { PrismaService } from "../database/prisma.service";
import { PdfService } from "../pdf/pdf.service";

const companyDocumentInclude = {
  company: true,
  createdByUser: true,
} satisfies Prisma.CompanyDocumentInclude;

type RawCompanyDocument = Prisma.CompanyDocumentGetPayload<{
  include: typeof companyDocumentInclude;
}>;

const COMPANY_DOCUMENT_DOCX_SCRIPT_PATH =
  "scripts/generate_company_document_docx.py";

@Injectable()
export class CompanyDocumentsService {
  private readonly workspaceRoot = getWorkspaceRoot(__dirname);
  private readonly docxGeneratorScriptPath = resolveWorkspacePath(
    __dirname,
    COMPANY_DOCUMENT_DOCX_SCRIPT_PATH,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly pdfService: PdfService,
  ) {}

  private mapDocument(record: RawCompanyDocument) {
    return {
      id: record.id,
      companyId: record.companyId,
      createdByUserId: record.createdByUserId,
      category: record.category,
      documentName: record.documentName,
      title: record.title,
      summary: record.summary,
      body: record.body,
      issueDate: record.issueDate,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdByUserName: record.createdByUser.fullName,
    };
  }

  private async findRawById(id: string) {
    const record = await this.prisma.companyDocument.findUnique({
      where: { id },
      include: companyDocumentInclude,
    });

    if (!record) {
      throw new NotFoundException("Документ компании не найден.");
    }

    return record;
  }

  private async ensureAccess(
    user: AuthenticatedUser,
    record: RawCompanyDocument,
  ) {
    assertCompanyAccess(user, record.companyId);
  }

  private buildFileName(record: RawCompanyDocument, extension: "pdf" | "docx") {
    return `company-document-${record.id}.${extension}`;
  }

  private async renderDocx(record: RawCompanyDocument) {
    await Promise.all([
      assertReadablePath(
        this.docxGeneratorScriptPath,
        "DOCX generator script for company documents is missing on the server.",
      ),
      assertPython3Available(
        "python3 is required to generate company document DOCX files on the server.",
      ),
      assertPythonModuleAvailable(
        "docx",
        "python-docx is required to generate company document DOCX files on the server.",
      ),
    ]);

    const workingDirectory = await mkdtemp(
      join(tmpdir(), "dsj-company-document-"),
    );
    const outputPath = join(workingDirectory, "company-document.docx");

    try {
      await new Promise<void>((resolvePromise, rejectPromise) => {
        const processHandle = spawn(
          getPythonCommand(),
          [this.docxGeneratorScriptPath, outputPath],
          {
            cwd: this.workspaceRoot,
            env: getPythonProcessEnv(),
            stdio: ["pipe", "ignore", "pipe"],
          },
        );

        let stderrOutput = "";

        processHandle.stderr.on("data", (chunk) => {
          stderrOutput += chunk.toString("utf8");
        });

        processHandle.on("error", (error) => {
          rejectPromise(error);
        });

        processHandle.on("close", (code) => {
          if (code === 0) {
            resolvePromise();
            return;
          }

          rejectPromise(
            new Error(
              stderrOutput.trim() ||
                `Генератор Word-файла завершился с кодом ${code}.`,
            ),
          );
        });

        processHandle.stdin.write(
          Buffer.from(
            JSON.stringify({
              companyName: record.company.name,
              category: record.category,
              documentName: record.documentName,
              title: record.title,
              summary: record.summary,
              body: record.body,
              issueDate: record.issueDate?.toISOString() ?? null,
              status: record.status,
              createdByUserName: record.createdByUser.fullName,
              createdAt: record.createdAt.toISOString(),
              updatedAt: record.updatedAt.toISOString(),
            }),
            "utf8",
          ),
        );
        processHandle.stdin.end();
      });

      return await readFile(outputPath);
    } catch (error) {
      throw toRuntimeDependencyError(
        error,
        "Не удалось сформировать Word-файл документа.",
      );
    } finally {
      await rm(workingDirectory, { recursive: true, force: true }).catch(
        () => undefined,
      );
    }
  }

  async list(user: AuthenticatedUser, filters: CompanyDocumentFilters) {
    const companyId = getCompanyScope(user, filters.companyId);

    const documents = await this.prisma.companyDocument.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.search
          ? {
              OR: [
                {
                  title: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                },
                {
                  documentName: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                },
                {
                  summary: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                },
                {
                  createdByUser: {
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
      include: companyDocumentInclude,
      orderBy: [{ category: "asc" }, { updatedAt: "desc" }],
    });

    return documents.map((record) => this.mapDocument(record));
  }

  async create(user: AuthenticatedUser, input: CreateCompanyDocumentInput) {
    const companyId = requireCompanyScope(user, input.companyId);

    const record = await this.prisma.companyDocument.create({
      data: {
        companyId,
        createdByUserId: user.userId,
        category: input.category,
        documentName: input.documentName.trim(),
        title: input.title.trim(),
        summary: input.summary?.trim() || null,
        body: input.body.trim(),
        issueDate: input.issueDate ? new Date(input.issueDate) : null,
        status: input.status,
      },
      include: companyDocumentInclude,
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId,
      action: "company_document.created",
      entityType: "CompanyDocument",
      entityId: record.id,
      metadata: {
        category: record.category,
        documentName: record.documentName,
        title: record.title,
      },
    });

    return this.mapDocument(record);
  }

  async downloadPdf(user: AuthenticatedUser, id: string) {
    const record = await this.findRawById(id);
    await this.ensureAccess(user, record);

    return {
      fileName: this.buildFileName(record, "pdf"),
      buffer: await this.pdfService.renderCompanyDocument({
        companyName: record.company.name,
        category: record.category,
        documentName: record.documentName,
        title: record.title,
        summary: record.summary,
        body: record.body,
        issueDate: record.issueDate,
        status: record.status,
        createdByUserName: record.createdByUser.fullName,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }),
    };
  }

  async downloadDocx(user: AuthenticatedUser, id: string) {
    const record = await this.findRawById(id);
    await this.ensureAccess(user, record);

    return {
      fileName: this.buildFileName(record, "docx"),
      buffer: await this.renderDocx(record),
    };
  }
}
