import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPermitSchema } from "@dsj/types";

const validPermit = {
  organizationId: "org-1",
  permitNumber: "WP-1",
  journalRegistrationNumber: "PJ-1",
  permitType: "HIGH_RISK_WORK",
  workType: "GENERAL_HIGH_RISK",
  workDescription: "Maintenance",
  workplace: "Workshop",
  scopeType: "ORGANIZATION",
  startAt: "2026-06-06T08:00:00.000Z",
  endAt: "2026-06-06T12:00:00.000Z",
  crew: {
    employeeIds: ["employee-1"],
    contractorWorkerIds: [],
  },
  hazardFactors: ["moving equipment"],
  safetyMeasures: "Lock out equipment.",
  ppeIssueRecordIds: ["ppe-1"],
  legalBasis: ["HIGH_RISK_PERMIT_RULES_344"],
  trainingEvidenceIds: ["training-1"],
  briefingEvidenceIds: ["briefing-1"],
  certificateEvidenceIds: ["certificate-1"],
  medicalEvidenceIds: ["medical-1"],
  requiredDocumentIds: ["document-1"],
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

  for (const serviceField of [
    "status",
    "currentVersionId",
    "documentEnvelopeId",
    "signedPayloadHash",
    "payloadHash",
    "archivedAt",
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
