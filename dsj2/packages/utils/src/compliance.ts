export type ComplianceDocumentTypeCategory =
  | "DOCUMENT"
  | "TRAINING"
  | "INSTRUCTION";

export type EmployeeDocumentVerificationStatus =
  | "PENDING"
  | "VERIFIED"
  | "REJECTED";

export type AdmissionCheckResult = {
  code: string;
  result: "PASS" | "FAIL" | "SKIP";
  severity: "BLOCKER" | "WARNING";
  message?: string | null;
  evidence: string[];
};

export type MatrixRequirementItem = {
  documentTypeId: string;
  notes?: string | null;
};

export type PositionComplianceMatrixPayload = {
  requiredDocuments: MatrixRequirementItem[];
  requiredTrainings: MatrixRequirementItem[];
  requiredInstructions: MatrixRequirementItem[];
  notes?: string | null;
};

export type EmployeeAdmissionSummary = {
  status: "admitted" | "limited" | "blocked";
  decisionCode: string;
  checkedAt: string;
  matrixId?: string | null;
  matrixVersionId?: string | null;
  protocolBasisCount: number;
  activeProtocolBasisCount: number;
  requiredItemCount: number;
  satisfiedItemCount: number;
  missingItemCount: number;
  expiringItemCount: number;
  checks: AdmissionCheckResult[];
  warnings: AdmissionCheckResult[];
  nextActions: string[];
};

type RequirementDefinition = {
  documentTypeId: string;
  code: string;
  name: string;
  category: ComplianceDocumentTypeCategory;
  requiresVerification: boolean;
};

type EmployeeRequirementDocument = {
  id: string;
  documentTypeDefinitionId: string | null;
  title: string;
  documentNumber?: string | null;
  issueDate: Date | string;
  expiryDate: Date | string | null;
  status: string;
  verificationStatus: EmployeeDocumentVerificationStatus;
};

type EmployeeProtocolBasis = {
  id: string;
  number: string;
  status: string;
  signedAt?: Date | string | null;
};

type EmployeeDocumentLifecycleStatus =
  | "DRAFT"
  | "ACTIVE"
  | "EXPIRING"
  | "EXPIRED";

function isRequirementArray(value: unknown): value is MatrixRequirementItem[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof (item as { documentTypeId?: unknown }).documentTypeId === "string",
    )
  );
}

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

function normalizeDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
}

function categoryLabel(category: ComplianceDocumentTypeCategory) {
  switch (category) {
    case "DOCUMENT":
      return "document";
    case "TRAINING":
      return "training";
    case "INSTRUCTION":
      return "instruction";
  }
}

export function parsePositionComplianceMatrixPayload(
  payload: unknown,
): PositionComplianceMatrixPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Matrix payload must be an object.");
  }

  const candidate = payload as {
    requiredDocuments?: unknown;
    requiredTrainings?: unknown;
    requiredInstructions?: unknown;
    notes?: unknown;
  };

  if (
    (candidate.requiredDocuments !== undefined &&
      !isRequirementArray(candidate.requiredDocuments)) ||
    (candidate.requiredTrainings !== undefined &&
      !isRequirementArray(candidate.requiredTrainings)) ||
    (candidate.requiredInstructions !== undefined &&
      !isRequirementArray(candidate.requiredInstructions))
  ) {
    throw new Error("Matrix requirement arrays are malformed.");
  }

  if (
    candidate.notes !== undefined &&
    candidate.notes !== null &&
    typeof candidate.notes !== "string"
  ) {
    throw new Error("Matrix notes must be a string.");
  }

  return {
    requiredDocuments: candidate.requiredDocuments ?? [],
    requiredTrainings: candidate.requiredTrainings ?? [],
    requiredInstructions: candidate.requiredInstructions ?? [],
    notes: candidate.notes ?? null,
  };
}

export function legacyDocumentTypeFromComplianceCategory(
  category: ComplianceDocumentTypeCategory,
) {
  switch (category) {
    case "DOCUMENT":
      return "CERTIFICATE" as const;
    case "TRAINING":
      return "COMPLETION_CONFIRMATION" as const;
    case "INSTRUCTION":
      return "STATEMENT" as const;
  }
}

export function briefingComplianceCodeFromBriefingType(
  briefingType: "INTRODUCTORY" | "PRIMARY" | "REPEATED" | "UNSCHEDULED" | "TARGETED",
) {
  switch (briefingType) {
    case "INTRODUCTORY":
      return "BRIEFING_INTRODUCTORY" as const;
    case "PRIMARY":
      return "BRIEFING_WORKPLACE_PRIMARY" as const;
    case "REPEATED":
      return "BRIEFING_WORKPLACE_REPEATED" as const;
    case "UNSCHEDULED":
      return "BRIEFING_WORKPLACE_UNSCHEDULED" as const;
    case "TARGETED":
      return "BRIEFING_WORKPLACE_TARGETED" as const;
  }
}

export function getEmployeeDocumentLifecycleStatus(args: {
  status: string;
  expiryDate?: Date | string | null;
  evaluatedAt?: Date;
}): EmployeeDocumentLifecycleStatus {
  if (args.status === "DRAFT") {
    return "DRAFT";
  }

  const evaluatedAt = args.evaluatedAt ?? new Date();
  const expiryDate = normalizeDate(args.expiryDate);

  if (!expiryDate) {
    return "ACTIVE";
  }

  const now = evaluatedAt.getTime();
  const expiryTime = expiryDate.getTime();
  const thirtyDaysAhead = now + 1000 * 60 * 60 * 24 * 30;

  if (expiryTime < now) {
    return "EXPIRED";
  }

  if (expiryTime <= thirtyDaysAhead) {
    return "EXPIRING";
  }

  return "ACTIVE";
}

export function evaluateEmployeeAdmissionSummary(args: {
  checkedAt?: Date;
  hasPosition: boolean;
  matrixId?: string | null;
  matrixVersionId?: string | null;
  requirements: RequirementDefinition[];
  documents: EmployeeRequirementDocument[];
  protocols?: EmployeeProtocolBasis[];
}): EmployeeAdmissionSummary {
  const checkedAt = args.checkedAt ?? new Date();
  const checks: AdmissionCheckResult[] = [];
  const warnings: AdmissionCheckResult[] = [];
  const nextActions: string[] = [];

  if (args.hasPosition) {
    pushCheck(
      checks,
      "POSITION_ASSIGNED",
      "PASS",
      "BLOCKER",
      "Employee position is assigned.",
      ["positionId resolved"],
    );
  } else {
    pushCheck(
      checks,
      "POSITION_ASSIGNED",
      "FAIL",
      "BLOCKER",
      "Employee position is not assigned.",
      ["positionId missing"],
    );
    nextActions.push("Assign a position to the employee.");
  }

  if (args.matrixVersionId) {
    pushCheck(
      checks,
      "POSITION_MATRIX_ACTIVE",
      "PASS",
      "BLOCKER",
      "An active matrix version is resolved for the employee position.",
      [args.matrixVersionId],
    );
  } else {
    pushCheck(
      checks,
      "POSITION_MATRIX_ACTIVE",
      "FAIL",
      "BLOCKER",
      "No active compliance matrix version is resolved for the employee position.",
      [args.matrixId ?? "matrix missing"],
    );
    nextActions.push("Create and activate a compliance matrix for the position.");
  }

  let satisfiedItemCount = 0;
  let missingItemCount = 0;
  let expiringItemCount = 0;
  const protocolBasis = args.protocols ?? [];
  const activeProtocolBasis = protocolBasis.filter((protocol) => protocol.status === "SIGNED");

  for (const requirement of args.requirements) {
    const documents = args.documents
      .filter((document) => document.documentTypeDefinitionId === requirement.documentTypeId)
      .sort((left, right) => {
        const leftExpiry =
          normalizeDate(left.expiryDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const rightExpiry =
          normalizeDate(right.expiryDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return rightExpiry - leftExpiry;
      });
    const label = `${categoryLabel(requirement.category)}:${requirement.code}`;

    if (!documents.length) {
      missingItemCount += 1;
      pushCheck(
        checks,
        `REQ_${requirement.code}_PRESENT`,
        "FAIL",
        "BLOCKER",
        `Required ${categoryLabel(requirement.category)} "${requirement.name}" is missing.`,
        [label],
      );
      nextActions.push(`Register ${categoryLabel(requirement.category)} "${requirement.name}".`);
      continue;
    }

    const selectedDocument =
      documents.find((document) => {
        const lifecycleStatus = getEmployeeDocumentLifecycleStatus({
          status: document.status,
          expiryDate: document.expiryDate,
          evaluatedAt: checkedAt,
        });

        return (
          lifecycleStatus !== "DRAFT" &&
          lifecycleStatus !== "EXPIRED" &&
          (!requirement.requiresVerification ||
            document.verificationStatus === "VERIFIED")
        );
      }) ?? documents[0];

    const lifecycleStatus = getEmployeeDocumentLifecycleStatus({
      status: selectedDocument.status,
      expiryDate: selectedDocument.expiryDate,
      evaluatedAt: checkedAt,
    });

    if (lifecycleStatus === "DRAFT" || lifecycleStatus === "EXPIRED") {
      missingItemCount += 1;
      pushCheck(
        checks,
        `REQ_${requirement.code}_VALID`,
        "FAIL",
        "BLOCKER",
        `Required ${categoryLabel(requirement.category)} "${requirement.name}" is not valid.`,
        [selectedDocument.documentNumber ?? selectedDocument.title, lifecycleStatus],
      );
      nextActions.push(`Renew ${categoryLabel(requirement.category)} "${requirement.name}".`);
      continue;
    }

    if (
      requirement.requiresVerification &&
      selectedDocument.verificationStatus !== "VERIFIED"
    ) {
      missingItemCount += 1;
      pushCheck(
        checks,
        `REQ_${requirement.code}_VERIFIED`,
        "FAIL",
        "BLOCKER",
        `Required ${categoryLabel(requirement.category)} "${requirement.name}" is not verified.`,
        [
          selectedDocument.documentNumber ?? selectedDocument.title,
          selectedDocument.verificationStatus,
        ],
      );
      nextActions.push(`Verify ${categoryLabel(requirement.category)} "${requirement.name}".`);
      continue;
    }

    satisfiedItemCount += 1;
    pushCheck(
      checks,
      `REQ_${requirement.code}_SATISFIED`,
      "PASS",
      "BLOCKER",
      `Required ${categoryLabel(requirement.category)} "${requirement.name}" is satisfied.`,
      [selectedDocument.documentNumber ?? selectedDocument.title],
    );

    if (lifecycleStatus === "EXPIRING") {
      expiringItemCount += 1;
      pushCheck(
        warnings,
        `REQ_${requirement.code}_EXPIRING`,
        "PASS",
        "WARNING",
        `Required ${categoryLabel(requirement.category)} "${requirement.name}" will expire soon.`,
        [selectedDocument.documentNumber ?? selectedDocument.title],
      );
      nextActions.push(
        `Renew ${categoryLabel(requirement.category)} "${requirement.name}" before expiry.`,
      );
    }
  }

  if (activeProtocolBasis.length > 0) {
    pushCheck(
      checks,
      "PROTOCOL_DECISION_ACTIVE",
      "PASS",
      "BLOCKER",
      "An active signed protocol basis is registered for the employee.",
      activeProtocolBasis.map((protocol) => protocol.number),
    );
  } else if (
    protocolBasis.some(
      (protocol) => protocol.status !== "DRAFT" && protocol.status !== "SIGNING_READY",
    )
  ) {
    pushCheck(
      checks,
      "PROTOCOL_DECISION_ACTIVE",
      "FAIL",
      "BLOCKER",
      "Signed protocol basis is missing or no longer active for the employee.",
      protocolBasis.map((protocol) => `${protocol.number}:${protocol.status}`),
    );
    nextActions.push("Register and sign an active protocol basis.");
  }

  const hasFailures = checks.some((check) => check.result === "FAIL");
  const hasWarnings = warnings.length > 0;

  return {
    status: hasFailures ? "blocked" : hasWarnings ? "limited" : "admitted",
    decisionCode: hasFailures
      ? "BLOCKED_REQUIREMENTS_MISSING"
      : hasWarnings
        ? "LIMITED_EXPIRING_REQUIREMENTS"
        : "ADMITTED_ALL_REQUIREMENTS_MET",
    checkedAt: checkedAt.toISOString(),
    matrixId: args.matrixId ?? null,
    matrixVersionId: args.matrixVersionId ?? null,
    protocolBasisCount: protocolBasis.length,
    activeProtocolBasisCount: activeProtocolBasis.length,
    requiredItemCount: args.requirements.length,
    satisfiedItemCount,
    missingItemCount,
    expiringItemCount,
    checks,
    warnings,
    nextActions: [...new Set(nextActions)],
  };
}
