import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CorrespondenceAiAssistInput,
  CorrespondenceFilters,
  CreateCorrespondenceInput,
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
import { CorrespondenceAiService } from "./correspondence-ai.service";

const correspondenceInclude = {
  company: true,
  createdByUser: true,
  recipients: {
    orderBy: [{ createdAt: "asc" }],
  },
} satisfies Prisma.CorrespondenceInclude;

type RawCorrespondence = Prisma.CorrespondenceGetPayload<{
  include: typeof correspondenceInclude;
}>;

const CORRESPONDENCE_DOCX_TEMPLATE_PATH =
  "docs/experimental/correspondence/stroy-company-2030-letter-template.docx";
const CORRESPONDENCE_DOCX_SCRIPT_PATH =
  "scripts/generate_correspondence_docx.py";
const STROY_COMPANY_WORD_TEMPLATE_MARKER = "stroy company 2030";
const EMAIL_TRANSPORT_NOT_CONFIGURED =
  "Email transport is not configured; correspondence was not sent externally.";

@Injectable()
export class CorrespondenceService {
  private readonly workspaceRoot = getWorkspaceRoot(__dirname);
  private readonly docxTemplatePath = resolveWorkspacePath(
    __dirname,
    CORRESPONDENCE_DOCX_TEMPLATE_PATH,
  );
  private readonly docxGeneratorScriptPath = resolveWorkspacePath(
    __dirname,
    CORRESPONDENCE_DOCX_SCRIPT_PATH,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly pdfService: PdfService,
    private readonly correspondenceAiService: CorrespondenceAiService,
  ) {}

  private mapCorrespondence(record: RawCorrespondence) {
    return {
      id: record.id,
      companyId: record.companyId,
      createdByUserId: record.createdByUserId,
      registryNumber: record.registryNumber,
      title: record.title,
      kind: record.kind,
      subject: record.subject,
      body: record.body,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      sentAt: record.sentAt,
      createdByUserName: record.createdByUser.fullName,
      wordTemplateAvailable: this.hasStroyWordTemplate(record),
      recipientsCount: record.recipients.length,
      recipients: record.recipients.map((recipient) => ({
        id: recipient.id,
        companyName: recipient.companyName,
        contactName: recipient.contactName,
        contactEmail: recipient.contactEmail,
        contactPosition: recipient.contactPosition,
        status: recipient.status,
        sentAt: recipient.sentAt,
        lastError: recipient.lastError,
      })),
    };
  }

  private async findRawById(id: string) {
    const correspondence = await this.prisma.correspondence.findUnique({
      where: { id },
      include: correspondenceInclude,
    });

    if (!correspondence) {
      throw new NotFoundException("Письмо или КП не найдено.");
    }

    return correspondence;
  }

  private async nextRegistryNumber(
    companyId: string,
    kind: "LETTER" | "COMMERCIAL_PROPOSAL",
  ) {
    const year = new Date().getFullYear();
    const shortYear = String(year).slice(-2);
    const prefix = kind === "COMMERCIAL_PROPOSAL" ? "КП" : "ИСХ";
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const nextYearStart = new Date(Date.UTC(year + 1, 0, 1));

    const count = await this.prisma.correspondence.count({
      where: {
        companyId,
        kind,
        createdAt: {
          gte: yearStart,
          lt: nextYearStart,
        },
      },
    });

    return `${prefix}/${shortYear}-${String(count + 1).padStart(5, "0")}`;
  }

  private async ensureAccess(
    user: AuthenticatedUser,
    record: RawCorrespondence,
  ) {
    assertCompanyAccess(user, record.companyId);
  }

  private hasStroyWordTemplate(record: RawCorrespondence) {
    return record.company.name
      .toLowerCase()
      .includes(STROY_COMPANY_WORD_TEMPLATE_MARKER);
  }

  private formatRuDate(date: Date) {
    const day = String(date.getUTCDate()).padStart(2, "0");
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const year = date.getUTCFullYear();
    return `${day}.${month}.${year} г.`;
  }

  private buildWordRecipients(record: RawCorrespondence) {
    return record.recipients.map((recipient) => ({
      companyName: recipient.companyName,
      contactName: recipient.contactName,
      contactEmail: recipient.contactEmail,
      contactPosition: recipient.contactPosition,
    }));
  }

  private async renderDocx(record: RawCorrespondence) {
    await Promise.all([
      assertReadablePath(
        this.docxTemplatePath,
        "Word-template for correspondence is missing on the server.",
      ),
      assertReadablePath(
        this.docxGeneratorScriptPath,
        "DOCX generator script for correspondence is missing on the server.",
      ),
      assertPython3Available(
        "python3 is required to generate correspondence DOCX files on the server.",
      ),
      assertPythonModuleAvailable(
        "docx",
        "python-docx is required to generate correspondence DOCX files on the server.",
      ),
    ]);

    const workingDirectory = await mkdtemp(
      join(tmpdir(), "dsj-correspondence-"),
    );
    const outputPath = join(workingDirectory, "correspondence.docx");

    try {
      await new Promise<void>((resolvePromise, rejectPromise) => {
        const processHandle = spawn(
          "python3",
          [this.docxGeneratorScriptPath, this.docxTemplatePath, outputPath],
          {
            cwd: this.workspaceRoot,
            stdio: ["pipe", "ignore", "pipe"],
          },
        );

        let stderrOutput = "";

        processHandle.stderr.on("data", (chunk) => {
          stderrOutput += chunk.toString();
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
                `Генератор письма завершился с кодом ${code}.`,
            ),
          );
        });

        processHandle.stdin.write(
          JSON.stringify({
            registryNumber: record.registryNumber,
            issueDateRu: this.formatRuDate(record.sentAt ?? record.createdAt),
            heading: record.subject,
            body: record.body,
            recipients: this.buildWordRecipients(record),
          }),
        );
        processHandle.stdin.end();
      });

      return await readFile(outputPath);
    } catch (error) {
      throw toRuntimeDependencyError(
        error,
        "Не удалось сформировать Word-файл письма.",
      );
    } finally {
      await rm(workingDirectory, { recursive: true, force: true }).catch(
        () => undefined,
      );
    }
  }

  async list(user: AuthenticatedUser, filters: CorrespondenceFilters) {
    const companyId = getCompanyScope(user, filters.companyId);
    const correspondences = await this.prisma.correspondence.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(filters.kind ? { kind: filters.kind } : {}),
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
                  subject: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                },
                {
                  registryNumber: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                },
                {
                  recipients: {
                    some: {
                      OR: [
                        {
                          companyName: {
                            contains: filters.search,
                            mode: "insensitive",
                          },
                        },
                        {
                          contactName: {
                            contains: filters.search,
                            mode: "insensitive",
                          },
                        },
                        {
                          contactEmail: {
                            contains: filters.search,
                            mode: "insensitive",
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: correspondenceInclude,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });

    return correspondences.map((record) => this.mapCorrespondence(record));
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const record = await this.findRawById(id);
    await this.ensureAccess(user, record);
    return this.mapCorrespondence(record);
  }

  async create(user: AuthenticatedUser, input: CreateCorrespondenceInput) {
    const companyId = requireCompanyScope(user, input.companyId);
    const registryNumber = await this.nextRegistryNumber(companyId, input.kind);

    const correspondence = await this.prisma.correspondence.create({
      data: {
        companyId,
        createdByUserId: user.userId,
        registryNumber,
        title: input.title,
        kind: input.kind,
        subject: input.subject,
        body: input.body,
        status: "DRAFT",
        recipients: {
          create: input.recipients.map((recipient) => ({
            companyName: recipient.companyName,
            contactName: recipient.contactName,
            contactEmail: recipient.contactEmail ?? null,
            contactPosition: recipient.contactPosition ?? null,
          })),
        },
      },
      include: correspondenceInclude,
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId,
      action: "correspondence.created",
      entityType: "Correspondence",
      entityId: correspondence.id,
      metadata: {
        registryNumber,
        kind: correspondence.kind,
        recipientsCount: correspondence.recipients.length,
      },
    });

    return this.mapCorrespondence(correspondence);
  }

  async send(user: AuthenticatedUser, id: string) {
    const record = await this.findRawById(id);
    await this.ensureAccess(user, record);

    if (!record.recipients.length) {
      throw new BadRequestException("Добавьте хотя бы одного получателя.");
    }

    let sentCount = 0;
    let failedCount = 0;
    let deferredCount = 0;

    await this.prisma.$transaction(async (transaction) => {
      for (const recipient of record.recipients) {
        if (!recipient.contactEmail) {
          failedCount += 1;
          await transaction.correspondenceRecipient.update({
            where: { id: recipient.id },
            data: {
              status: "FAILED",
              lastError: "Не указан email получателя.",
            },
          });
          continue;
        }

        deferredCount += 1;
        await transaction.correspondenceRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "PENDING",
            sentAt: null,
            lastError: EMAIL_TRANSPORT_NOT_CONFIGURED,
          },
        });
      }

      await transaction.correspondence.update({
        where: { id: record.id },
        data: {
          status: "READY_TO_SEND",
          sentAt: null,
        },
      });
    });

    await this.auditService.log({
      actorUserId: user.userId,
      companyId: record.companyId,
      action: "correspondence.delivery_deferred",
      entityType: "Correspondence",
      entityId: record.id,
      metadata: {
        sentCount,
        failedCount,
        deferredCount,
        transportConfigured: false,
      },
    });

    return this.findOne(user, id);
  }

  async downloadPdf(user: AuthenticatedUser, id: string) {
    const record = await this.findRawById(id);
    await this.ensureAccess(user, record);

    return this.pdfService.renderCorrespondence({
      registryNumber: record.registryNumber,
      title: record.title,
      kind: record.kind,
      subject: record.subject,
      body: record.body,
      createdAt: record.createdAt,
      sentAt: record.sentAt,
      status: record.status,
      createdByUserName: record.createdByUser.fullName,
      recipients: record.recipients.map((recipient) => ({
        companyName: recipient.companyName,
        contactName: recipient.contactName,
        contactEmail: recipient.contactEmail,
        contactPosition: recipient.contactPosition,
        status: recipient.status,
        sentAt: recipient.sentAt,
      })),
    });
  }

  async downloadDocx(user: AuthenticatedUser, id: string) {
    const record = await this.findRawById(id);
    await this.ensureAccess(user, record);

    if (!this.hasStroyWordTemplate(record)) {
      throw new BadRequestException(
        "Word-шаблон доступен только для компании Stroy Company 2030.",
      );
    }

    return this.renderDocx(record);
  }

  async aiAssist(user: AuthenticatedUser, input: CorrespondenceAiAssistInput) {
    requireCompanyScope(user, input.companyId);
    return this.correspondenceAiService.assist(input);
  }
}
