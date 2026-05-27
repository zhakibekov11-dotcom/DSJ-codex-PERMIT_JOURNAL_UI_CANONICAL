import type {
  AdmissionCheckResult,
  AdmissionStatus,
  CreateAdmissionCheckInput,
  WorkPermitType,
} from "@dsj/types";

type AdmissionEvidence = {
  hasMatrixVersion: boolean;
  hasTrainingPlanVersion: boolean;
  hasBriefingJournalEntry: boolean;
  briefingIsSigned: boolean;
  hasMedicalClearance: boolean;
  medicalClearanceExpiringSoon: boolean;
  hasActiveQualificationDocument: boolean;
  qualificationExpiringSoon: boolean;
  requiresPermit: boolean;
  hasWorkPermit: boolean;
  workPermitIsActive: boolean;
  workPermitExpiringSoon: boolean;
};

export type AdmissionDecision = {
  status: AdmissionStatus;
  decisionCode: string;
  ruleVersion: string;
  checks: AdmissionCheckResult[];
  warnings: AdmissionCheckResult[];
  nextActions: string[];
};

function pushCheck(
  target: AdmissionCheckResult[],
  code: string,
  result: "PASS" | "FAIL" | "SKIP",
  severity: "BLOCKER" | "WARNING",
  message: string,
  evidence: string[],
) {
  target.push({
    code,
    result,
    severity,
    message,
    evidence,
  });
}

export function evaluateAdmissionDecision(
  input: CreateAdmissionCheckInput,
  evidence: AdmissionEvidence,
): AdmissionDecision {
  const checks: AdmissionCheckResult[] = [];
  const warnings: AdmissionCheckResult[] = [];
  const nextActions: string[] = [];

  if (evidence.hasMatrixVersion) {
    pushCheck(checks, "MATRIX_VERSION_PRESENT", "PASS", "BLOCKER", "An active job requirement matrix version is resolved.", [
      input.matrixVersionId ?? "matrixVersionId provided",
    ]);
  } else {
    pushCheck(checks, "MATRIX_VERSION_PRESENT", "FAIL", "BLOCKER", "No active job requirement matrix version could be resolved.", [
      "matrixVersionId missing or not resolved",
    ]);
    nextActions.push("Assign or publish an active job requirement matrix version.");
  }

  if (evidence.hasTrainingPlanVersion) {
    pushCheck(checks, "TRAINING_PLAN_VERSION_PRESENT", "PASS", "BLOCKER", "A training plan version is resolved.", [
      input.trainingPlanVersionId ?? "trainingPlanVersionId provided",
    ]);
  } else {
    pushCheck(checks, "TRAINING_PLAN_VERSION_PRESENT", "FAIL", "BLOCKER", "No active training plan version could be resolved.", [
      "trainingPlanVersionId missing or not resolved",
    ]);
    nextActions.push("Assign an active training plan version.");
  }

  if (evidence.hasBriefingJournalEntry && evidence.briefingIsSigned) {
    pushCheck(checks, "BRIEFING_SIGNED", "PASS", "BLOCKER", "The briefing record is signed.", [
      input.briefingJournalEntryId ?? "briefingJournalEntryId provided",
    ]);
  } else {
    pushCheck(checks, "BRIEFING_SIGNED", "FAIL", "BLOCKER", "No signed briefing record is available.", [
      evidence.hasBriefingJournalEntry ? "briefing record not signed" : "briefing record missing",
    ]);
    nextActions.push("Complete and sign the required briefing.");
  }

  if (evidence.hasMedicalClearance) {
    pushCheck(checks, "MEDICAL_CLEARANCE_ACTIVE", "PASS", "BLOCKER", "Medical clearance is active.", [
      input.employeeId ?? input.contractorWorkerId ?? "subject",
    ]);
  } else {
    pushCheck(checks, "MEDICAL_CLEARANCE_ACTIVE", "FAIL", "BLOCKER", "No active medical clearance is available.", [
      "missing medical clearance document",
    ]);
    nextActions.push("Obtain a valid medical clearance.");
  }

  if (evidence.hasActiveQualificationDocument) {
    pushCheck(checks, "QUALIFICATION_ACTIVE", "PASS", "BLOCKER", "A qualification document is active.", [
      "active qualification document present",
    ]);
  } else {
    pushCheck(checks, "QUALIFICATION_ACTIVE", "FAIL", "BLOCKER", "No active qualification document is available.", [
      "missing active qualification document",
    ]);
    nextActions.push("Renew the qualification document.");
  }

  if (evidence.requiresPermit) {
    if (evidence.hasWorkPermit && evidence.workPermitIsActive) {
      pushCheck(checks, "WORK_PERMIT_ACTIVE", "PASS", "BLOCKER", "The work permit is active.", [
        input.workPermitId ?? "workPermitId provided",
      ]);
    } else {
      pushCheck(checks, "WORK_PERMIT_ACTIVE", "FAIL", "BLOCKER", "This work type requires an active permit.", [
        evidence.hasWorkPermit ? "permit not active" : "permit missing",
      ]);
      nextActions.push("Create and sign the required work permit.");
    }
  } else {
    pushCheck(checks, "WORK_PERMIT_ACTIVE", "SKIP", "WARNING", "This work type does not require a permit.", [
      input.workType,
    ]);
  }

  if (evidence.medicalClearanceExpiringSoon) {
    pushCheck(warnings, "MEDICAL_CLEARANCE_EXPIRING_SOON", "PASS", "WARNING", "Medical clearance will expire soon.", [
      "renew medical clearance",
    ]);
    nextActions.push("Renew the medical clearance.");
  }

  if (evidence.qualificationExpiringSoon) {
    pushCheck(warnings, "QUALIFICATION_EXPIRING_SOON", "PASS", "WARNING", "Qualification document will expire soon.", [
      "renew qualification",
    ]);
    nextActions.push("Renew the qualification document.");
  }

  if (evidence.workPermitExpiringSoon) {
    pushCheck(warnings, "WORK_PERMIT_EXPIRING_SOON", "PASS", "WARNING", "Work permit will expire soon.", [
      "close or extend permit",
    ]);
    nextActions.push("Review work permit close-out or extension.");
  }

  const hasFailures = checks.some((check) => check.result === "FAIL");
  const hasWarnings = warnings.length > 0;

  const status: AdmissionStatus = hasFailures
    ? "NE_DOPUSHEN"
    : hasWarnings
      ? "OGRANICHENNO_DOPUSHEN"
      : "DOPUSHEN";

  return {
    status,
    decisionCode: hasFailures ? "BLOCKED_REQUIREMENTS_MISSING" : hasWarnings ? "SOFT_ALLOWED" : "APPROVED_ALL_CLEAR",
    ruleVersion: "core-admission-v1",
    checks,
    warnings,
    nextActions: [...new Set(nextActions)],
  };
}

export function derivePermitRequirement(workType: WorkPermitType) {
  return workType !== "OTHER";
}
