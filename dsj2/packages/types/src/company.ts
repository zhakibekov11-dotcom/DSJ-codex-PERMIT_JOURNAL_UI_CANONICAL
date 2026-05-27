import { z } from "zod";

export const companySchema = z.object({
  id: z.string(),
  name: z.string(),
  bin: z.string().nullable(),
  industry: z.string().nullable(),
  timezone: z.string(),
});

export const createCompanySchema = z.object({
  name: z.string().min(2),
  bin: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  timezone: z.string().default("Asia/Almaty"),
  responsibleFullName: z.string().min(2),
  responsibleEmail: z.string().email(),
  responsiblePassword: z.string().min(8),
});

export const departmentSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string().min(2),
  code: z.string().min(2).max(20).nullable(),
});

export const createDepartmentSchema = z.object({
  companyId: z.string().optional(),
  name: z.string().min(2),
  code: z.string().min(2).max(20).nullable().optional(),
});

export const siteSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string().min(2),
  location: z.string().nullable(),
  isActive: z.boolean(),
});

export type Company = z.infer<typeof companySchema>;
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type Department = z.infer<typeof departmentSchema>;
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type Site = z.infer<typeof siteSchema>;
