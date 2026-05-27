import { z } from "zod";
import { admissionCheckResultSchema } from "./core-admission";

const isoStringSchema = z.string().min(1);

export const complianceDocumentTypeCategorySchema = z.enum([
  "DOCUMENT",
  "TRAINING",
  "INSTRUCTION",
]);

export const employeeDocumentVerificationStatusSchema = z.enum([
  "PENDING",
  "VERIFIED",
  "REJECTED",
]);

export const complianceDocumentTypeSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  code: z.string(),
  name: z.string(),
  category: complianceDocumentTypeCategorySchema,
  description: z.string().nullable().optional(),
  defaultValidityDays: z.number().int().positive().nullable().optional(),
  requiresExpiry: z.boolean(),
  requiresVerification: z.boolean(),
  isActive: z.boolean(),
  createdAt: isoStringSchema,
  updatedAt: isoStringSchema,
});

export const createComplianceDocumentTypeSchema = z.object({
  organizationId: z.string().optional(),
  code: z.string().min(2).max(64),
  name: z.string().min(2).max(255),
  category: complianceDocumentTypeCategorySchema,
  description: z.string().max(1000).nullable().optional(),
  defaultValidityDays: z.number().int().positive().nullable().optional(),
  requiresExpiry: z.boolean().default(true),
  requiresVerification: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export const matrixRequirementItemSchema = z.object({
  documentTypeId: z.string().min(1),
  notes: z.string().max(500).nullable().optional(),
});

export const positionComplianceMatrixPayloadSchema = z.object({
  requiredDocuments: z.array(matrixRequirementItemSchema).default([]),
  requiredTrainings: z.array(matrixRequirementItemSchema).default([]),
  requiredInstructions: z.array(matrixRequirementItemSchema).default([]),
  notes: z.string().max(2000).nullable().optional(),
});

export const employeeAdmissionStatusSummarySchema = z.enum([
  "admitted",
  "limited",
  "blocked",
]);

export const employeeAdmissionSummarySchema = z.object({
  status: employeeAdmissionStatusSummarySchema,
  decisionCode: z.string(),
  checkedAt: isoStringSchema,
  matrixId: z.string().nullable().optional(),
  matrixVersionId: z.string().nullable().optional(),
  protocolBasisCount: z.number().int().nonnegative(),
  activeProtocolBasisCount: z.number().int().nonnegative(),
  requiredItemCount: z.number().int().nonnegative(),
  satisfiedItemCount: z.number().int().nonnegative(),
  missingItemCount: z.number().int().nonnegative(),
  expiringItemCount: z.number().int().nonnegative(),
  checks: z.array(admissionCheckResultSchema),
  warnings: z.array(admissionCheckResultSchema),
  nextActions: z.array(z.string()).default([]),
});

export type ComplianceDocumentTypeCategory = z.infer<
  typeof complianceDocumentTypeCategorySchema
>;
export type EmployeeDocumentVerificationStatus = z.infer<
  typeof employeeDocumentVerificationStatusSchema
>;
export type ComplianceDocumentType = z.infer<typeof complianceDocumentTypeSchema>;
export type CreateComplianceDocumentTypeInput = z.infer<
  typeof createComplianceDocumentTypeSchema
>;
export type MatrixRequirementItem = z.infer<typeof matrixRequirementItemSchema>;
export type PositionComplianceMatrixPayload = z.infer<
  typeof positionComplianceMatrixPayloadSchema
>;
export type EmployeeAdmissionStatusSummary = z.infer<
  typeof employeeAdmissionStatusSummarySchema
>;
export type EmployeeAdmissionSummary = z.infer<
  typeof employeeAdmissionSummarySchema
>;
