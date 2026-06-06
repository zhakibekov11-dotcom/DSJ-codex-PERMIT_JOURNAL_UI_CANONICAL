import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertWorkPermitActionAccess,
  assertWorkPermitTransition,
  resolveWorkPermitApprovalSteps,
  WORK_PERMIT_TRANSITIONS,
} from "./permit-workflow";

describe("work permit lifecycle", () => {
  it("allows the production lifecycle", () => {
    const transitions = [
      ["DRAFT", "IN_APPROVAL"],
      ["IN_APPROVAL", "APPROVED"],
      ["APPROVED", "SIGNING_READY"],
      ["SIGNING_READY", "SIGNED"],
      ["SIGNED", "ACTIVE"],
      ["ACTIVE", "CLOSED"],
      ["CLOSED", "ARCHIVED"],
    ] as const;

    for (const [from, to] of transitions) {
      assert.doesNotThrow(() => assertWorkPermitTransition(from, to));
    }
  });

  it("blocks lifecycle bypasses", () => {
    assert.throws(() => assertWorkPermitTransition("DRAFT", "ACTIVE"));
    assert.throws(() => assertWorkPermitTransition("IN_APPROVAL", "SIGNED"));
    assert.throws(() => assertWorkPermitTransition("CLOSED", "ACTIVE"));
    assert.throws(() => assertWorkPermitTransition("ARCHIVED", "DRAFT"));
  });

  it("covers every allowed and forbidden status pair", () => {
    const statuses = Object.keys(WORK_PERMIT_TRANSITIONS);
    for (const from of statuses) {
      const allowed = WORK_PERMIT_TRANSITIONS[
        from as keyof typeof WORK_PERMIT_TRANSITIONS
      ] as readonly string[];
      for (const to of statuses) {
        if (allowed.includes(to)) {
          assert.doesNotThrow(() =>
            assertWorkPermitTransition(
              from,
              to as keyof typeof WORK_PERMIT_TRANSITIONS,
            ),
          );
        } else {
          assert.throws(() =>
            assertWorkPermitTransition(
              from,
              to as keyof typeof WORK_PERMIT_TRANSITIONS,
            ),
          );
        }
      }
    }
  });

  it("requires assigned actors for approval, signing, activation, and closure", () => {
    const permit = {
      issuerEmployeeId: "issuer",
      responsibleManagerEmployeeId: "manager",
      workProducerEmployeeId: "producer",
      admitterEmployeeId: "admitter",
    };
    const user = {
      userId: "user-1",
      companyId: "org-1",
      email: "user@example.com",
      fullName: "User",
      role: "EMPLOYEE_SIGNER" as const,
    };

    assert.doesNotThrow(() =>
      assertWorkPermitActionAccess(user, permit, "approve", "manager"),
    );
    assert.doesNotThrow(() =>
      assertWorkPermitActionAccess(user, permit, "sign", "issuer"),
    );
    assert.doesNotThrow(() =>
      assertWorkPermitActionAccess(user, permit, "activate", "admitter"),
    );
    assert.doesNotThrow(() =>
      assertWorkPermitActionAccess(user, permit, "close", "producer"),
    );
    assert.throws(() =>
      assertWorkPermitActionAccess(user, permit, "approve", "issuer"),
    );
    assert.throws(() =>
      assertWorkPermitActionAccess(
        { ...user, role: "SUPER_ADMIN" },
        permit,
        "approve",
        null,
      ),
    );
    assert.throws(() =>
      assertWorkPermitActionAccess(
        user,
        { ...permit, issuerEmployeeId: null },
        "sign",
        "issuer",
      ),
    );
  });

  it("uses a configured MVP approval route and rejects incompatible routes", () => {
    const steps = resolveWorkPermitApprovalSteps([
      {
        id: "producer-step",
        stepNo: 10,
        action: "ACKNOWLEDGE",
        requiredRoleCode: "WORK_PRODUCER",
      },
      {
        id: "manager-step",
        stepNo: 20,
        action: "APPROVE",
        requiredRoleCode: "RESPONSIBLE_MANAGER",
      },
      {
        id: "issuer-step",
        stepNo: 30,
        action: "SIGN",
        requiredRoleCode: "PERMIT_ISSUER",
      },
      {
        id: "admitter-step",
        stepNo: 40,
        action: "ACKNOWLEDGE",
        requiredRoleCode: "ADMITTER",
      },
    ]);

    assert.deepEqual(
      steps.map((step) => [step.stepNo, step.role, step.sourceStepNo]),
      [
        [1, "WORK_PRODUCER", 10],
        [2, "RESPONSIBLE_MANAGER", 20],
        [3, "PERMIT_ISSUER", 30],
        [4, "ADMITTER", 40],
      ],
    );
    assert.throws(() =>
      resolveWorkPermitApprovalSteps([
        {
          stepNo: 1,
          action: "APPROVE",
          requiredRoleCode: "COMPANY_ADMIN",
        },
      ]),
    );
  });
});
