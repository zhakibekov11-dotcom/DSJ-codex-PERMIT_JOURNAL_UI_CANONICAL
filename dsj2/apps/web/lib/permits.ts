import type { WorkPermit, WorkPermitStatus, WorkPermitType } from "@dsj/types";

export type PermitType =
  | "HIGH_RISK_WORK"
  | "CONTRACTOR_ACCESS"
  | "SELF_WORK_ADMISSION"
  | "AFTER_BRIEFING_ADMISSION"
  | "AFTER_TRAINING_ADMISSION"
  | "MEDICAL_BASED_ADMISSION"
  | "PPE_BASED_ADMISSION";

export type PermitWorkType =
  | "GENERAL_HIGH_RISK"
  | "HEIGHT_WORK"
  | "HOT_WORK"
  | "GAS_HAZARDOUS_WORK"
  | "ELECTRICAL_WORK"
  | "EARTH_WORK"
  | "CONFINED_SPACE"
  | "LIFTING_WORK"
  | "CONTRACTOR_SITE_ACCESS";

export type PermitStatus =
  | "draft"
  | "pending_precheck"
  | "missing_documents"
  | "pending_approval"
  | "approved"
  | "active"
  | "suspended"
  | "extended"
  | "closed"
  | "rejected"
  | "cancelled"
  | "expired"
  | "archived";

export type PermitEntry = {
  id?: string;
  companyId?: string | null;
  journalId?: string | null;
  permitNumber: string;
  journalRegistrationNumber: string;
  permitType: PermitType;
  workType: PermitWorkType;
  status: PermitStatus;
  workDescription: string;
  workplace: string;
  workZoneId?: string | null;
  departmentId?: string | null;
  startAt: string;
  endAt: string;
  validUntil?: string | null;
  contractorId?: string | null;
  contractorRepresentativeId?: string | null;
  issuerId?: string | null;
  responsibleManagerId?: string | null;
  workProducerId?: string | null;
  admitterId?: string | null;
  observerId?: string | null;
  crewMemberIds: string[];
  hazardFactors: string[];
  safetyMeasures: string;
  ppeRequirements?: string | null;
  ppeIssuedConfirmed?: boolean;
  legalBasis: string[];
  legalBasisVersion?: string | null;
  legalBasisEffectiveDate?: string | null;
  trainingEvidenceIds: string[];
  briefingEvidenceIds: string[];
  certificateEvidenceIds: string[];
  medicalEvidenceIds: string[];
  requiredDocumentIds: string[];
  precheckSummary?: {
    result?: "PASS" | "FAIL";
    checkedAt?: string;
    failedRules?: string[];
  } | null;
  precheckChecks?: PermitPrecheckCheck[];
  trainingCheckSnapshot?: PermitSnapshot;
  briefingCheckSnapshot?: PermitSnapshot;
  certificateCheckSnapshot?: PermitSnapshot;
  medicalCheckSnapshot?: PermitSnapshot & { containsDiagnosis?: boolean };
  ppeIssuedSnapshot?: PermitSnapshot & { confirmed?: boolean };
  requiredDocumentSnapshot?: PermitSnapshot;
  approvalStatus?: string | null;
  signatureStatus?: string | null;
  suspensionReason?: string | null;
  cancellationReason?: string | null;
  closure?: unknown;
  signedPayloadHash?: string | null;
  documentVersionHash?: string | null;
  archivedAt?: string | null;
  retentionUntil?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type PermitSnapshot = {
  checkedAt?: string;
  result?: "PASS" | "FAIL";
  evidenceIds?: string[];
};

export type PermitPrecheckCheck = {
  code: string;
  label: string;
  result: "PASS" | "FAIL";
  severity: "BLOCKER" | "WARNING";
  message: string;
  evidence: string[];
};

export type PermitVersion = {
  id: string;
  permitId: string;
  versionNo: number;
  status: string;
  payloadJson: unknown;
  documentEnvelopeId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PermitBrigade = {
  id: string;
  brigadeCode: string;
  title: string;
  leaderEmployeeId: string | null;
  members?: Array<{
    id: string;
    employeeId: string | null;
    contractorWorkerId: string | null;
    roleCode: string;
    status: string;
  }>;
};

export type PermitRecord = WorkPermit & {
  currentVersion?: PermitVersion | null;
  versions?: PermitVersion[];
  brigades?: PermitBrigade[];
  branch?: { id: string; name: string; code?: string | null } | null;
  workSite?: { id: string; name: string; location?: string | null } | null;
};

export type PermitOption = {
  id: string;
  label: string;
  sublabel?: string | null;
};

export const permitTypeLabels: Record<PermitType, string> = {
  HIGH_RISK_WORK: "Наряд-допуск на работы повышенной опасности",
  CONTRACTOR_ACCESS: "Допуск подрядчика / акт-допуск",
  SELF_WORK_ADMISSION: "Допуск к самостоятельной работе",
  AFTER_BRIEFING_ADMISSION: "Допуск после инструктажа",
  AFTER_TRAINING_ADMISSION: "Допуск после обучения и проверки знаний",
  MEDICAL_BASED_ADMISSION: "Допуск по медосмотру",
  PPE_BASED_ADMISSION: "Допуск по СИЗ",
};

export const mvpPermitTypeOptions: PermitType[] = [
  "HIGH_RISK_WORK",
  "CONTRACTOR_ACCESS",
];

export const permitWorkTypeLabels: Record<PermitWorkType, string> = {
  GENERAL_HIGH_RISK: "Общие работы повышенной опасности",
  HEIGHT_WORK: "Работы на высоте",
  HOT_WORK: "Огневые работы",
  GAS_HAZARDOUS_WORK: "Газоопасные работы",
  ELECTRICAL_WORK: "Работы в электроустановках",
  EARTH_WORK: "Земляные работы",
  CONFINED_SPACE: "Работы в замкнутом пространстве",
  LIFTING_WORK: "Грузоподъёмные работы",
  CONTRACTOR_SITE_ACCESS: "Допуск подрядчика на территорию / объект",
};

export const mvpPermitWorkTypeOptions: PermitWorkType[] = [
  "GENERAL_HIGH_RISK",
  "HEIGHT_WORK",
  "CONTRACTOR_SITE_ACCESS",
];

export const permitStatusLabels: Record<PermitStatus, string> = {
  draft: "Черновик",
  pending_precheck: "На проверке документов",
  missing_documents: "Не хватает документов",
  pending_approval: "На согласовании",
  approved: "Согласован",
  active: "Активен",
  suspended: "Приостановлен",
  extended: "Продлён",
  closed: "Закрыт",
  rejected: "Отклонён",
  cancelled: "Отменён",
  expired: "Истёк",
  archived: "В архиве",
};

export const legalBasisOptions = [
  {
    key: "HIGH_RISK_PERMIT_RULES_344",
    label: "Правила оформления нарядов-допусков № 344",
    marker: "V2000021151",
  },
  {
    key: "BIOT_TRAINING_BRIEFING_1019",
    label: "Правила обучения, инструктирования и проверки знаний № 1019",
    marker: "V1500012665",
  },
  {
    key: "LABOR_CODE_KZ",
    label: "Трудовой кодекс РК",
    marker: "K1500000414",
  },
  {
    key: "HEIGHT_WORK_RULES",
    label: "Правила БиОТ при работе на высоте",
    marker: "V2200027349",
  },
  {
    key: "INDUSTRIAL_SAFETY_MINERALS",
    label: "Промышленная безопасность ОПО",
    marker: "V1400010258 / V2300031718",
  },
  {
    key: "MEDICAL_EXAMS",
    label: "Обязательные медицинские осмотры",
    marker: "V2000021443",
  },
  {
    key: "PPE_NORMS",
    label: "Нормы выдачи СИЗ",
    marker: "V1500012627",
  },
  {
    key: "E_DOCUMENT_E_SIGNATURE_LAW",
    label: "Закон об электронном документе и ЭЦП",
    marker: "Z030000370_",
  },
  {
    key: "DOCUMENT_MANAGEMENT_RULES_236",
    label: "Правила документирования и ЭДО № 236",
    marker: "V2300033339",
  },
  {
    key: "RETENTION_PERIODS",
    label: "Типовые сроки хранения документов",
    marker: "V1700015997 / G25JC000279",
  },
] as const;

export function getPermitTypeLabel(value: string | null | undefined) {
  return permitTypeLabels[value as PermitType] ?? value ?? "Не задано";
}

export function getPermitWorkTypeLabel(value: string | null | undefined) {
  return permitWorkTypeLabels[value as PermitWorkType] ?? value ?? "Не задано";
}

export function getPermitStatusLabel(value: string | null | undefined) {
  return permitStatusLabels[value as PermitStatus] ?? value ?? "Не задано";
}

export function mapPermitWorkTypeToCore(value: PermitWorkType): WorkPermitType {
  switch (value) {
    case "HOT_WORK":
      return "HOT_WORK";
    case "ELECTRICAL_WORK":
      return "ELECTRICAL";
    case "CONFINED_SPACE":
      return "CONFINED_SPACE";
    case "LIFTING_WORK":
      return "LIFTING";
    default:
      return "OTHER";
  }
}

export function mapPermitStatusToCore(value: PermitStatus): WorkPermitStatus {
  switch (value) {
    case "pending_approval":
      return "IN_APPROVAL";
    case "approved":
      return "APPROVED";
    case "active":
      return "ACTIVE";
    case "suspended":
      return "SUSPENDED";
    case "closed":
      return "CLOSED";
    case "cancelled":
      return "ANNULLED";
    case "expired":
      return "EXPIRED";
    case "archived":
      return "ARCHIVED";
    default:
      return "DRAFT";
  }
}

export function deriveScopeType(input: {
  branchId?: string | null;
  departmentId?: string | null;
  workSiteId?: string | null;
}) {
  if (input.workSiteId) return "WORK_SITE";
  if (input.departmentId) return "DEPARTMENT";
  if (input.branchId) return "BRANCH";
  return "ORGANIZATION";
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

export function getPermitEntry(record: {
  currentVersion?: { payloadJson?: unknown } | null;
}): PermitEntry | null {
  const payload = asObject(record.currentVersion?.payloadJson);
  const entry = asObject(payload.permitEntry);

  if (!entry.permitNumber && !entry.workType && !entry.permitType) {
    return null;
  }

  return {
    permitNumber: String(entry.permitNumber ?? ""),
    journalRegistrationNumber: String(entry.journalRegistrationNumber ?? ""),
    permitType: (entry.permitType as PermitType | undefined) ?? "HIGH_RISK_WORK",
    workType: (entry.workType as PermitWorkType | undefined) ?? "GENERAL_HIGH_RISK",
    status: (entry.status as PermitStatus | undefined) ?? "draft",
    workDescription: String(entry.workDescription ?? ""),
    workplace: String(entry.workplace ?? ""),
    companyId: typeof entry.companyId === "string" ? entry.companyId : null,
    journalId: typeof entry.journalId === "string" ? entry.journalId : null,
    workZoneId: typeof entry.workZoneId === "string" ? entry.workZoneId : null,
    departmentId: typeof entry.departmentId === "string" ? entry.departmentId : null,
    startAt: String(entry.startAt ?? ""),
    endAt: String(entry.endAt ?? ""),
    validUntil: typeof entry.validUntil === "string" ? entry.validUntil : null,
    contractorId: typeof entry.contractorId === "string" ? entry.contractorId : null,
    contractorRepresentativeId:
      typeof entry.contractorRepresentativeId === "string"
        ? entry.contractorRepresentativeId
        : null,
    issuerId: typeof entry.issuerId === "string" ? entry.issuerId : null,
    responsibleManagerId:
      typeof entry.responsibleManagerId === "string" ? entry.responsibleManagerId : null,
    workProducerId: typeof entry.workProducerId === "string" ? entry.workProducerId : null,
    admitterId: typeof entry.admitterId === "string" ? entry.admitterId : null,
    observerId: typeof entry.observerId === "string" ? entry.observerId : null,
    crewMemberIds: asStringArray(entry.crewMemberIds),
    hazardFactors: asStringArray(entry.hazardFactors),
    safetyMeasures: String(entry.safetyMeasures ?? ""),
    ppeRequirements: typeof entry.ppeRequirements === "string" ? entry.ppeRequirements : null,
    ppeIssuedConfirmed: entry.ppeIssuedConfirmed === true,
    legalBasis: asStringArray(entry.legalBasis),
    legalBasisVersion:
      typeof entry.legalBasisVersion === "string" ? entry.legalBasisVersion : null,
    legalBasisEffectiveDate:
      typeof entry.legalBasisEffectiveDate === "string"
        ? entry.legalBasisEffectiveDate
        : null,
    trainingEvidenceIds: asStringArray(entry.trainingEvidenceIds),
    briefingEvidenceIds: asStringArray(entry.briefingEvidenceIds),
    certificateEvidenceIds: asStringArray(entry.certificateEvidenceIds),
    medicalEvidenceIds: asStringArray(entry.medicalEvidenceIds),
    requiredDocumentIds: asStringArray(entry.requiredDocumentIds),
    precheckSummary: asObject(entry.precheckSummary) as PermitEntry["precheckSummary"],
    precheckChecks: Array.isArray(entry.precheckChecks)
      ? (entry.precheckChecks as PermitPrecheckCheck[])
      : [],
    trainingCheckSnapshot: asObject(entry.trainingCheckSnapshot) as PermitSnapshot,
    briefingCheckSnapshot: asObject(entry.briefingCheckSnapshot) as PermitSnapshot,
    certificateCheckSnapshot: asObject(entry.certificateCheckSnapshot) as PermitSnapshot,
    medicalCheckSnapshot: asObject(entry.medicalCheckSnapshot) as PermitEntry["medicalCheckSnapshot"],
    ppeIssuedSnapshot: asObject(entry.ppeIssuedSnapshot) as PermitEntry["ppeIssuedSnapshot"],
    requiredDocumentSnapshot: asObject(entry.requiredDocumentSnapshot) as PermitSnapshot,
    approvalStatus:
      typeof entry.approvalStatus === "string" ? entry.approvalStatus : null,
    signatureStatus:
      typeof entry.signatureStatus === "string" ? entry.signatureStatus : null,
    suspensionReason:
      typeof entry.suspensionReason === "string" ? entry.suspensionReason : null,
    cancellationReason:
      typeof entry.cancellationReason === "string" ? entry.cancellationReason : null,
    closure: entry.closure,
    signedPayloadHash:
      typeof entry.signedPayloadHash === "string" ? entry.signedPayloadHash : null,
    documentVersionHash:
      typeof entry.documentVersionHash === "string" ? entry.documentVersionHash : null,
    archivedAt: typeof entry.archivedAt === "string" ? entry.archivedAt : null,
    retentionUntil:
      typeof entry.retentionUntil === "string" ? entry.retentionUntil : null,
    createdAt: typeof entry.createdAt === "string" ? entry.createdAt : undefined,
    updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : undefined,
  };
}

export function getEffectivePermitStatus(record: PermitRecord) {
  return getPermitEntry(record)?.status ?? "draft";
}

export function isPermitLocked(record: PermitRecord) {
  const status = getEffectivePermitStatus(record);
  return [
    "approved",
    "active",
    "suspended",
    "closed",
    "cancelled",
    "expired",
    "archived",
  ].includes(status);
}

export function permitReferencesContractor(record: PermitRecord, contractorId: string) {
  return getPermitEntry(record)?.contractorId === contractorId;
}

export function permitReferencesEmployee(record: PermitRecord, employeeId: string) {
  const entry = getPermitEntry(record);

  if (!entry) {
    return false;
  }

  const directParticipants = [
    entry.contractorRepresentativeId,
    entry.issuerId,
    entry.responsibleManagerId,
    entry.workProducerId,
    entry.admitterId,
    entry.observerId,
  ];

  return (
    directParticipants.includes(employeeId) ||
    entry.crewMemberIds.includes(employeeId) ||
    record.brigades?.some((brigade) =>
      brigade.leaderEmployeeId === employeeId ||
      brigade.members?.some((member) => member.employeeId === employeeId),
    ) === true
  );
}

export function buildPermitPayload(permitEntry: PermitEntry) {
  return {
    source: "PERMIT_JOURNAL_UI_CANONICAL",
    canonicalContextFile: "docs/context/PERMIT_JOURNAL_UI_CANONICAL.md",
    permitEntry,
  };
}
