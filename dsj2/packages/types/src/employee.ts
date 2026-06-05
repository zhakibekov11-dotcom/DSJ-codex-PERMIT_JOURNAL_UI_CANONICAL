import { z } from "zod";
import { userRoleSchema } from "./auth";

export const employeeStatusSchema = z.enum(["active", "inactive"]);
export const employeeKindSchema = z.enum(["INTERNAL", "CONTRACTOR"]);
const employeePhotoDataUrlSchema = z
  .string()
  .regex(/^data:image\/(png|jpeg|jpg);base64,[A-Za-z0-9+/=]+$/i, {
    message: "Фото должно быть в формате JPG или PNG.",
  })
  .max(6_000_000, "Фото слишком большое.");

export const employeeSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  departmentId: z.string().nullable(),
  siteId: z.string().nullable(),
  positionId: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
  contractorCompanyId: z.string().nullable(),
  fullName: z.string().min(2),
  iin: z.string().min(12).max(12),
  employeeNumber: z.string().min(2),
  jobTitle: z.string().min(2),
  jobTitleKz: z.string().min(2).nullable().optional(),
  photoDataUrl: employeePhotoDataUrlSchema.nullable().optional(),
  photoFileName: z.string().max(255).nullable().optional(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  employeeKind: employeeKindSchema,
  status: employeeStatusSchema,
  hasAccount: z.boolean().optional(),
  accountEmail: z.string().email().nullable().optional(),
  accountRole: userRoleSchema.nullable().optional(),
  hasEmployeeSignerAccount: z.boolean().optional(),
  position: z
    .object({
      id: z.string(),
      code: z.string(),
      name: z.string(),
      grade: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export const createEmployeeSchema = z.object({
  companyId: z.string().optional(),
  departmentId: z.string().nullable().optional(),
  siteId: z.string().nullable().optional(),
  positionId: z.string().nullable().optional(),
  contractorCompanyId: z.string().nullable().optional(),
  fullName: z.string().min(2),
  iin: z.string().min(12).max(12),
  employeeNumber: z.string().min(2),
  jobTitle: z.string().min(2),
  jobTitleKz: z.string().min(2).nullable().optional(),
  photoDataUrl: employeePhotoDataUrlSchema.nullable().optional(),
  photoFileName: z.string().max(255).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  employeeKind: employeeKindSchema.default("INTERNAL"),
  status: employeeStatusSchema.default("active"),
  createAccount: z.boolean().optional(),
  accountPassword: z.string().min(8).max(128).nullable().optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial().extend({
  removePhoto: z.boolean().optional(),
});

export const employeeFilterSchema = z.object({
  companyId: z.string().optional(),
  search: z.string().optional(),
  departmentId: z.string().optional(),
  siteId: z.string().optional(),
  positionId: z.string().optional(),
  contractorCompanyId: z.string().optional(),
  employeeKind: employeeKindSchema.optional(),
  status: employeeStatusSchema.optional(),
});

export const archiveEmployeeSchema = z.object({
  companyId: z.string().optional(),
});

export type Employee = z.infer<typeof employeeSchema>;
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type EmployeeFilters = z.infer<typeof employeeFilterSchema>;
export type EmployeeKind = z.infer<typeof employeeKindSchema>;
export type ArchiveEmployeeInput = z.infer<typeof archiveEmployeeSchema>;
