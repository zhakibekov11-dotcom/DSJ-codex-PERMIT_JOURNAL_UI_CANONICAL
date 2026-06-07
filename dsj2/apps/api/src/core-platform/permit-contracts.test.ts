import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createContractorAccessActSchema, createPermitSchema } from "@dsj/types";

const validPermit = {
  organizationId: "org-1",
  permitNumber: "WP-1",
  journalRegistrationNumber: "PJ-1",
  permitType: "HIGH_RISK_WORK",
  workType: "GENERAL_HIGH_RISK",
  workDescription: "Maintenance",
  workplace: "Workshop",
  equipmentOrObject: "Conveyor line 2",
  scopeType: "ORGANIZATION",
  startAt: "2026-06-06T08:00:00.000Z",
  endAt: "2026-06-06T12:00:00.000Z",
  crew: {
    employeeIds: ["employee-1"],
    contractorWorkerIds: [],
  },
  hazardFactors: ["moving equipment"],
  safetyMeasures: "Lock out equipment.",
  workplacePreparationMeasures: "Stop, isolate, and clean the work area.",
  safetyMeasureExecutors: "Issuer and work producer.",
  airAnalysisRequired: true,
  airAnalysisResult: "Oxygen within permitted range.",
  airAnalysisAt: "2026-06-06T07:30:00.000Z",
  airAnalysisBy: "Lab technician",
  isolationLockoutMeasures: "LOTO tag WP-1.",
  fencingAndSignsMeasures: "Install warning tape and signs.",
  fireSafetyMeasures: "Keep extinguisher nearby.",
  communicationOrAdjacentAreaApprovals: "Adjacent shop supervisor notified.",
  targetBriefingText: "Review hazards and safe method statement.",
  targetBriefingAt: "2026-06-06T07:45:00.000Z",
  targetBriefingInstructorId: "employee-1",
  admissionAt: "2026-06-06T08:00:00.000Z",
  admittedById: "employee-1",
  acceptedByWorkProducerAt: "2026-06-06T08:05:00.000Z",
  ppeIssueRecordIds: ["ppe-1"],
  legalBasis: ["HIGH_RISK_PERMIT_RULES_344"],
  trainingEvidenceIds: ["training-1"],
  briefingEvidenceIds: ["briefing-1"],
  certificateEvidenceIds: ["certificate-1"],
  medicalEvidenceIds: ["medical-1"],
  requiredDocumentIds: ["document-1"],
};

const validContractorAccessAct = {
  organizationId: "org-1",
  actNumber: "CAA-1",
  scopeType: "ORGANIZATION",
  contractorOrganizationId: "contractor-1",
  contractorRepresentativeId: "worker-1",
  hostRepresentativeEmployeeId: "employee-1",
  hostUnitChiefEmployeeId: "employee-2",
  workName: "Contractor maintenance",
  workDescription: "Replace guarded conveyor components.",
  workArea: "Workshop 2, conveyor line B",
  workAreaBoundaries: "Inside marked red boundary.",
  workAreaCoordinates: null,
  validFrom: "2026-06-06T08:00:00.000Z",
  validTo: "2026-06-06T12:00:00.000Z",
  safetyMeasures: ["Fence the work area", "Hold target briefing"],
  specialConditions: null,
};

describe("work permit create contract", () => {
  it("accepts business fields", () => {
    assert.equal(createPermitSchema.parse(validPermit).permitNumber, "WP-1");
  });

  it("rejects work types without an MVP form", () => {
    assert.throws(() =>
      createPermitSchema.parse({
        ...validPermit,
        workType: "HOT_WORK",
      }),
    );
  });

  it("requires a journal registration number", () => {
    const { journalRegistrationNumber, ...withoutJournalNumber } = validPermit;

    assert.throws(() => createPermitSchema.parse(withoutJournalNumber));
    assert.equal(journalRegistrationNumber, "PJ-1");
  });

  it("accepts ContractorAccessAct links", () => {
    assert.equal(
      createPermitSchema.parse({
        ...validPermit,
        contractorId: "contractor-1",
        contractorRepresentativeId: "worker-1",
        contractorAccessActId: "act-1",
      }).contractorAccessActId,
      "act-1",
    );
  });

  for (const serviceField of [
    "status",
    "currentVersionId",
    "documentEnvelopeId",
    "signedPayloadHash",
    "payloadHash",
    "archivedAt",
    "legalBasisVersion",
    "legalBasisEffectiveDate",
  ]) {
    it(`rejects client-controlled ${serviceField}`, () => {
      assert.throws(() =>
        createPermitSchema.parse({
          ...validPermit,
          [serviceField]: "client-value",
        }),
      );
    });
  }
});

describe("contractor access act create contract", () => {
  it("accepts Appendix 3 business fields", () => {
    assert.equal(
      createContractorAccessActSchema.parse(validContractorAccessAct).actNumber,
      "CAA-1",
    );
  });

  for (const serviceField of [
    "status",
    "legalBasis",
    "legalBasisVersion",
    "legalBasisEffectiveDate",
    "documentEnvelopeId",
    "currentVersionId",
    "signedAt",
    "archivedAt",
    "archiveRecordId",
    "createdAt",
    "updatedAt",
  ]) {
    it(`rejects client-controlled access act ${serviceField}`, () => {
      assert.throws(() =>
        createContractorAccessActSchema.parse({
          ...validContractorAccessAct,
          [serviceField]: "client-value",
        }),
      );
    });
  }
});
