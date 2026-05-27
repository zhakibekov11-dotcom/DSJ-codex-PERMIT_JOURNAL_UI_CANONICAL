import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { test } from "node:test";
import { InternalServerErrorException } from "@nestjs/common";
import { CompanyDocumentsService } from "./company-documents/company-documents.service";
import { PdfService } from "./pdf/pdf.service";
import { CorrespondenceService } from "./correspondence/correspondence.service";
import {
  assertPythonModuleAvailable,
  assertPython3Available,
  assertReadablePath,
} from "./common/utils/runtime-dependencies";

const BIOT_ITR_CERTIFICATE_BACKGROUND_PATH =
  "C:\\Users\\Linux\\Documents\\GitHub\\DSJ\\dsj2\\docs\\experimental\\biot\\biot-itr-certificate-background.jpg";
const PDF_TIMES_REGULAR_PATH =
  "/System/Library/Fonts/Supplemental/Times New Roman.ttf";
const PDF_TIMES_BOLD_PATH =
  "/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf";

function createCompanyDocumentsService() {
  return new CompanyDocumentsService(
    {} as never,
    {} as never,
    new PdfService(),
  );
}

function createCorrespondenceService() {
  return new CorrespondenceService(
    {} as never,
    {} as never,
    new PdfService(),
    {} as never,
  );
}

function createCompanyDocumentRecord() {
  return {
    id: "company-document-1",
    company: {
      name: "Stroy Company 2030",
    },
    category: "ORDER",
    documentName: "Order 01",
    title: "Order for briefing",
    summary: "Summary",
    body: "Line 1\n\nLine 2",
    issueDate: new Date("2026-03-20T00:00:00.000Z"),
    status: "ACTIVE",
    createdByUser: {
      fullName: "Aigerim Sadykova",
    },
    createdAt: new Date("2026-03-20T00:00:00.000Z"),
    updatedAt: new Date("2026-03-21T00:00:00.000Z"),
  };
}

function createCorrespondenceRecord() {
  return {
    id: "correspondence-1",
    company: {
      name: "Stroy Company 2030",
    },
    registryNumber: "ИСХ/26-00001",
    title: "Offer",
    kind: "LETTER",
    subject: "Commercial offer",
    body: "Body",
    status: "DRAFT",
    createdByUser: {
      fullName: "Aigerim Sadykova",
    },
    createdAt: new Date("2026-03-20T00:00:00.000Z"),
    sentAt: null,
    recipients: [
      {
        companyName: "Orken",
        contactName: "Dana Sarsenova",
        contactEmail: "dana@example.com",
        contactPosition: "Procurement Lead",
        status: "DRAFT",
        sentAt: null,
      },
    ],
  };
}

async function commandSucceeds(command: string, args: string[]) {
  return new Promise<boolean>((resolvePromise) => {
    const child = spawn(command, args, {
      stdio: "ignore",
    });

    child.on("error", () => resolvePromise(false));
    child.on("close", (code) => resolvePromise(code === 0));
  });
}

async function pathExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function python3Available() {
  return commandSucceeds("python3", ["--version"]);
}

async function pythonDocxAvailable() {
  return commandSucceeds("python3", ["-c", "import docx"]);
}

test("readable-path preflight returns a deterministic error for missing files", async () => {
  await assert.rejects(
    () =>
      assertReadablePath(
        "C:\\does-not-exist\\missing.docx",
        "Expected missing runtime asset error.",
      ),
    (error) =>
      error instanceof InternalServerErrorException &&
      error.message === "Expected missing runtime asset error.",
  );
});

test("python3 preflight returns a deterministic error when the binary is unavailable", async () => {
  const originalPath = process.env.PATH;
  const originalWindowsPath = process.env.Path;
  process.env.PATH = "";
  process.env.Path = "";

  try {
    await assert.rejects(
      () =>
        assertPython3Available(
          "python3 is required to generate DOCX files on the server.",
        ),
      (error) =>
        error instanceof InternalServerErrorException &&
        error.message ===
          "python3 is required to generate DOCX files on the server.",
    );
  } finally {
    process.env.PATH = originalPath;
    process.env.Path = originalWindowsPath;
  }
});

test("python module preflight returns a deterministic error when the module is unavailable", async () => {
  await assert.rejects(
    () =>
      assertPythonModuleAvailable(
        "module_that_does_not_exist_for_wave1_checks",
        "Expected missing python module error.",
      ),
    (error) =>
      error instanceof InternalServerErrorException &&
      error.message === "Expected missing python module error.",
  );
});

test("company document DOCX fails early with the configured missing-script error", async (t) => {
  if (!(await python3Available())) {
    t.skip("python3 is not available in the current environment.");
    return;
  }

  const service = createCompanyDocumentsService() as any;
  service.docxGeneratorScriptPath = "C:\\does-not-exist\\generate_company_document_docx.py";

  await assert.rejects(
    () => service.renderDocx(createCompanyDocumentRecord()),
    (error: unknown) =>
      error instanceof InternalServerErrorException &&
      error.message ===
        "DOCX generator script for company documents is missing on the server.",
  );
});

test("correspondence DOCX fails early with the configured missing-template error", async (t) => {
  if (!(await python3Available())) {
    t.skip("python3 is not available in the current environment.");
    return;
  }

  const service = createCorrespondenceService() as any;
  service.docxTemplatePath = "C:\\does-not-exist\\correspondence-template.docx";

  await assert.rejects(
    () => service.renderDocx(createCorrespondenceRecord()),
    (error: unknown) =>
      error instanceof InternalServerErrorException &&
      error.message === "Word-template for correspondence is missing on the server.",
  );
});

test("company document DOCX still renders in the happy path when runtime dependencies are present", async (t) => {
  if (!(await python3Available())) {
    t.skip("python3 is not available in the current environment.");
    return;
  }
  if (!(await pythonDocxAvailable())) {
    t.skip("python-docx is not installed for the python3 runtime in the current environment.");
    return;
  }

  const service = createCompanyDocumentsService() as any;
  const buffer = (await service.renderDocx(
    createCompanyDocumentRecord(),
  )) as Buffer;

  assert.equal(buffer.subarray(0, 2).toString(), "PK");
});

test("correspondence DOCX still renders in the happy path when runtime dependencies are present", async (t) => {
  if (!(await python3Available())) {
    t.skip("python3 is not available in the current environment.");
    return;
  }
  if (!(await pythonDocxAvailable())) {
    t.skip("python-docx is not installed for the python3 runtime in the current environment.");
    return;
  }

  const service = createCorrespondenceService() as any;
  const buffer = (await service.renderDocx(
    createCorrespondenceRecord(),
  )) as Buffer;

  assert.equal(buffer.subarray(0, 2).toString(), "PK");
});

test("BIOT certificate PDF still renders in the happy path when runtime assets are present", async (t) => {
  const assetsPresent =
    (await pathExists(BIOT_ITR_CERTIFICATE_BACKGROUND_PATH)) &&
    (await pathExists(PDF_TIMES_REGULAR_PATH)) &&
    (await pathExists(PDF_TIMES_BOLD_PATH));

  if (!assetsPresent) {
    t.skip("BIOT PDF assets are not fully present in the current environment.");
    return;
  }

  const pdfService = new PdfService();
  const buffer = await pdfService.renderBiotItrCertificates([
    {
      certificateNumber: "TB-2026-0001",
      issueDate: new Date("2026-03-20T00:00:00.000Z"),
      issuedTo: "Aigerim Sadykova",
    },
  ]);

  assert.equal(buffer.subarray(0, 4).toString(), "%PDF");
});
