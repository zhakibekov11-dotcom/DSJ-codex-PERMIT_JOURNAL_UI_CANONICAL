import { z } from "zod";

const isoStringSchema = z.string().min(1);

export const scopeTypeSchema = z.enum([
  "ORGANIZATION",
  "BRANCH",
  "DEPARTMENT",
  "WORK_SITE",
]);

export const principalTypeSchema = z.enum([
  "USER",
  "ROLE",
  "CONTRACTOR_ORGANIZATION",
  "CONTRACTOR_WORKER",
]);

export const accessLevelSchema = z.enum([
  "READ",
  "WRITE",
  "APPROVE",
  "SIGN",
  "ARCHIVE",
]);

export const organizationSchema = z.object({
  id: z.string(),
  legacyCompanyId: z.string().nullable().optional(),
  code: z.string(),
  name: z.string(),
  bin: z.string().nullable().optional(),
  timezone: z.string(),
  isActive: z.boolean(),
  createdAt: isoStringSchema,
  updatedAt: isoStringSchema,
});

export const branchSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  code: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  createdAt: isoStringSchema,
  updatedAt: isoStringSchema,
});

export const workSiteSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  branchId: z.string().nullable().optional(),
  code: z.string(),
  name: z.string(),
  location: z.string().nullable().optional(),
  isActive: z.boolean(),
  createdAt: isoStringSchema,
  updatedAt: isoStringSchema,
});

export const positionSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  branchId: z.string().nullable().optional(),
  code: z.string(),
  name: z.string(),
  grade: z.string().nullable().optional(),
  isActive: z.boolean(),
  createdAt: isoStringSchema,
  updatedAt: isoStringSchema,
});

export const scopeRefSchema = z.object({
  organizationId: z.string(),
  branchId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  workSiteId: z.string().nullable().optional(),
});

export const scopeGrantSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  principalType: principalTypeSchema,
  principalId: z.string(),
  scopeType: scopeTypeSchema,
  branchId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  workSiteId: z.string().nullable().optional(),
  accessLevel: accessLevelSchema,
  businessProcessType: z.string().nullable().optional(),
  startsAt: isoStringSchema,
  endsAt: z.string().nullable().optional(),
  createdAt: isoStringSchema,
  updatedAt: isoStringSchema,
});

export const createOrganizationSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(2).max(64),
  name: z.string().min(2).max(255),
  bin: z.string().max(64).nullable().optional(),
  timezone: z.string().default("Asia/Almaty"),
  isActive: z.boolean().default(true),
});

export const createBranchSchema = z.object({
  organizationId: z.string().optional(),
  code: z.string().min(2).max(64),
  name: z.string().min(2).max(255),
  isActive: z.boolean().default(true),
});

export const createWorkSiteSchema = z.object({
  organizationId: z.string().optional(),
  branchId: z.string().nullable().optional(),
  code: z.string().min(2).max(64),
  name: z.string().min(2).max(255),
  location: z.string().max(255).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const createPositionSchema = z.object({
  organizationId: z.string().optional(),
  branchId: z.string().nullable().optional(),
  code: z.string().min(2).max(64),
  name: z.string().min(2).max(255),
  grade: z.string().max(64).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const createScopeGrantSchema = z.object({
  organizationId: z.string().optional(),
  principalType: principalTypeSchema,
  principalId: z.string().min(1),
  scopeType: scopeTypeSchema,
  branchId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  workSiteId: z.string().nullable().optional(),
  accessLevel: accessLevelSchema,
  businessProcessType: z.string().nullable().optional(),
  startsAt: isoStringSchema,
  endsAt: z.string().nullable().optional(),
});

export type ScopeType = z.infer<typeof scopeTypeSchema>;
export type PrincipalType = z.infer<typeof principalTypeSchema>;
export type AccessLevel = z.infer<typeof accessLevelSchema>;
export type Organization = z.infer<typeof organizationSchema>;
export type Branch = z.infer<typeof branchSchema>;
export type WorkSite = z.infer<typeof workSiteSchema>;
export type Position = z.infer<typeof positionSchema>;
export type ScopeRef = z.infer<typeof scopeRefSchema>;
export type ScopeGrant = z.infer<typeof scopeGrantSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type CreateWorkSiteInput = z.infer<typeof createWorkSiteSchema>;
export type CreatePositionInput = z.infer<typeof createPositionSchema>;
export type CreateScopeGrantInput = z.infer<typeof createScopeGrantSchema>;
