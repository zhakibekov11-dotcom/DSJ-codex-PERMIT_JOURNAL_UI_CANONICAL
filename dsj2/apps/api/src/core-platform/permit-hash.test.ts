import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canonicalPermitPayloadHash } from "./permit-hash";

describe("work permit payload hash", () => {
  it("is independent from object key order", () => {
    const left = {
      permitEntry: {
        number: "WP-1",
        snapshots: { training: "PASS", medical: "PASS" },
      },
      source: "PERMIT",
    };
    const right = {
      source: "PERMIT",
      permitEntry: {
        snapshots: { medical: "PASS", training: "PASS" },
        number: "WP-1",
      },
    };

    assert.equal(
      canonicalPermitPayloadHash(left),
      canonicalPermitPayloadHash(right),
    );
  });

  it("changes when signed evidence changes", () => {
    const base = {
      permitEntry: {
        snapshots: [{ id: "doc-1", sourceHash: "hash-1" }],
      },
    };
    const changed = {
      permitEntry: {
        snapshots: [{ id: "doc-1", sourceHash: "hash-2" }],
      },
    };

    assert.notEqual(
      canonicalPermitPayloadHash(base),
      canonicalPermitPayloadHash(changed),
    );
  });

  it("changes when Appendix 1 fields change", () => {
    const base = {
      permitEntry: {
        permitNumber: "WP-1",
        equipmentOrObject: "Tank A",
        workplacePreparationMeasures: "Drain tank.",
        airAnalysisRequired: true,
      },
    };
    const changed = {
      permitEntry: {
        permitNumber: "WP-1",
        equipmentOrObject: "Tank B",
        workplacePreparationMeasures: "Drain tank.",
        airAnalysisRequired: true,
      },
    };

    assert.notEqual(
      canonicalPermitPayloadHash(base),
      canonicalPermitPayloadHash(changed),
    );
  });

  it("changes when ContractorAccessAct reference changes", () => {
    const base = {
      permitEntry: {
        permitNumber: "WP-1",
        contractorAccessActId: "act-1",
        contractorAccessAct: {
          id: "act-1",
          actNumber: "CAA-1",
          validFrom: "2026-06-06T08:00:00.000Z",
          validTo: "2026-06-06T12:00:00.000Z",
          workArea: "Workshop 2",
          contractorOrganizationId: "contractor-1",
          contractorRepresentativeId: "worker-1",
        },
      },
    };
    const changed = {
      permitEntry: {
        ...base.permitEntry,
        contractorAccessActId: "act-2",
        contractorAccessAct: {
          ...base.permitEntry.contractorAccessAct,
          id: "act-2",
          actNumber: "CAA-2",
        },
      },
    };

    assert.notEqual(
      canonicalPermitPayloadHash(base),
      canonicalPermitPayloadHash(changed),
    );
  });
});
