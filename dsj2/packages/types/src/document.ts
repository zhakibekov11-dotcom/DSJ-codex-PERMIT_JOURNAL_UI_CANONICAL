import { z } from "zod";
import {
  complianceDocumentTypeCategorySchema,
  employeeDocumentVerificationStatusSchema,
} from "./compliance";
import {
  archiveRecordStatusSchema,
  canonicalDocumentStatusSchema,
  documentEnvelopeStatusSchema,
  documentVersionStatusSchema,
  signatureVerificationResultSchema,
} from "./core-document";
import {
  documentHashSchema,
  optionalBriefingSignInputSchema,
  signatureProviderSchema,
} from "./signing";

export const documentTypeSchema = z.enum([
  "CERTIFICATE",
  "PROTOCOL",
  "STATEMENT",
  "COMPLETION_CONFIRMATION",
  "SAFETY_CERTIFICATE",
]);

export const documentStatusSchema = z.enum([
  "DRAFT",
  "ACTIVE",
  "EXPIRING",
  "EXPIRED",
]);

export const companyDocumentCategorySchema = z.enum([
  "LOCAL_ACT",
  "ORDER",
  "INSTRUCTION",
  "JOURNAL",
  "TRAINING_CERTIFICATION",
]);

export const companyDocumentStatusSchema = z.enum([
  "DRAFT",
  "ACTIVE",
  "ARCHIVED",
]);

export const safetyCertificateStatusSchema = z.enum([
  "ACTIVE",
  "EXPIRING_SOON",
  "EXPIRED",
]);

export const employeeDocumentAllowedActionsSchema = z.object({
  canPrepareSign: z.boolean(),
  canSign: z.boolean(),
  canAnnul: z.boolean(),
  canReplace: z.boolean(),
  canDownloadEvidence: z.boolean(),
});

export const employeeDocumentSignatureSummarySchema = z.object({
  id: z.string(),
  provider: signatureProviderSchema,
  status: z.string(),
  signerName: z.string(),
  signerIinMasked: z.string(),
  certificateSerial: z.string(),
  signedAt: z.string().nullable().optional(),
  verifiedAt: z.string().nullable().optional(),
  verificationResult: signatureVerificationResultSchema.nullable().optional(),
  chainStatus: z.string().nullable().optional(),
  revocationStatus: z.string().nullable().optional(),
  signatureHash: z.string().nullable().optional(),
});

export const employeeDocumentArchiveSummarySchema = z.object({
  id: z.string(),
  status: archiveRecordStatusSchema,
  sealedAt: z.string().nullable().optional(),
  archivedAt: z.string().nullable().optional(),
  disposalEligibleAt: z.string().nullable().optional(),
  storageUri: z.string().nullable().optional(),
  retentionCode: z.string(),
  retentionSource: z.enum(["configured", "baseline"]),
});

export const employeeDocumentSigningContractSchema = z.object({
  mode: z.literal("SELF_SERVICE"),
  requiresExternalSignature: z.boolean(),
  documentHash: documentHashSchema,
  provider: signatureProviderSchema.nullable().optional(),
  signRole: z.literal("EMPLOYEE_SIGNER"),
  bridgeContext: z.object({
    employeeDocumentId: z.string(),
    documentNumber: z.string().nullable().optional(),
  }),
});

export const employeeDocumentSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  employeeId: z.string(),
  trainingAssignmentId: z.string().nullable().optional(),
  documentTypeDefinitionId: z.string().nullable().optional(),
  documentEnvelopeId: z.string().nullable().optional(),
  title: z.string(),
  documentNumber: z.string().nullable().optional(),
  documentType: documentTypeSchema,
  issueDate: z.string(),
  expiryDate: z.string().nullable(),
  issuerName: z.string(),
  status: documentStatusSchema,
  verificationStatus: employeeDocumentVerificationStatusSchema,
  verifiedAt: z.string().nullable().optional(),
  verificationNotes: z.string().nullable().optional(),
  fileName: z.string().nullable(),
  fileUrl: z.string().nullable(),
  canonicalStatus: canonicalDocumentStatusSchema.nullable().optional(),
  documentEnvelopeStatus: documentEnvelopeStatusSchema.nullable().optional(),
  documentVersionId: z.string().nullable().optional(),
  documentVersionStatus: documentVersionStatusSchema.nullable().optional(),
  currentVersionNo: z.number().int().positive().nullable().optional(),
  signingDigest: documentHashSchema.nullable().optional(),
  isSigned: z.boolean().optional(),
  signedAt: z.string().nullable().optional(),
  annulledAt: z.string().nullable().optional(),
  evidenceAvailable: z.boolean().optional(),
  latestSignature: employeeDocumentSignatureSummarySchema.nullable().optional(),
  archiveRecordSummary: employeeDocumentArchiveSummarySchema.nullable().optional(),
  allowedActions: employeeDocumentAllowedActionsSchema.optional(),
  documentTypeDefinition: z
    .object({
      id: z.string(),
      code: z.string(),
      name: z.string(),
      category: complianceDocumentTypeCategorySchema,
      requiresExpiry: z.boolean(),
      requiresVerification: z.boolean(),
    })
    .nullable()
    .optional(),
});

export const createEmployeeDocumentSchema = z.object({
  companyId: z.string().optional(),
  employeeId: z.string(),
  title: z.string().min(3),
  documentNumber: z.string().max(120).nullable().optional(),
  documentTypeDefinitionId: z.string().nullable().optional(),
  documentType: documentTypeSchema,
  issueDate: z.string(),
  expiryDate: z.string().nullable().optional(),
  issuerName: z.string().min(2),
  status: documentStatusSchema.default("ACTIVE"),
  fileName: z.string().max(255).nullable().optional(),
  fileUrl: z.string().max(2000).nullable().optional(),
});

export const verifyEmployeeDocumentSchema = z.object({
  verificationStatus: employeeDocumentVerificationStatusSchema,
  verificationNotes: z.string().max(1000).nullable().optional(),
});

export const prepareEmployeeDocumentForSigningSchema = z.object({});

export const signEmployeeDocumentSchema = optionalBriefingSignInputSchema;
export const employeeDocumentSignRequestSchema = signEmployeeDocumentSchema;

export const annulEmployeeDocumentSchema = z.object({
  reason: z.string().max(1000).nullable().optional(),
});

export const replaceEmployeeDocumentSchema = createEmployeeDocumentSchema
  .omit({
    companyId: true,
    employeeId: true,
  })
  .extend({
    reason: z.string().max(1000).nullable().optional(),
  });
export const employeeDocumentReplaceRequestSchema = replaceEmployeeDocumentSchema;

export const prepareEmployeeDocumentForSigningResponseSchema = z.object({
  document: employeeDocumentSchema,
  envelopeId: z.string(),
  versionId: z.string(),
  versionNo: z.number().int().positive(),
  digest: documentHashSchema,
  allowedActions: employeeDocumentAllowedActionsSchema,
  contract: employeeDocumentSigningContractSchema,
});

export const employeeDocumentFilterSchema = z.object({
  companyId: z.string().optional(),
  employeeId: z.string().optional(),
  status: documentStatusSchema.optional(),
  documentType: documentTypeSchema.optional(),
  search: z.string().optional(),
});

export const companyDocumentSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  createdByUserId: z.string(),
  category: companyDocumentCategorySchema,
  documentName: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  body: z.string(),
  issueDate: z.string().nullable(),
  status: companyDocumentStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  createdByUserName: z.string(),
});

export const createCompanyDocumentSchema = z.object({
  companyId: z.string().optional(),
  category: companyDocumentCategorySchema,
  documentName: z.string().min(3).max(255),
  title: z.string().min(3).max(255),
  summary: z.string().max(500).nullable().optional(),
  body: z.string().min(20).max(20_000),
  issueDate: z.string().nullable().optional(),
  status: companyDocumentStatusSchema.default("DRAFT"),
});

export const companyDocumentFilterSchema = z.object({
  companyId: z.string().optional(),
  category: companyDocumentCategorySchema.optional(),
  status: companyDocumentStatusSchema.optional(),
  search: z.string().optional(),
});

export const safetyCertificateSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  employeeId: z.string(),
  trainingAssignmentId: z.string().nullable().optional(),
  documentId: z.string().nullable().optional(),
  certificateNumber: z.string(),
  issueDate: z.string(),
  expiryDate: z.string(),
  issuerName: z.string(),
  status: safetyCertificateStatusSchema,
  fileName: z.string().nullable(),
  fileUrl: z.string().nullable(),
});

export const createSafetyCertificateSchema = z.object({
  companyId: z.string().optional(),
  employeeId: z.string(),
  certificateNumber: z.string().min(3),
  issueDate: z.string(),
  expiryDate: z.string(),
  issuerName: z.string().min(2),
  status: safetyCertificateStatusSchema.default("ACTIVE"),
  fileName: z.string().max(255).nullable().optional(),
  fileUrl: z.string().url().max(2000).nullable().optional(),
});

export const safetyCertificateFilterSchema = z.object({
  companyId: z.string().optional(),
  employeeId: z.string().optional(),
  status: safetyCertificateStatusSchema.optional(),
  search: z.string().optional(),
});

export const safetyCardTypeSchema = z.enum(["BIOT", "PTM", "PB", "PS"]);
export const biotDocumentKindSchema = z.enum(["WORKER_CARD", "ITR_CERTIFICATE"]);
export const cardRequestModeSchema = z.enum(["EMPLOYEE", "REQUEST"]);
const cardPhotoDataUrlSchema = z
  .string()
  .regex(/^data:image\/(png|jpeg|jpg);base64,[A-Za-z0-9+/=]+$/i, {
    message: "Фото должно быть в формате JPG или PNG.",
  })
  .max(6_000_000, "Фото слишком большое.");

export const generateBiotCardSchema = z.object({
  companyId: z.string().optional(),
  certificateType: safetyCardTypeSchema.default("BIOT"),
  biotDocumentKind: biotDocumentKindSchema.default("WORKER_CARD"),
  employeeId: z.string().min(1).optional(),
  trainingAssignmentId: z.string().nullable().optional(),
  seriesNumber: z.string().min(1).max(50),
  certificateNumber: z.string().min(3).max(100),
  issueDate: z.string(),
  fullName: z.string().min(3).max(255).optional(),
  issuedTo: z.string().min(3).max(255).optional(),
  positionRu: z.string().max(255).optional(),
  positionKz: z.string().max(255).optional(),
  workplaceRu: z.string().max(255).optional(),
  workplaceKz: z.string().max(255).optional(),
  trainingSubject: z.string().max(255).optional(),
  protocolNumber: z.string().max(255).optional(),
  photoDataUrl: cardPhotoDataUrlSchema.optional(),
  photoFileName: z.string().max(255).optional(),
});

export const biotCardDefaultsQuerySchema = z.object({
  companyId: z.string().optional(),
  certificateType: safetyCardTypeSchema.default("BIOT"),
  biotDocumentKind: biotDocumentKindSchema.default("WORKER_CARD"),
  issueDate: z.string(),
});

export const biotCardDefaultsSchema = z.object({
  certificateType: safetyCardTypeSchema,
  biotDocumentKind: biotDocumentKindSchema,
  defaultTrainingSubject: z.string(),
  trainingSubjectPresets: z.array(z.string()),
  nextCertificateNumber: z.string(),
  nextProtocolNumber: z.string(),
  nextCertificateSequence: z.number().int().min(1),
  nextProtocolSequence: z.number().int().min(1),
  nextWitnessCertificateNumber: z.string().optional(),
  nextWitnessRegistrationNumber: z.string().optional(),
  nextWitnessCertificateSequence: z.number().int().min(1).optional(),
  nextWitnessRegistrationSequence: z.number().int().min(1).optional(),
});

export const generateBiotCardBatchItemSchema = z.object({
  employeeId: z.string().min(1).optional(),
  trainingAssignmentId: z.string().nullable().optional(),
  fullName: z.string().min(3).max(255).optional(),
  fullNameKz: z.string().min(3).max(255).optional(),
  issuedTo: z.string().min(3).max(255).optional(),
  positionRu: z.string().max(255).optional(),
  positionKz: z.string().max(255).optional(),
  workplaceRu: z.string().max(255).optional(),
  workplaceKz: z.string().max(255).optional(),
  photoDataUrl: cardPhotoDataUrlSchema.optional(),
  photoFileName: z.string().max(255).optional(),
  certificateNumber: z.string().min(3).max(100),
  witnessCertificateNumber: z.string().min(3).max(100).optional(),
  witnessRegistrationNumber: z.string().min(1).max(100).optional(),
  protocolNumber: z.string().max(255).optional().default(""),
});

export const generateBiotCardBatchSchema = z.object({
  companyId: z.string().optional(),
  certificateType: safetyCardTypeSchema.default("BIOT"),
  biotDocumentKind: biotDocumentKindSchema.default("WORKER_CARD"),
  requestMode: cardRequestModeSchema.default("REQUEST"),
  includeCard: z.boolean().optional(),
  includeProtocol: z.boolean().optional(),
  includeWitness: z.boolean().optional(),
  requestCompanyRu: z.string().max(255).optional(),
  requestCompanyKz: z.string().max(255).optional(),
  issueDate: z.string(),
  seriesNumber: z.string().min(1).max(50),
  trainingSubject: z.string().min(2).max(255),
  items: z.array(generateBiotCardBatchItemSchema).min(1).max(100),
});

export const cardGenerationRequestQuerySchema = z.object({
  companyId: z.string().optional(),
});

export const cardGenerationRequestItemSummarySchema = z.object({
  id: z.string(),
  fullName: z.string(),
  fullNameKz: z.string().nullable().optional(),
  issuedTo: z.string().nullable().optional(),
  positionRu: z.string().nullable(),
  positionKz: z.string().nullable(),
  workplaceRu: z.string().nullable(),
  workplaceKz: z.string().nullable(),
  certificateNumber: z.string(),
  protocolNumber: z.string(),
  witnessCertificateNumber: z.string().nullable().optional(),
  witnessRegistrationNumber: z.string().nullable().optional(),
});

export const cardGenerationRequestItemDetailSchema = cardGenerationRequestItemSummarySchema.extend({
  employeeId: z.string().nullable(),
  trainingAssignmentId: z.string().nullable(),
  issuedTo: z.string().nullable(),
  photoDataUrl: cardPhotoDataUrlSchema.nullable(),
  photoFileName: z.string().nullable(),
});

export const cardGenerationRequestSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  certificateType: safetyCardTypeSchema,
  biotDocumentKind: biotDocumentKindSchema,
  includeCard: z.boolean(),
  includeProtocol: z.boolean(),
  includeWitness: z.boolean(),
  requestMode: cardRequestModeSchema,
  issueDate: z.string(),
  trainingSubject: z.string(),
  requestCompanyRu: z.string().nullable(),
  requestCompanyKz: z.string().nullable(),
  itemsCount: z.number().int().min(0),
  createdAt: z.string(),
  createdByUserName: z.string(),
  firstCertificateNumber: z.string().nullable(),
  lastCertificateNumber: z.string().nullable(),
  firstProtocolNumber: z.string().nullable(),
  lastProtocolNumber: z.string().nullable(),
  firstWitnessCertificateNumber: z.string().nullable().optional(),
  lastWitnessCertificateNumber: z.string().nullable().optional(),
  firstWitnessRegistrationNumber: z.string().nullable().optional(),
  lastWitnessRegistrationNumber: z.string().nullable().optional(),
  protocolExportAvailable: z.boolean(),
  witnessExportAvailable: z.boolean(),
  items: z.array(cardGenerationRequestItemSummarySchema),
});

export const cardGenerationRequestDetailSchema = cardGenerationRequestSummarySchema.extend({
  companyId: z.string(),
  seriesNumber: z.string(),
  items: z.array(cardGenerationRequestItemDetailSchema),
});

export const updateCardGenerationRequestSchema = generateBiotCardBatchSchema;

export type DocumentType = z.infer<typeof documentTypeSchema>;
export type DocumentStatus = z.infer<typeof documentStatusSchema>;
export type CompanyDocumentCategory = z.infer<typeof companyDocumentCategorySchema>;
export type CompanyDocumentStatus = z.infer<typeof companyDocumentStatusSchema>;
export type SafetyCertificateStatus = z.infer<typeof safetyCertificateStatusSchema>;
export type SafetyCardType = z.infer<typeof safetyCardTypeSchema>;
export type BiotDocumentKind = z.infer<typeof biotDocumentKindSchema>;
export type CardRequestMode = z.infer<typeof cardRequestModeSchema>;
export type EmployeeDocument = z.infer<typeof employeeDocumentSchema>;
export type EmployeeDocumentAllowedActions = z.infer<
  typeof employeeDocumentAllowedActionsSchema
>;
export type EmployeeDocumentSignatureSummary = z.infer<
  typeof employeeDocumentSignatureSummarySchema
>;
export type EmployeeDocumentArchiveSummary = z.infer<
  typeof employeeDocumentArchiveSummarySchema
>;
export type EmployeeDocumentSigningContract = z.infer<
  typeof employeeDocumentSigningContractSchema
>;
export type CreateEmployeeDocumentInput = z.infer<typeof createEmployeeDocumentSchema>;
export type EmployeeDocumentFilters = z.infer<typeof employeeDocumentFilterSchema>;
export type VerifyEmployeeDocumentInput = z.infer<
  typeof verifyEmployeeDocumentSchema
>;
export type PrepareEmployeeDocumentForSigningInput = z.infer<
  typeof prepareEmployeeDocumentForSigningSchema
>;
export type SignEmployeeDocumentInput = z.infer<typeof signEmployeeDocumentSchema>;
export type EmployeeDocumentSignRequest = z.infer<typeof employeeDocumentSignRequestSchema>;
export type AnnulEmployeeDocumentInput = z.infer<typeof annulEmployeeDocumentSchema>;
export type ReplaceEmployeeDocumentInput = z.infer<typeof replaceEmployeeDocumentSchema>;
export type EmployeeDocumentReplaceRequest = z.infer<typeof employeeDocumentReplaceRequestSchema>;
export type PrepareEmployeeDocumentForSigningResponse = z.infer<
  typeof prepareEmployeeDocumentForSigningResponseSchema
>;
export type CompanyDocument = z.infer<typeof companyDocumentSchema>;
export type CreateCompanyDocumentInput = z.infer<typeof createCompanyDocumentSchema>;
export type CompanyDocumentFilters = z.infer<typeof companyDocumentFilterSchema>;
export type SafetyCertificate = z.infer<typeof safetyCertificateSchema>;
export type CreateSafetyCertificateInput = z.infer<typeof createSafetyCertificateSchema>;
export type SafetyCertificateFilters = z.infer<typeof safetyCertificateFilterSchema>;
export type GenerateBiotCardInput = z.infer<typeof generateBiotCardSchema>;
export type BiotCardDefaultsQuery = z.infer<typeof biotCardDefaultsQuerySchema>;
export type BiotCardDefaults = z.infer<typeof biotCardDefaultsSchema>;
export type GenerateBiotCardBatchItem = z.infer<typeof generateBiotCardBatchItemSchema>;
export type GenerateBiotCardBatchInput = z.infer<typeof generateBiotCardBatchSchema>;
export type CardGenerationRequestQuery = z.infer<typeof cardGenerationRequestQuerySchema>;
export type CardGenerationRequestItemSummary = z.infer<
  typeof cardGenerationRequestItemSummarySchema
>;
export type CardGenerationRequestItemDetail = z.infer<
  typeof cardGenerationRequestItemDetailSchema
>;
export type CardGenerationRequestSummary = z.infer<
  typeof cardGenerationRequestSummarySchema
>;
export type CardGenerationRequestDetail = z.infer<typeof cardGenerationRequestDetailSchema>;
export type UpdateCardGenerationRequestInput = z.infer<typeof updateCardGenerationRequestSchema>;
