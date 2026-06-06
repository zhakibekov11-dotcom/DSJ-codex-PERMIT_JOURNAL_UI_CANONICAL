import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";
import { readFile } from "node:fs/promises";
import { formatDate, formatDateTime } from "@dsj/utils";
import { assertReadablePath } from "../common/utils/runtime-dependencies";
import { resolveWorkspacePath } from "../common/utils/workspace-path";

const briefingTypeLabels: Record<string, string> = {
  INTRODUCTORY: "Вводный",
  PRIMARY: "Первичный",
  REPEATED: "Повторный",
  UNSCHEDULED: "Внеплановый",
  TARGETED: "Целевой",
};

const statusLabels: Record<string, string> = {
  DRAFT: "Черновик",
  READY_TO_SEND: "Готово к отправке",
  PARTIALLY_SENT: "Частично отправлено",
  READY_FOR_SIGNING: "Готово к подписанию",
  SIGNED: "Подписано",
  ARCHIVED: "В архиве",
  ACTIVE: "Действует",
  EXPIRING: "Истекает",
  EXPIRED: "Истёк",
  EXPIRING_SOON: "Скоро истекает",
  ASSIGNED: "Назначено",
  IN_PROGRESS: "В процессе",
  COMPLETED: "Завершено",
  OVERDUE: "Просрочено",
  AVAILABLE: "Доступен",
  NOT_STARTED: "Не начат",
  PASSED: "Сдан",
  FAILED: "Не сдан",
  PENDING: "Ожидает отправки",
};

const documentTypeLabels: Record<string, string> = {
  CERTIFICATE: "Сертификат",
  PROTOCOL: "Протокол",
  STATEMENT: "Справка",
  COMPLETION_CONFIRMATION: "Подтверждение прохождения",
  SAFETY_CERTIFICATE: "Удостоверение",
};

const companyDocumentCategoryLabels: Record<string, string> = {
  LOCAL_ACT: "Локальные акты",
  ORDER: "Приказы",
  INSTRUCTION: "Инструкции",
  JOURNAL: "Журналы",
  TRAINING_CERTIFICATION: "Обучение и аттестация",
};

const correspondenceKindLabels: Record<CorrespondencePdf["kind"], string> = {
  LETTER: "Деловое письмо",
  COMMERCIAL_PROPOSAL: "Коммерческое предложение",
};

type DetailBriefingRecord = {
  documentNumber: string | null;
  briefingType: string;
  briefingDate: Date;
  topic: string;
  notes: string | null;
  status: string;
  signedAt: Date | null;
  instructor: {
    fullName: string;
  };
  department?: {
    name: string;
  } | null;
  site?: {
    name: string;
  } | null;
  participants: Array<{
    fullName: string;
    employeeNumber: string;
    jobTitle: string;
    contractorCompanyName: string | null;
    status: string;
    inviteLink: string | null;
    signatures: Array<{
      signerName: string;
      signerIinMasked: string;
      certificateSerial: string;
      signedAt: Date | null;
    }>;
  }>;
};

type JournalRecord = {
  documentNumber: string | null;
  briefingType: string;
  briefingDate: Date;
  status: string;
  topic: string;
  participantsLabel: string;
};

type EmployeeDocumentPdf = {
  title: string;
  documentType: string;
  issueDate: Date;
  expiryDate: Date | null;
  status: string;
  issuerName: string;
  employee: {
    fullName: string;
    employeeNumber: string;
    jobTitle: string;
  };
  trainingTitle?: string | null;
};

type ProtocolPdf = {
  number: string;
  date: Date;
  protocolType: string;
  basis: string;
  status: string;
  decision: string;
  notes: string | null;
  departmentName: string | null;
  workSiteName: string | null;
  employees: Array<{
    fullName: string;
    employeeNumber: string | null;
    jobTitle: string | null;
  }>;
  commission: Array<{
    role: string;
    fullName: string;
    jobTitle: string | null;
  }>;
  signedAt: Date | null;
};

type ResponsibilityOrderPdf = {
  number: string;
  date: Date;
  responsibilityType: string;
  title: string;
  basis: string;
  status: string;
  notes: string | null;
  branchName: string | null;
  departmentName: string | null;
  workSiteName: string | null;
  workSiteLocation: string | null;
  appointments: Array<{
    employeeName: string;
    employeeNumber: string | null;
    employeeJobTitle: string | null;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    zoneOfResponsibility: string | null;
    roleNotes: string | null;
  }>;
  signedAt: Date | null;
};

type WorkPermitPdf = {
  permitCode: string;
  journalRegistrationNumber: string;
  permitType: string;
  workType: string;
  status: string;
  workDescription: string;
  workplace: string;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  closedAt: Date | null;
  payloadHash: string | null;
  signedPayloadHash: string | null;
  approvals: Array<{
    stepNo: number;
    role: string;
    status: string;
    decidedAt: Date | null;
  }>;
  signatures: Array<{
    signerName: string;
    certificateSerial: string;
    signedAt: Date | null;
    verification: string | null;
  }>;
};

type CompanyDocumentPdf = {
  companyName: string;
  category: string;
  documentName: string;
  title: string;
  summary: string | null;
  body: string;
  issueDate: Date | null;
  status: string;
  createdByUserName: string;
  createdAt: Date;
  updatedAt: Date;
};

type SafetyCertificatePdf = {
  certificateNumber: string;
  issueDate: Date;
  expiryDate: Date;
  status: string;
  issuerName: string;
  employee: {
    fullName: string;
    employeeNumber: string;
    jobTitle: string;
  };
  trainingTitle?: string | null;
};

type BiotItrCertificatePdf = {
  certificateNumber: string;
  issueDate: Date;
  issuedTo: string;
};

type CorrespondencePdf = {
  registryNumber: string;
  title: string;
  kind: "LETTER" | "COMMERCIAL_PROPOSAL";
  subject: string;
  body: string;
  createdAt: Date;
  sentAt: Date | null;
  status: string;
  createdByUserName: string;
  recipients: Array<{
    companyName: string;
    contactName: string;
    contactEmail: string | null;
    contactPosition: string | null;
    status: string;
    sentAt: Date | null;
  }>;
};

const responsibilityTypeLabels: Record<string, string> = {
  OCCUPATIONAL_SAFETY_RESPONSIBLE: "Occupational safety responsible",
  FIRE_SAFETY_RESPONSIBLE: "Fire safety responsible",
  DEPARTMENT_RESPONSIBLE: "Department responsible",
  OBJECT_RESPONSIBLE: "Object responsible",
  INSTRUCTOR_APPOINTMENT: "Instructor appointment",
  BRIEFING_AUTHORIZED_PERSON: "Briefing authorized person",
  PERMIT_ISSUER_AUTHORIZED_PERSON: "Permit issuer authorized person",
  RESPONSIBLE_WORK_MANAGER: "Responsible work manager",
};

const BIOT_ITR_CERTIFICATE_BACKGROUND_PATH = resolveWorkspacePath(
  __dirname,
  "docs/experimental/biot/biot-itr-certificate-background.jpg",
);
const PDF_TIMES_REGULAR_PATH =
  "/System/Library/Fonts/Supplemental/Times New Roman.ttf";
const PDF_TIMES_BOLD_PATH =
  "/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf";
const PDF_TIMES_REGULAR = "DsjTimesNewRoman";
const PDF_TIMES_BOLD = "DsjTimesNewRomanBold";
const BIOT_ITR_CERTIFICATE_SIZE: [number, number] = [800, 560];
const BIOT_ITR_CERTIFICATE_DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

@Injectable()
export class PdfService {
  private finalize(document: InstanceType<typeof PDFDocument>) {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];

      document.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      document.on("end", () => resolve(Buffer.concat(chunks)));
      document.on("error", reject);
      document.end();
    });
  }

  async renderBriefingRecord(record: DetailBriefingRecord) {
    const document = new PDFDocument({
      margin: 48,
      size: "A4",
    });

    document
      .fontSize(20)
      .text("Цифровой журнал по технике безопасности", { continued: false });
    document.moveDown(0.4);
    document
      .fontSize(12)
      .fillColor("#475569")
      .text("Выгрузка записи инструктажа для аудита");
    document.moveDown(1.2);

    document
      .fillColor("#0f172a")
      .fontSize(11)
      .text(`Номер документа: ${record.documentNumber ?? "Черновик"}`)
      .text(
        `Тип инструктажа: ${briefingTypeLabels[record.briefingType] ?? record.briefingType}`,
      )
      .text(`Дата инструктажа: ${formatDate(record.briefingDate)}`)
      .text(`Статус: ${statusLabels[record.status] ?? record.status}`);

    document.moveDown(0.8);
    document.fontSize(13).text("Участники");
    document.moveDown(0.3);
    document
      .fontSize(11)
      .text(`Инструктирующий: ${record.instructor.fullName}`)
      .text(`Подразделение: ${record.department?.name ?? "Не назначено"}`)
      .text(`Объект: ${record.site?.name ?? "Не назначен"}`);

    record.participants.forEach((participant, index) => {
      document.moveDown(0.3);
      document
        .fontSize(11)
        .text(`${index + 1}. ${participant.fullName}`)
        .text(`   Табельный номер: ${participant.employeeNumber}`)
        .text(`   Должность: ${participant.jobTitle}`)
        .text(
          `   Тип занятости: ${participant.contractorCompanyName ?? "Штатный сотрудник"}`,
        )
        .text(
          `   Статус: ${statusLabels[participant.status] ?? participant.status}`,
        );
    });

    document.moveDown(0.8);
    document.fontSize(13).text("Содержание инструктажа");
    document.moveDown(0.3);
    document.fontSize(11).text(`Тема: ${record.topic}`);
    if (record.notes) {
      document.moveDown(0.2);
      document.text(`Примечания: ${record.notes}`);
    }

    document.moveDown(0.8);
    document.fontSize(13).text("Данные подписи");
    document.moveDown(0.3);

    const participantSignatures = record.participants.flatMap((participant) =>
      participant.signatures.map((signature) => ({
        participantName: participant.fullName,
        ...signature,
      })),
    );

    if (!participantSignatures.length) {
      document.fontSize(11).text("Подписи отсутствуют.");
    } else {
      participantSignatures.forEach((signature, index) => {
        document
          .fontSize(11)
          .text(`${index + 1}. ${signature.participantName}`)
          .text(`   Подписант: ${signature.signerName}`)
          .text(`   ИИН: ${signature.signerIinMasked}`)
          .text(`   Сертификат: ${signature.certificateSerial}`)
          .text(
            `   Подписано: ${signature.signedAt ? formatDateTime(signature.signedAt) : "Ожидает"}`,
          );
      });
    }

    if (record.signedAt) {
      document.moveDown(0.8);
      document
        .fontSize(11)
        .text(`Запись подписана: ${formatDateTime(record.signedAt)}`);
    }

    return this.finalize(document);
  }

  async renderJournal(records: JournalRecord[], title: string) {
    const document = new PDFDocument({
      margin: 40,
      size: "A4",
      layout: "landscape",
    });

    document.fontSize(18).text("Цифровой журнал по технике безопасности");
    document.moveDown(0.2);
    document.fontSize(12).fillColor("#475569").text(title);
    document.moveDown(1);

    records.forEach((record) => {
      document
        .fillColor("#0f172a")
        .fontSize(10)
        .text(
          [
            record.documentNumber ?? "Черновик",
            formatDate(record.briefingDate),
            briefingTypeLabels[record.briefingType] ?? record.briefingType,
            statusLabels[record.status] ?? record.status,
            record.participantsLabel,
            record.topic,
          ].join(" | "),
        );
      document.moveDown(0.4);
    });

    return this.finalize(document);
  }

  async renderEmployeeDocument(record: EmployeeDocumentPdf) {
    const document = new PDFDocument({
      margin: 48,
      size: "A4",
    });

    document.fontSize(20).text("Документ сотрудника");
    document.moveDown(0.4);
    document
      .fontSize(12)
      .fillColor("#475569")
      .text("Выгрузка документа из личного кабинета сотрудника");
    document.moveDown(1.2);

    document
      .fillColor("#0f172a")
      .fontSize(11)
      .text(`Название: ${record.title}`)
      .text(
        `Тип: ${documentTypeLabels[record.documentType] ?? record.documentType}`,
      )
      .text(`Дата выдачи: ${formatDate(record.issueDate)}`)
      .text(`Статус: ${statusLabels[record.status] ?? record.status}`)
      .text(`Организация-эмитент: ${record.issuerName}`);

    if (record.expiryDate) {
      document.text(`Срок действия: ${formatDate(record.expiryDate)}`);
    }

    document.moveDown(0.8);
    document.fontSize(13).text("Сотрудник");
    document.moveDown(0.3);
    document
      .fontSize(11)
      .text(`ФИО: ${record.employee.fullName}`)
      .text(`Табельный номер: ${record.employee.employeeNumber}`)
      .text(`Должность: ${record.employee.jobTitle}`);

    if (record.trainingTitle) {
      document.moveDown(0.8);
      document.fontSize(13).text("Основание");
      document.moveDown(0.3);
      document.fontSize(11).text(`Связанное обучение: ${record.trainingTitle}`);
    }

    return this.finalize(document);
  }

  async renderProtocol(record: ProtocolPdf) {
    const document = new PDFDocument({
      margin: 48,
      size: "A4",
    });

    document.fontSize(20).text("Protocol");
    document.moveDown(0.4);
    document
      .fontSize(12)
      .fillColor("#475569")
      .text("Knowledge check / commission decision record");
    document.moveDown(1.2);

    document
      .fillColor("#0f172a")
      .fontSize(11)
      .text(`Number: ${record.number}`)
      .text(`Date: ${formatDate(record.date)}`)
      .text(`Type: ${record.protocolType}`)
      .text(`Basis: ${record.basis}`)
      .text(`Status: ${statusLabels[record.status] ?? record.status}`)
      .text(`Department: ${record.departmentName ?? "Not assigned"}`)
      .text(`Work site: ${record.workSiteName ?? "Not assigned"}`);

    document.moveDown(0.8);
    document.fontSize(13).text("Employees");
    document.moveDown(0.3);
    record.employees.forEach((employee, index) => {
      document
        .fontSize(11)
        .text(`${index + 1}. ${employee.fullName}`)
        .text(`   Employee No: ${employee.employeeNumber ?? "n/a"}`)
        .text(`   Job title: ${employee.jobTitle ?? "n/a"}`);
    });

    document.moveDown(0.8);
    document.fontSize(13).text("Commission");
    document.moveDown(0.3);
    record.commission.forEach((member, index) => {
      document
        .fontSize(11)
        .text(`${index + 1}. ${member.role}: ${member.fullName}`)
        .text(`   Role title: ${member.jobTitle ?? "n/a"}`);
    });

    document.moveDown(0.8);
    document.fontSize(13).text("Decision");
    document.moveDown(0.3);
    document.fontSize(11).text(record.decision);

    if (record.notes) {
      document.moveDown(0.5);
      document.fontSize(13).text("Notes");
      document.moveDown(0.3);
      document.fontSize(11).text(record.notes);
    }

    if (record.signedAt) {
      document.moveDown(0.8);
      document
        .fontSize(11)
        .text(`Signed at: ${formatDateTime(record.signedAt)}`);
    }

    return this.finalize(document);
  }

  async renderResponsibilityOrder(record: ResponsibilityOrderPdf) {
    const document = new PDFDocument({
      margin: 48,
      size: "A4",
    });

    document.fontSize(20).text("Responsibility Order");
    document.moveDown(0.4);
    document
      .fontSize(12)
      .fillColor("#475569")
      .text("Appointed responsible persons / authority basis");
    document.moveDown(1.2);

    document
      .fillColor("#0f172a")
      .fontSize(11)
      .text(`Number: ${record.number}`)
      .text(`Date: ${formatDate(record.date)}`)
      .text(
        `Responsibility type: ${responsibilityTypeLabels[record.responsibilityType] ?? record.responsibilityType}`,
      )
      .text(`Title: ${record.title}`)
      .text(`Basis: ${record.basis}`)
      .text(`Status: ${statusLabels[record.status] ?? record.status}`)
      .text(`Branch: ${record.branchName ?? "Organization-wide"}`)
      .text(`Department: ${record.departmentName ?? "Not assigned"}`)
      .text(`Work site: ${record.workSiteName ?? "Not assigned"}`)
      .text(`Location: ${record.workSiteLocation ?? "Not assigned"}`);

    if (record.notes) {
      document.moveDown(0.6);
      document.fontSize(13).text("Notes");
      document.moveDown(0.3);
      document.fontSize(11).text(record.notes);
    }

    document.moveDown(0.8);
    document.fontSize(13).text("Appointments");
    document.moveDown(0.3);
    record.appointments.forEach((appointment, index) => {
      document
        .fontSize(11)
        .text(`${index + 1}. ${appointment.employeeName}`)
        .text(`   Employee No: ${appointment.employeeNumber ?? "n/a"}`)
        .text(`   Job title: ${appointment.employeeJobTitle ?? "n/a"}`)
        .text(`   Effective from: ${formatDate(appointment.effectiveFrom)}`)
        .text(
          `   Effective to: ${appointment.effectiveTo ? formatDate(appointment.effectiveTo) : "Open-ended"}`,
        )
        .text(
          `   Zone of responsibility: ${appointment.zoneOfResponsibility ?? "Not specified"}`,
        )
        .text(`   Role notes: ${appointment.roleNotes ?? "Not specified"}`);
      document.moveDown(0.35);
    });

    if (record.signedAt) {
      document.moveDown(0.6);
      document
        .fontSize(11)
        .text(`Signed at: ${formatDateTime(record.signedAt)}`);
    }

    return this.finalize(document);
  }

  async renderWorkPermit(record: WorkPermitPdf) {
    const document = new PDFDocument({
      margin: 48,
      size: "A4",
    });

    document.fontSize(20).text("Work Permit");
    document.moveDown(0.4);
    document
      .fontSize(12)
      .fillColor("#475569")
      .text("Controlled permit lifecycle and evidence summary");
    document.moveDown(1.2);

    document
      .fillColor("#0f172a")
      .fontSize(11)
      .text(`Permit number: ${record.permitCode}`)
      .text(`Journal number: ${record.journalRegistrationNumber}`)
      .text(`Permit type: ${record.permitType}`)
      .text(`Work type: ${record.workType}`)
      .text(`Status: ${record.status}`)
      .text(`Workplace: ${record.workplace}`)
      .text(
        `Effective from: ${record.effectiveFrom ? formatDateTime(record.effectiveFrom) : "n/a"}`,
      )
      .text(
        `Effective to: ${record.effectiveTo ? formatDateTime(record.effectiveTo) : "n/a"}`,
      )
      .text(
        `Closed at: ${record.closedAt ? formatDateTime(record.closedAt) : "n/a"}`,
      );

    document.moveDown(0.8);
    document.fontSize(13).text("Work description");
    document.moveDown(0.3);
    document.fontSize(11).text(record.workDescription);

    document.moveDown(0.8);
    document.fontSize(13).text("Approval decisions");
    document.moveDown(0.3);
    record.approvals.forEach((approval) => {
      document
        .fontSize(11)
        .text(
          `${approval.stepNo}. ${approval.role}: ${approval.status}` +
            (approval.decidedAt
              ? ` at ${formatDateTime(approval.decidedAt)}`
              : ""),
        );
    });

    document.moveDown(0.8);
    document.fontSize(13).text("Signatures");
    document.moveDown(0.3);
    record.signatures.forEach((signature, index) => {
      document
        .fontSize(11)
        .text(`${index + 1}. ${signature.signerName}`)
        .text(`   Certificate: ${signature.certificateSerial}`)
        .text(
          `   Signed at: ${signature.signedAt ? formatDateTime(signature.signedAt) : "n/a"}`,
        )
        .text(`   Verification: ${signature.verification ?? "pending"}`);
    });

    document.moveDown(0.8);
    document.fontSize(9).fillColor("#475569");
    document.text(`Payload hash: ${record.payloadHash ?? "n/a"}`);
    document.text(`Signed payload hash: ${record.signedPayloadHash ?? "n/a"}`);

    return this.finalize(document);
  }

  async renderCompanyDocument(record: CompanyDocumentPdf) {
    const document = new PDFDocument({
      margin: 48,
      size: "A4",
    });

    document.fontSize(20).text(record.title);
    document.moveDown(0.35);
    document
      .fontSize(12)
      .fillColor("#475569")
      .text(
        `${companyDocumentCategoryLabels[record.category] ?? record.category} • ${record.documentName}`,
      );
    document.moveDown(1);

    document
      .fillColor("#0f172a")
      .fontSize(11)
      .text(`Компания: ${record.companyName}`)
      .text(
        `Категория: ${companyDocumentCategoryLabels[record.category] ?? record.category}`,
      )
      .text(`Вид документа: ${record.documentName}`)
      .text(`Статус: ${statusLabels[record.status] ?? record.status}`)
      .text(
        `Дата документа: ${record.issueDate ? formatDate(record.issueDate) : "Не указана"}`,
      )
      .text(`Подготовил: ${record.createdByUserName}`)
      .text(`Обновлено: ${formatDateTime(record.updatedAt)}`);

    if (record.summary) {
      document.moveDown(0.8);
      document.fontSize(13).text("Краткое описание");
      document.moveDown(0.25);
      document.fontSize(11).text(record.summary);
    }

    document.moveDown(0.8);
    document.fontSize(13).text("Содержание");
    document.moveDown(0.25);

    record.body
      .split(/\n\s*\n/gu)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .forEach((paragraph, index) => {
        if (index > 0) {
          document.moveDown(0.45);
        }

        document.fontSize(11).text(paragraph, {
          lineGap: 2,
          align: "left",
        });
      });

    return this.finalize(document);
  }

  async renderSafetyCertificate(record: SafetyCertificatePdf) {
    const document = new PDFDocument({
      margin: 48,
      size: "A4",
    });

    document.fontSize(20).text("Удостоверение по технике безопасности");
    document.moveDown(0.4);
    document
      .fontSize(12)
      .fillColor("#475569")
      .text("Выгрузка удостоверения сотрудника");
    document.moveDown(1.2);

    document
      .fillColor("#0f172a")
      .fontSize(11)
      .text(`Номер удостоверения: ${record.certificateNumber}`)
      .text(`Дата выдачи: ${formatDate(record.issueDate)}`)
      .text(`Срок действия: ${formatDate(record.expiryDate)}`)
      .text(`Статус: ${statusLabels[record.status] ?? record.status}`)
      .text(`Организация-эмитент: ${record.issuerName}`);

    document.moveDown(0.8);
    document.fontSize(13).text("Сотрудник");
    document.moveDown(0.3);
    document
      .fontSize(11)
      .text(`ФИО: ${record.employee.fullName}`)
      .text(`Табельный номер: ${record.employee.employeeNumber}`)
      .text(`Должность: ${record.employee.jobTitle}`);

    if (record.trainingTitle) {
      document.moveDown(0.8);
      document.fontSize(13).text("Основание выдачи");
      document.moveDown(0.3);
      document.fontSize(11).text(`Обучение: ${record.trainingTitle}`);
    }

    return this.finalize(document);
  }

  private fitText(
    document: InstanceType<typeof PDFDocument>,
    value: string,
    options: {
      maxWidth: number;
      initialSize: number;
      minSize: number;
      font: string;
    },
  ) {
    let size = options.initialSize;

    while (size > options.minSize) {
      document.font(options.font).fontSize(size);
      if (document.widthOfString(value) <= options.maxWidth) {
        return size;
      }
      size -= 1;
    }

    return options.minSize;
  }

  async renderBiotItrCertificates(records: BiotItrCertificatePdf[]) {
    await Promise.all([
      assertReadablePath(
        BIOT_ITR_CERTIFICATE_BACKGROUND_PATH,
        "BIOT certificate background image is missing on the server.",
      ),
      assertReadablePath(
        PDF_TIMES_REGULAR_PATH,
        "Times New Roman regular font is missing on the server.",
      ),
      assertReadablePath(
        PDF_TIMES_BOLD_PATH,
        "Times New Roman bold font is missing on the server.",
      ),
    ]);

    const background = await readFile(BIOT_ITR_CERTIFICATE_BACKGROUND_PATH);
    const document = new PDFDocument({
      margin: 0,
      size: BIOT_ITR_CERTIFICATE_SIZE,
      autoFirstPage: false,
    });
    document.registerFont(PDF_TIMES_REGULAR, PDF_TIMES_REGULAR_PATH);
    document.registerFont(PDF_TIMES_BOLD, PDF_TIMES_BOLD_PATH);

    for (const record of records) {
      document.addPage({
        margin: 0,
        size: BIOT_ITR_CERTIFICATE_SIZE,
      });

      document.image(background, 0, 0, {
        width: BIOT_ITR_CERTIFICATE_SIZE[0],
        height: BIOT_ITR_CERTIFICATE_SIZE[1],
      });

      document.save();
      document.rect(145, 126, 560, 78).fill("#ffffff");
      document.restore();
      document
        .strokeColor("#d4dde9")
        .lineWidth(1)
        .moveTo(181, 157)
        .lineTo(689, 157)
        .stroke();

      const issuedTo = record.issuedTo.trim();
      const issuedToFontSize = this.fitText(document, issuedTo, {
        maxWidth: 500,
        initialSize: 34,
        minSize: 22,
        font: PDF_TIMES_BOLD,
      });

      document
        .fillColor("#4b5563")
        .font(PDF_TIMES_BOLD)
        .fontSize(issuedToFontSize)
        .text(issuedTo, 170, 162, {
          width: 520,
          align: "center",
          lineBreak: false,
        });

      document.save();
      document.rect(84, 500, 230, 34).fill("#ffffff");
      document.restore();
      document
        .fillColor("#4b5563")
        .font(PDF_TIMES_REGULAR)
        .fontSize(14)
        .text(
          BIOT_ITR_CERTIFICATE_DATE_FORMATTER.format(record.issueDate).replace(
            /\s*г\.$/u,
            "г.",
          ),
          92,
          513,
          {
            width: 210,
            align: "left",
            lineBreak: false,
          },
        );

      document.save();
      document.rect(515, 500, 220, 36).fill("#ffffff");
      document.restore();

      const certificateNumberFontSize = this.fitText(
        document,
        record.certificateNumber,
        {
          maxWidth: 205,
          initialSize: 16,
          minSize: 12,
          font: PDF_TIMES_REGULAR,
        },
      );

      document
        .fillColor("#6b7280")
        .font(PDF_TIMES_REGULAR)
        .fontSize(certificateNumberFontSize)
        .text(record.certificateNumber, 522, 513, {
          width: 205,
          align: "left",
          lineBreak: false,
        });
    }

    return this.finalize(document);
  }

  async renderCorrespondence(record: CorrespondencePdf) {
    const document = new PDFDocument({
      margin: 48,
      size: "A4",
    });

    document.fontSize(20).text(correspondenceKindLabels[record.kind]);
    document.moveDown(0.35);
    document
      .fontSize(12)
      .fillColor("#475569")
      .text("Выгрузка исходящей корреспонденции");
    document.moveDown(1.1);

    document
      .fillColor("#0f172a")
      .fontSize(11)
      .text(`Номер реестра: ${record.registryNumber}`)
      .text(`Название: ${record.title}`)
      .text(`Тема: ${record.subject}`)
      .text(`Статус: ${statusLabels[record.status] ?? record.status}`)
      .text(`Создано: ${formatDateTime(record.createdAt)}`)
      .text(
        `Дата отправки: ${record.sentAt ? formatDateTime(record.sentAt) : "Ещё не отправлено"}`,
      )
      .text(`Ответственный: ${record.createdByUserName}`);

    document.moveDown(0.8);
    document.fontSize(13).text("Получатели");
    document.moveDown(0.3);

    record.recipients.forEach((recipient, index) => {
      document
        .fontSize(11)
        .text(`${index + 1}. ${recipient.companyName}`)
        .text(
          `   Контакт: ${recipient.contactName}${recipient.contactPosition ? `, ${recipient.contactPosition}` : ""}`,
        )
        .text(`   Email: ${recipient.contactEmail ?? "Не указан"}`)
        .text(
          `   Статус: ${statusLabels[recipient.status] ?? recipient.status}`,
        )
        .text(
          `   Отправлено: ${recipient.sentAt ? formatDateTime(recipient.sentAt) : "Не отправлено"}`,
        );
      document.moveDown(0.35);
    });

    document.moveDown(0.5);
    document.fontSize(13).text("Содержание");
    document.moveDown(0.3);
    document.fontSize(11).text(record.body);

    return this.finalize(document);
  }
}
