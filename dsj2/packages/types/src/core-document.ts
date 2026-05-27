import { z } from "zod";
import { scopeTypeSchema } from "./core-identity";

const jsonValueSchema: z.ZodType<unknown> = z.unknown();
const isoStringSchema = z.string().min(1);

export const documentKindSchema = z.enum([
  "EMPLOYEE_DOCUMENT",
  "QUALIFICATION_DOCUMENT",
  "TRAINING_PLAN",
  "ORDER",
  "BRIEFING_JOURNAL",
  "BRIEFING_JOURNAL_ENTRY",
  "PROTOCOL",
  "WORK_PERMIT",
]);

export const documentEnvelopeStatusSchema = z.enum([
  "DRAFT",
  "IN_APPROVAL",
  "SIGNING_READY",
  "SIGNED",
  "ACTIVE",
  "SUPERSEDED",
  "ANNULLED",
  "ARCHIVED",
]);

export const documentVersionStatusSchema = z.enum([
  "DRAFT",
  "FINAL",
  "SIGNED",
  "VOIDED",
]);

export const canonicalDocumentStatusSchema = z.enum([
  "draft",
  "on_approval",
  "approved",
  "signed",
  "annulled",
  "replaced",
  "expired",
]);

export const documentTemplateStatusSchema = z.enum([
  "DRAFT",
  "ACTIVE",
  "ARCHIVED",
]);

export const approvalRouteStatusSchema = z.enum([
  "DRAFT",
  "ACTIVE",
  "ARCHIVED",
]);

export const approvalStepActionSchema = z.enum([
  "REVIEW",
  "APPROVE",
  "SIGN",
  "ACKNOWLEDGE",
]);

export const signatureLifecycleStatusSchema = z.enum([
  "PREPARED",
  "SIGNED",
  "VERIFIED",
  "FAILED",
  "REVOKED",
]);

export const signatureVerificationResultSchema = z.enum([
  "PASS",
  "FAIL",
]);

export const exportSnapshotFormatSchema = z.enum([
  "PDF_A_1",
  "PDF",
  "JSON",
  "ZIP",
]);

export const archiveRecordStatusSchema = z.enum([
  "PENDING",
  "SEALED",
  "ARCHIVED",
  "LEGAL_HOLD",
  "DISPOSAL_SCHEDULED",
  "DESTROYED",
]);

export const retentionUnitSchema = z.enum([
  "DAYS",
  "MONTHS",
  "YEARS",
  "INDEFINITE",
]);

export const attachmentOwnerTypeSchema = z.enum([
  "DOCUMENT_ENVELOPE",
  "DOCUMENT_VERSION",
  "WORK_PERMIT",
  "WORK_PERMIT_VERSION",
  "BRIEFING_JOURNAL_ENTRY",
  "ORDER_VERSION",
  "ARCHIVE_RECORD",
]);

export const documentTemplateSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  templateCode: z.string(),
  documentKind: documentKindSchema,
  scopeType: scopeTypeSchema,
  templateVersion: z.number().int().positive(),
  status: documentTemplateStatusSchema,
  schemaJson: jsonValueSchema,
  renderPolicyJson: jsonValueSchema,
  effectiveFrom: isoStringSchema,
  effectiveTo: z.string().nullable().optional(),
  createdAt: isoStringSchema,
  updatedAt: isoStringSchema,
});

export const approvalRouteSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  routeCode: z.string(),
  documentKind: documentKindSchema,
  scopeType: scopeTypeSchema,
  routeVersion: z.number().int().positive(),
  status: approvalRouteStatusSchema,
  isDefault: z.boolean(),
  effectiveFrom: isoStringSchema,
  effectiveTo: z.string().nullable().optional(),
  createdAt: isoStringSchema,
  updatedAt: isoStringSchema,
});

export const approvalStepSchema = z.object({
  id: z.string(),
  routeId: z.string(),
  stepNo: z.number().int().positive(),
  groupKey: z.string().nullable().optional(),
  quorum: z.number().int().positive(),
  action: approvalStepActionSchema,
  requiredRoleCode: z.string().nullable().optional(),
  requiredPrincipalType: z.string().nullable().optional(),
  requiredPrincipalId: z.string().nullable().optional(),
  requiredDepartmentId: z.string().nullable().optional(),
  requiredBranchId: z.string().nullable().optional(),
  requiredWorkSiteId: z.string().nullable().optional(),
  slaHours: z.number().int().positive().nullable().optional(),
  isMandatory: z.boolean(),
  createdAt: isoStringSchema,
  updatedAt: isoStringSchema,
});

export const documentEnvelopeSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  documentKind: documentKindSchema,
  scopeType: scopeTypeSchema,
  branchId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  workSiteId: z.string().nullable().optional(),
  businessObjectType: z.string(),
  businessObjectId: z.string(),
  documentNumber: z.string(),
  title: z.string(),
  status: documentEnvelopeStatusSchema,
  templateId: z.string().nullable().optional(),
  approvalRouteId: z.string().nullable().optional(),
  currentVersionId: z.string().nullable().optional(),
  createdByUserId: z.string().nullable().optional(),
  createdAt: isoStringSchema,
  updatedAt: isoStringSchema,
});

export const documentVersionSchema = z.object({
  id: z.string(),
  envelopeId: z.string(),
  versionNo: z.number().int().positive(),
  templateId: z.string().nullable().optional(),
  status: documentVersionStatusSchema,
  payloadJson: jsonValueSchema,
  renderedHash: z.string().nullable().optional(),
  changeReason: z.string().nullable().optional(),
  createdByUserId: z.string().nullable().optional(),
  createdAt: isoStringSchema,
  signedAt: z.string().nullable().optional(),
  annulledAt: z.string().nullable().optional(),
  effectiveFrom: z.string().nullable().optional(),
  effectiveTo: z.string().nullable().optional(),
});

export const certificateMetadataSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  provider: z.string(),
  serial: z.string(),
  thumbprint: z.string(),
  subjectDn: z.string(),
  issuerDn: z.string(),
  validFrom: isoStringSchema,
  validTo: isoStringSchema,
  source: z.string(),
  isRevoked: z.boolean(),
  revocationReason: z.string().nullable().optional(),
  createdAt: isoStringSchema,
  updatedAt: isoStringSchema,
});

export const signatureSchema = z.object({
  id: z.string(),
  organizationId: z.string().nullable().optional(),
  companyId: z.string().nullable().optional(),
  briefingRecordId: z.string().nullable().optional(),
  briefingJournalEntryId: z.string().nullable().optional(),
  documentEnvelopeId: z.string().nullable().optional(),
  documentVersionId: z.string().nullable().optional(),
  signerUserId: z.string().nullable().optional(),
  signerEmployeeId: z.string().nullable().optional(),
  signerRole: z.string().nullable().optional(),
  provider: z.string(),
  status: signatureLifecycleStatusSchema,
  signerName: z.string(),
  signerIinMasked: z.string(),
  certificateSerial: z.string(),
  certificateMetadataId: z.string().nullable().optional(),
  documentHash: z.string(),
  signatureHash: z.string().nullable().optional(),
  signedAt: z.string().nullable().optional(),
  verifiedAt: z.string().nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
  payload: jsonValueSchema.nullable().optional(),
});

export const signatureVerificationSchema = z.object({
  id: z.string(),
  signatureId: z.string(),
  checkedAt: isoStringSchema,
  result: signatureVerificationResultSchema,
  chainStatus: z.string().nullable().optional(),
  revocationStatus: z.string().nullable().optional(),
  evidenceJson: jsonValueSchema.nullable().optional(),
  errorCode: z.string().nullable().optional(),
  verifiedByUserId: z.string().nullable().optional(),
});

export const attachmentSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  ownerType: attachmentOwnerTypeSchema,
  ownerId: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string(),
  storageUri: z.string(),
  createdByUserId: z.string().nullable().optional(),
  createdAt: isoStringSchema,
});

export const exportSnapshotSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  envelopeId: z.string(),
  versionId: z.string().nullable().optional(),
  format: exportSnapshotFormatSchema,
  storageUri: z.string(),
  sha256: z.string(),
  manifestJson: jsonValueSchema.nullable().optional(),
  generatedByUserId: z.string().nullable().optional(),
  generatedAt: isoStringSchema,
});

export const retentionPolicySchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  retentionCode: z.string(),
  documentKind: documentKindSchema,
  scopeType: scopeTypeSchema,
  retentionValue: z.number().int().nonnegative(),
  retentionUnit: retentionUnitSchema,
  archiveFormat: exportSnapshotFormatSchema,
  legalBasis: z.string(),
  holdAllowed: z.boolean(),
  destructionApprovalRequired: z.boolean(),
  effectiveFrom: isoStringSchema,
  effectiveTo: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  createdAt: isoStringSchema,
  updatedAt: isoStringSchema,
});

export const archiveRecordSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  envelopeId: z.string(),
  versionId: z.string().nullable().optional(),
  retentionPolicyId: z.string(),
  status: archiveRecordStatusSchema,
  sealedAt: z.string().nullable().optional(),
  archivedAt: z.string().nullable().optional(),
  disposalEligibleAt: z.string().nullable().optional(),
  disposedAt: z.string().nullable().optional(),
  archiveManifestHash: z.string(),
  storageUri: z.string().nullable().optional(),
  holdReason: z.string().nullable().optional(),
  createdAt: isoStringSchema,
  updatedAt: isoStringSchema,
});

export const canonicalDocumentSchema = z.object({
  envelopeId: z.string(),
  documentKind: documentKindSchema,
  documentNumber: z.string(),
  title: z.string(),
  canonicalStatus: canonicalDocumentStatusSchema,
  currentVersionId: z.string().nullable().optional(),
  currentVersionNo: z.number().int().positive().nullable().optional(),
  signedAt: z.string().nullable().optional(),
  annulledAt: z.string().nullable().optional(),
  effectiveFrom: z.string().nullable().optional(),
  effectiveTo: z.string().nullable().optional(),
});

export const evidencePackageSchema = z.object({
  generatedAt: isoStringSchema,
  document: canonicalDocumentSchema,
  signatures: z.array(
    z.object({
      id: z.string(),
      provider: z.string(),
      status: signatureLifecycleStatusSchema,
      signerName: z.string(),
      signerIinMasked: z.string(),
      certificateSerial: z.string(),
      documentHash: z.string(),
      signatureHash: z.string().nullable().optional(),
      signedAt: z.string().nullable().optional(),
      verifiedAt: z.string().nullable().optional(),
      certificateMetadata: certificateMetadataSchema.nullable().optional(),
      verification: signatureVerificationSchema.nullable().optional(),
    }),
  ),
  exportSnapshots: z.array(exportSnapshotSchema),
  archiveRecords: z.array(archiveRecordSchema),
});

export const createDocumentTemplateSchema = z.object({
  organizationId: z.string().optional(),
  templateCode: z.string().min(2).max(64),
  documentKind: documentKindSchema,
  scopeType: scopeTypeSchema,
  templateVersion: z.number().int().positive().default(1),
  status: documentTemplateStatusSchema.default("DRAFT"),
  schemaJson: jsonValueSchema,
  renderPolicyJson: jsonValueSchema,
  effectiveFrom: isoStringSchema,
  effectiveTo: z.string().nullable().optional(),
});

export const createApprovalRouteSchema = z.object({
  organizationId: z.string().optional(),
  routeCode: z.string().min(2).max(64),
  documentKind: documentKindSchema,
  scopeType: scopeTypeSchema,
  routeVersion: z.number().int().positive().default(1),
  status: approvalRouteStatusSchema.default("DRAFT"),
  isDefault: z.boolean().default(false),
  effectiveFrom: isoStringSchema,
  effectiveTo: z.string().nullable().optional(),
});

export const createApprovalStepSchema = z.object({
  routeId: z.string(),
  stepNo: z.number().int().positive(),
  groupKey: z.string().nullable().optional(),
  quorum: z.number().int().positive().default(1),
  action: approvalStepActionSchema,
  requiredRoleCode: z.string().nullable().optional(),
  requiredPrincipalType: z.string().nullable().optional(),
  requiredPrincipalId: z.string().nullable().optional(),
  requiredDepartmentId: z.string().nullable().optional(),
  requiredBranchId: z.string().nullable().optional(),
  requiredWorkSiteId: z.string().nullable().optional(),
  slaHours: z.number().int().positive().nullable().optional(),
  isMandatory: z.boolean().default(true),
});

export const createDocumentEnvelopeSchema = z.object({
  organizationId: z.string().optional(),
  documentKind: documentKindSchema,
  scope: z.object({
    organizationId: z.string(),
    branchId: z.string().nullable().optional(),
    departmentId: z.string().nullable().optional(),
    workSiteId: z.string().nullable().optional(),
  }),
  businessObjectType: z.string().min(1).max(120),
  businessObjectId: z.string().min(1),
  documentNumber: z.string().min(1).max(120),
  title: z.string().min(2).max(255),
  templateId: z.string().nullable().optional(),
  approvalRouteId: z.string().nullable().optional(),
  status: documentEnvelopeStatusSchema.default("DRAFT"),
});

export const createDocumentVersionSchema = z.object({
  envelopeId: z.string(),
  versionNo: z.number().int().positive().optional(),
  templateId: z.string().nullable().optional(),
  payloadJson: jsonValueSchema,
  renderedHash: z.string().min(32).nullable().optional(),
  changeReason: z.string().max(1000).nullable().optional(),
  status: documentVersionStatusSchema.default("DRAFT"),
});

export const createCertificateMetadataSchema = z.object({
  organizationId: z.string().optional(),
  provider: z.string().min(1),
  serial: z.string().min(1),
  thumbprint: z.string().min(1),
  subjectDn: z.string().min(1),
  issuerDn: z.string().min(1),
  validFrom: isoStringSchema,
  validTo: isoStringSchema,
  source: z.string().min(1).max(255),
  isRevoked: z.boolean().default(false),
  revocationReason: z.string().nullable().optional(),
});

export const createSignatureSchema = z.object({
  organizationId: z.string().optional(),
  envelopeId: z.string().nullable().optional(),
  versionId: z.string().nullable().optional(),
  companyId: z.string().nullable().optional(),
  briefingRecordId: z.string().nullable().optional(),
  briefingJournalEntryId: z.string().nullable().optional(),
  signerUserId: z.string().nullable().optional(),
  signerEmployeeId: z.string().nullable().optional(),
  signerRole: z.string().min(1).max(120).nullable().optional(),
  provider: z.string().min(1),
  signerName: z.string().min(2).max(255),
  signerIinMasked: z.string().min(4).max(32),
  certificateSerial: z.string().min(3).max(255),
  certificateMetadataId: z.string().nullable().optional(),
  documentHash: z.string().min(32),
  signatureHash: z.string().nullable().optional(),
  signedAt: z.string().optional(),
  status: signatureLifecycleStatusSchema.default("PREPARED"),
  payload: jsonValueSchema.nullable().optional(),
  finalizeDocumentOnSign: z.boolean().optional(),
});

export const createSignatureVerificationSchema = z.object({
  signatureId: z.string(),
  result: signatureVerificationResultSchema,
  chainStatus: z.string().nullable().optional(),
  revocationStatus: z.string().nullable().optional(),
  evidenceJson: jsonValueSchema.nullable().optional(),
  errorCode: z.string().nullable().optional(),
  verifiedByUserId: z.string().nullable().optional(),
});

export const createAttachmentSchema = z.object({
  organizationId: z.string().optional(),
  ownerType: attachmentOwnerTypeSchema,
  ownerId: z.string(),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(255),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string().min(64).max(128),
  storageUri: z.string().min(1).max(2000),
  createdByUserId: z.string().nullable().optional(),
});

export const createExportSnapshotSchema = z.object({
  organizationId: z.string().optional(),
  envelopeId: z.string(),
  versionId: z.string().nullable().optional(),
  format: exportSnapshotFormatSchema.default("PDF_A_1"),
  storageUri: z.string().min(1).max(2000),
  sha256: z.string().min(64).max(128),
  manifestJson: jsonValueSchema.nullable().optional(),
  generatedByUserId: z.string().nullable().optional(),
});

export const createRetentionPolicySchema = z.object({
  organizationId: z.string().optional(),
  retentionCode: z.string().min(2).max(64),
  documentKind: documentKindSchema,
  scopeType: scopeTypeSchema,
  retentionValue: z.number().int().nonnegative(),
  retentionUnit: retentionUnitSchema,
  archiveFormat: exportSnapshotFormatSchema.default("PDF_A_1"),
  legalBasis: z.string().min(5).max(2000),
  holdAllowed: z.boolean().default(true),
  destructionApprovalRequired: z.boolean().default(false),
  effectiveFrom: isoStringSchema,
  effectiveTo: z.string().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
});

export const createArchiveRecordSchema = z.object({
  organizationId: z.string().optional(),
  envelopeId: z.string(),
  versionId: z.string().nullable().optional(),
  retentionPolicyId: z.string(),
  status: archiveRecordStatusSchema.default("PENDING"),
  sealedAt: z.string().nullable().optional(),
  archivedAt: z.string().nullable().optional(),
  disposalEligibleAt: z.string().nullable().optional(),
  disposedAt: z.string().nullable().optional(),
  archiveManifestHash: z.string().min(64).max(128),
  storageUri: z.string().nullable().optional(),
  holdReason: z.string().nullable().optional(),
});

export type DocumentKind = z.infer<typeof documentKindSchema>;
export type DocumentEnvelopeStatus = z.infer<typeof documentEnvelopeStatusSchema>;
export type DocumentVersionStatus = z.infer<typeof documentVersionStatusSchema>;
export type DocumentTemplateStatus = z.infer<typeof documentTemplateStatusSchema>;
export type ApprovalRouteStatus = z.infer<typeof approvalRouteStatusSchema>;
export type ApprovalStepAction = z.infer<typeof approvalStepActionSchema>;
export type CanonicalDocumentStatus = z.infer<typeof canonicalDocumentStatusSchema>;
export type SignatureLifecycleStatus = z.infer<typeof signatureLifecycleStatusSchema>;
export type SignatureVerificationResult = z.infer<typeof signatureVerificationResultSchema>;
export type ExportSnapshotFormat = z.infer<typeof exportSnapshotFormatSchema>;
export type ArchiveRecordStatus = z.infer<typeof archiveRecordStatusSchema>;
export type RetentionUnit = z.infer<typeof retentionUnitSchema>;
export type AttachmentOwnerType = z.infer<typeof attachmentOwnerTypeSchema>;
export type DocumentTemplate = z.infer<typeof documentTemplateSchema>;
export type ApprovalRoute = z.infer<typeof approvalRouteSchema>;
export type ApprovalStep = z.infer<typeof approvalStepSchema>;
export type DocumentEnvelope = z.infer<typeof documentEnvelopeSchema>;
export type DocumentVersion = z.infer<typeof documentVersionSchema>;
export type CertificateMetadata = z.infer<typeof certificateMetadataSchema>;
export type Signature = z.infer<typeof signatureSchema>;
export type SignatureVerification = z.infer<typeof signatureVerificationSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;
export type ExportSnapshot = z.infer<typeof exportSnapshotSchema>;
export type RetentionPolicy = z.infer<typeof retentionPolicySchema>;
export type ArchiveRecord = z.infer<typeof archiveRecordSchema>;
export type CanonicalDocument = z.infer<typeof canonicalDocumentSchema>;
export type EvidencePackage = z.infer<typeof evidencePackageSchema>;
export type CreateDocumentTemplateInput = z.infer<typeof createDocumentTemplateSchema>;
export type CreateApprovalRouteInput = z.infer<typeof createApprovalRouteSchema>;
export type CreateApprovalStepInput = z.infer<typeof createApprovalStepSchema>;
export type CreateDocumentEnvelopeInput = z.infer<typeof createDocumentEnvelopeSchema>;
export type CreateDocumentVersionInput = z.infer<typeof createDocumentVersionSchema>;
export type CreateCertificateMetadataInput = z.infer<typeof createCertificateMetadataSchema>;
export type CreateSignatureInput = z.infer<typeof createSignatureSchema>;
export type CreateSignatureVerificationInput = z.infer<typeof createSignatureVerificationSchema>;
export type CreateAttachmentInput = z.infer<typeof createAttachmentSchema>;
export type CreateExportSnapshotInput = z.infer<typeof createExportSnapshotSchema>;
export type CreateRetentionPolicyInput = z.infer<typeof createRetentionPolicySchema>;
export type CreateArchiveRecordInput = z.infer<typeof createArchiveRecordSchema>;
