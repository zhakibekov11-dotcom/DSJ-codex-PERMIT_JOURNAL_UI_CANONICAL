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
});
