import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";

export const WORK_PERMIT_TRANSITIONS = {
  DRAFT: ["MISSING_DOCUMENTS", "IN_APPROVAL", "CANCELLED"],
  MISSING_DOCUMENTS: ["DRAFT", "IN_APPROVAL", "CANCELLED"],
  IN_APPROVAL: ["APPROVED", "REJECTED", "CANCELLED"],
  REJECTED: ["DRAFT", "CANCELLED"],
  APPROVED: ["SIGNING_READY", "CANCELLED"],
  SIGNING_READY: ["SIGNED", "REJECTED", "CANCELLED"],
  SIGNED: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["SUSPENDED", "CLOSED", "EXPIRED", "CANCELLED"],
  SUSPENDED: ["ACTIVE", "CLOSED", "EXPIRED", "CANCELLED"],
  EXTENDED: ["ACTIVE", "SUSPENDED", "CLOSED", "EXPIRED", "CANCELLED"],
  CLOSED: ["ARCHIVED"],
  EXPIRED: ["ARCHIVED"],
  CANCELLED: ["ARCHIVED"],
  ARCHIVED: [],
  SUBMITTED: ["IN_APPROVAL", "CANCELLED"],
  ANNULLED: ["ARCHIVED"],
} as const;

export type WorkPermitDbStatus = keyof typeof WORK_PERMIT_TRANSITIONS;
export type WorkPermitAction =
  | "edit"
  | "precheck"
  | "submit"
  | "confirm"
  | "approve"
  | "prepare-sign"
  | "sign"
  | "activate"
  | "suspend"
  | "resume"
  | "close"
  | "reject"
  | "cancel"
  | "archive";

type PermitAssignments = {
  status?: string;
  issuerEmployeeId?: string | null;
  responsibleManagerEmployeeId?: string | null;
  workProducerEmployeeId?: string | null;
  admitterEmployeeId?: string | null;
};

export function assertWorkPermitTransition(
  currentStatus: string,
  nextStatus: WorkPermitDbStatus,
) {
  const allowed =
    WORK_PERMIT_TRANSITIONS[currentStatus as WorkPermitDbStatus] ?? [];

  if (!(allowed as readonly string[]).includes(nextStatus)) {
    throw new BadRequestException(
      `Work permit transition ${currentStatus} -> ${nextStatus} is not allowed.`,
    );
  }
}

function assignedEmployeeForAction(
  permit: PermitAssignments,
  action: WorkPermitAction,
) {
  switch (action) {
    case "confirm":
      return permit.workProducerEmployeeId;
    case "approve":
      return permit.responsibleManagerEmployeeId;
    case "prepare-sign":
    case "sign":
      return permit.issuerEmployeeId;
    case "activate":
      return permit.admitterEmployeeId;
    case "close":
      return permit.workProducerEmployeeId;
    case "reject":
      return permit.status === "SIGNING_READY"
        ? permit.issuerEmployeeId
        : permit.responsibleManagerEmployeeId;
    default:
      return null;
  }
}

export function assertWorkPermitActionAccess(
  user: AuthenticatedUser,
  permit: PermitAssignments,
  action: WorkPermitAction,
  actorEmployeeId?: string | null,
) {
  const assignedEmployeeId = assignedEmployeeForAction(permit, action);
  const requiresAssignedParticipant = [
    "confirm",
    "approve",
    "prepare-sign",
    "sign",
    "activate",
    "close",
    "reject",
  ].includes(action);

  if (requiresAssignedParticipant) {
    if (!assignedEmployeeId) {
      throw new ForbiddenException(
        `An assigned work permit participant is required to perform ${action}.`,
      );
    }
    if (!actorEmployeeId || assignedEmployeeId !== actorEmployeeId) {
      throw new ForbiddenException(
        `Only the assigned work permit participant can perform ${action}.`,
      );
    }
    return;
  }

  if (user.role === "SUPER_ADMIN") {
    return;
  }

  if (user.role === "EMPLOYEE_SIGNER") {
    throw new ForbiddenException(
      `Employee signer is not assigned to perform ${action}.`,
    );
  }

  if (
    !["COMPANY_ADMIN", "SAFETY_ENGINEER"].includes(user.role) &&
    action !== "precheck"
  ) {
    throw new ForbiddenException("Work permit action is not allowed.");
  }
}

export function isWorkPermitParticipant(
  employeeId: string,
  permit: PermitAssignments,
  crewEmployeeIds: string[],
) {
  return (
    permit.issuerEmployeeId === employeeId ||
    permit.responsibleManagerEmployeeId === employeeId ||
    permit.workProducerEmployeeId === employeeId ||
    permit.admitterEmployeeId === employeeId ||
    crewEmployeeIds.includes(employeeId)
  );
}

type ApprovalRouteStep = {
  id?: string;
  stepNo: number;
  action: string;
  requiredRoleCode?: string | null;
  isMandatory?: boolean;
};

const MVP_APPROVAL_ROLES = [
  "WORK_PRODUCER",
  "RESPONSIBLE_MANAGER",
  "PERMIT_ISSUER",
  "ADMITTER",
] as const;

export function resolveWorkPermitApprovalSteps(steps: ApprovalRouteStep[]) {
  const mandatory = steps
    .filter((step) => step.isMandatory !== false)
    .sort((left, right) => left.stepNo - right.stepNo);

  if (mandatory.length === 0) {
    return MVP_APPROVAL_ROLES.map((role, index) => ({
      stepNo: index + 1,
      role,
      sourceStepId: null,
      sourceStepNo: index + 1,
      action:
        role === "PERMIT_ISSUER"
          ? "SIGN"
          : role === "RESPONSIBLE_MANAGER"
            ? "APPROVE"
            : "ACKNOWLEDGE",
    }));
  }

  const roles = mandatory.map((step) => step.requiredRoleCode?.toUpperCase());
  if (
    mandatory.length !== MVP_APPROVAL_ROLES.length ||
    MVP_APPROVAL_ROLES.some((role, index) => roles[index] !== role)
  ) {
    throw new BadRequestException(
      "WORK_PERMIT approval route must contain the MVP sequence: work producer, responsible manager, permit issuer, admitter.",
    );
  }

  return mandatory.map((step, index) => ({
    stepNo: index + 1,
    role: MVP_APPROVAL_ROLES[index],
    sourceStepId: step.id ?? null,
    sourceStepNo: step.stepNo,
    action: step.action,
  }));
}
