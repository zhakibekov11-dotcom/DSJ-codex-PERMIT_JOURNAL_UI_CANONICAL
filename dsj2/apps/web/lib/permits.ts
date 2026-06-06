import {
  permitEntrySchema,
  type PermitEntry,
  type PermitPrecheckCheck,
  type PermitSnapshot,
  type PermitStatus,
  type PermitType,
  type PermitWorkType,
} from "@dsj/types";

export type {
  PermitEntry,
  PermitPrecheckCheck,
  PermitSnapshot,
  PermitStatus,
  PermitType,
  PermitWorkType,
} from "@dsj/types";

export type PermitVersion = {
  id: string;
  permitId: string;
  versionNo: number;
  status: string;
  payloadJson: unknown;
  payloadHash: string;
  signedPayloadHash: string | null;
  documentEnvelopeId: string | null;
  documentVersionId: string | null;
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

export type PermitRecord = {
  id: string;
  organizationId: string;
  permitCode: string;
  journalRegistrationNumber: string;
  permitType: PermitType;
  workType: PermitWorkType;
  title: string;
  workDescription: string;
  workplace: string;
  scopeType: string;
  branchId: string | null;
  departmentId: string | null;
  workSiteId: string | null;
  contractorOrganizationId: string | null;
  contractorRepresentativeId: string | null;
  status: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  closedAt: string | null;
  signedPayloadHash: string | null;
  archiveRecordId: string | null;
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  currentVersion?: PermitVersion | null;
  versions?: PermitVersion[];
  brigades?: PermitBrigade[];
  approvals?: Array<{
    id: string;
    stepNo: number;
    role: string;
    status: string;
    assignedEmployeeId: string | null;
    comment: string | null;
    rejectionReason: string | null;
    decidedAt: string | null;
  }>;
  closure?: {
    result: string;
    inspection: string;
    notes: string | null;
    closedAt: string;
  } | null;
  documentEnvelope?: {
    id: string;
    status: string;
    signatures: Array<{
      id: string;
      signerName: string;
      certificateSerial: string;
      signedAt: string | null;
      verification?: { result: string } | null;
    }>;
    archiveRecords: Array<{
      id: string;
      status: string;
      archivedAt: string | null;
      disposalEligibleAt: string | null;
    }>;
  } | null;
  branch?: { id: string; name: string; code?: string | null } | null;
  workSite?: { id: string; name: string; location?: string | null } | null;
};

export type PermitPage = {
  items: PermitRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type PermitOption = {
  id: string;
  label: string;
  sublabel?: string | null;
};

export type PermitFormOptions = {
  employees: PermitOption[];
  contractorWorkers: PermitOption[];
  departments: PermitOption[];
  workSites: PermitOption[];
  contractors: PermitOption[];
  trainingEvidence: PermitOption[];
  briefingEvidence: PermitOption[];
  certificateEvidence: PermitOption[];
  medicalEvidence: PermitOption[];
  requiredDocuments: PermitOption[];
  ppeIssues: PermitOption[];
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

export const mvpPermitTypeOptions = Object.keys(
  permitTypeLabels,
) as PermitType[];

export const permitWorkTypeLabels: Record<PermitWorkType, string> = {
  GENERAL_HIGH_RISK: "Общие работы повышенной опасности",
  HEIGHT_WORK: "Работы на высоте",
  HOT_WORK: "Огневые работы",
  GAS_HAZARDOUS_WORK: "Газоопасные работы",
  ELECTRICAL_WORK: "Работы в электроустановках",
  EARTH_WORK: "Земляные работы",
  CONFINED_SPACE: "Работы в замкнутом пространстве",
  LIFTING_WORK: "Грузоподъёмные работы",
  CONTRACTOR_SITE_ACCESS: "Допуск подрядчика на объект",
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
  signing_ready: "Готов к подписи",
  signed: "Подписан",
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
    label: "Трудовой кодекс Республики Казахстан",
    marker: "K1500000414",
  },
  {
    key: "HEIGHT_WORK_RULES",
    label: "Правила безопасности при работе на высоте",
    marker: "V2200027349",
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

export function deriveScopeType(input: {
  branchId?: string | null;
  departmentId?: string | null;
  workSiteId?: string | null;
}) {
  if (input.workSiteId) return "WORK_SITE" as const;
  if (input.departmentId) return "DEPARTMENT" as const;
  if (input.branchId) return "BRANCH" as const;
  return "ORGANIZATION" as const;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string => typeof item === "string" && item.length > 0,
      )
    : [];
}

export function getPermitEntry(record: {
  currentVersion?: { payloadJson?: unknown } | null;
}): PermitEntry | null {
  const payload = asObject(record.currentVersion?.payloadJson);
  const rawEntry = asObject(payload.permitEntry);
  const parsed = permitEntrySchema.safeParse(rawEntry);

  if (parsed.success) {
    return parsed.data;
  }

  if (!rawEntry.permitNumber && !rawEntry.workType && !rawEntry.permitType) {
    return null;
  }

  return {
    permitNumber: String(rawEntry.permitNumber ?? ""),
    journalRegistrationNumber: String(rawEntry.journalRegistrationNumber ?? ""),
    permitType: (rawEntry.permitType as PermitType) ?? "HIGH_RISK_WORK",
    workType: (rawEntry.workType as PermitWorkType) ?? "GENERAL_HIGH_RISK",
    status: (rawEntry.status as PermitStatus) ?? "draft",
    workDescription: String(rawEntry.workDescription ?? ""),
    workplace: String(rawEntry.workplace ?? ""),
    companyId:
      typeof rawEntry.companyId === "string" ? rawEntry.companyId : null,
    journalId:
      typeof rawEntry.journalId === "string" ? rawEntry.journalId : null,
    workZoneId:
      typeof rawEntry.workZoneId === "string" ? rawEntry.workZoneId : null,
    departmentId:
      typeof rawEntry.departmentId === "string" ? rawEntry.departmentId : null,
    startAt: String(rawEntry.startAt ?? new Date(0).toISOString()),
    endAt: String(rawEntry.endAt ?? new Date(0).toISOString()),
    validUntil:
      typeof rawEntry.validUntil === "string" ? rawEntry.validUntil : null,
    contractorId:
      typeof rawEntry.contractorId === "string" ? rawEntry.contractorId : null,
    contractorRepresentativeId:
      typeof rawEntry.contractorRepresentativeId === "string"
        ? rawEntry.contractorRepresentativeId
        : null,
    issuerId: typeof rawEntry.issuerId === "string" ? rawEntry.issuerId : null,
    responsibleManagerId:
      typeof rawEntry.responsibleManagerId === "string"
        ? rawEntry.responsibleManagerId
        : null,
    workProducerId:
      typeof rawEntry.workProducerId === "string"
        ? rawEntry.workProducerId
        : null,
    admitterId:
      typeof rawEntry.admitterId === "string" ? rawEntry.admitterId : null,
    observerId:
      typeof rawEntry.observerId === "string" ? rawEntry.observerId : null,
    crew: Array.isArray(rawEntry.crew)
      ? (rawEntry.crew as PermitEntry["crew"])
      : asStringArray(rawEntry.crewMemberIds).map((employeeId) => ({
          employeeId,
          contractorWorkerId: null,
          roleCode: "EXECUTOR",
        })),
    crewMemberIds: asStringArray(rawEntry.crewMemberIds),
    hazardFactors: asStringArray(rawEntry.hazardFactors),
    safetyMeasures: String(rawEntry.safetyMeasures ?? ""),
    ppeRequirements:
      typeof rawEntry.ppeRequirements === "string"
        ? rawEntry.ppeRequirements
        : null,
    ppeIssueRecordIds: asStringArray(rawEntry.ppeIssueRecordIds),
    legalBasis: asStringArray(rawEntry.legalBasis),
    legalBasisVersion:
      typeof rawEntry.legalBasisVersion === "string"
        ? rawEntry.legalBasisVersion
        : null,
    legalBasisEffectiveDate:
      typeof rawEntry.legalBasisEffectiveDate === "string"
        ? rawEntry.legalBasisEffectiveDate
        : null,
    trainingEvidenceIds: asStringArray(rawEntry.trainingEvidenceIds),
    briefingEvidenceIds: asStringArray(rawEntry.briefingEvidenceIds),
    certificateEvidenceIds: asStringArray(rawEntry.certificateEvidenceIds),
    medicalEvidenceIds: asStringArray(rawEntry.medicalEvidenceIds),
    requiredDocumentIds: asStringArray(rawEntry.requiredDocumentIds),
    precheckSummary: Object.keys(asObject(rawEntry.precheckSummary)).length
      ? (asObject(rawEntry.precheckSummary) as PermitEntry["precheckSummary"])
      : null,
    precheckChecks: Array.isArray(rawEntry.precheckChecks)
      ? (rawEntry.precheckChecks as PermitPrecheckCheck[])
      : [],
    trainingCheckSnapshot: rawEntry.trainingCheckSnapshot as
      | PermitSnapshot
      | undefined,
    briefingCheckSnapshot: rawEntry.briefingCheckSnapshot as
      | PermitSnapshot
      | undefined,
    certificateCheckSnapshot: rawEntry.certificateCheckSnapshot as
      | PermitSnapshot
      | undefined,
    medicalCheckSnapshot: rawEntry.medicalCheckSnapshot as
      | PermitEntry["medicalCheckSnapshot"]
      | undefined,
    ppeIssuedSnapshot: rawEntry.ppeIssuedSnapshot as PermitSnapshot | undefined,
    requiredDocumentSnapshot: rawEntry.requiredDocumentSnapshot as
      | PermitSnapshot
      | undefined,
    approvalStatus:
      typeof rawEntry.approvalStatus === "string"
        ? rawEntry.approvalStatus
        : null,
    signatureStatus:
      typeof rawEntry.signatureStatus === "string"
        ? rawEntry.signatureStatus
        : null,
    suspensionReason:
      typeof rawEntry.suspensionReason === "string"
        ? rawEntry.suspensionReason
        : null,
    cancellationReason:
      typeof rawEntry.cancellationReason === "string"
        ? rawEntry.cancellationReason
        : null,
    rejectionReason:
      typeof rawEntry.rejectionReason === "string"
        ? rawEntry.rejectionReason
        : null,
    closure: rawEntry.closure as PermitEntry["closure"],
    signedPayloadHash:
      typeof rawEntry.signedPayloadHash === "string"
        ? rawEntry.signedPayloadHash
        : null,
    documentVersionHash:
      typeof rawEntry.documentVersionHash === "string"
        ? rawEntry.documentVersionHash
        : null,
    archivedAt:
      typeof rawEntry.archivedAt === "string" ? rawEntry.archivedAt : null,
    retentionUntil:
      typeof rawEntry.retentionUntil === "string"
        ? rawEntry.retentionUntil
        : null,
    createdAt:
      typeof rawEntry.createdAt === "string" ? rawEntry.createdAt : undefined,
    updatedAt:
      typeof rawEntry.updatedAt === "string" ? rawEntry.updatedAt : undefined,
  };
}

const statusByDatabaseValue: Record<string, PermitStatus> = {
  DRAFT: "draft",
  SUBMITTED: "pending_approval",
  MISSING_DOCUMENTS: "missing_documents",
  IN_APPROVAL: "pending_approval",
  APPROVED: "approved",
  SIGNING_READY: "signing_ready",
  SIGNED: "signed",
  ACTIVE: "active",
  SUSPENDED: "suspended",
  EXTENDED: "extended",
  CLOSED: "closed",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
  ANNULLED: "cancelled",
  EXPIRED: "expired",
  ARCHIVED: "archived",
};

export function getEffectivePermitStatus(record: PermitRecord) {
  return (
    statusByDatabaseValue[record.status] ??
    getPermitEntry(record)?.status ??
    "draft"
  );
}

export function isPermitLocked(record: PermitRecord) {
  return !["draft", "missing_documents", "rejected"].includes(
    getEffectivePermitStatus(record),
  );
}

export function permitReferencesContractor(
  record: PermitRecord,
  contractorId: string,
) {
  return (
    record.contractorOrganizationId === contractorId ||
    getPermitEntry(record)?.contractorId === contractorId
  );
}

export function permitReferencesEmployee(
  record: PermitRecord,
  employeeId: string,
) {
  const entry = getPermitEntry(record);
  const directParticipants = entry
    ? [
        entry.issuerId,
        entry.responsibleManagerId,
        entry.workProducerId,
        entry.admitterId,
        entry.observerId,
      ]
    : [];

  return (
    directParticipants.includes(employeeId) ||
    entry?.crewMemberIds.includes(employeeId) === true ||
    record.brigades?.some(
      (brigade) =>
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
