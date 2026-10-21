import { z } from "zod";
import { roles, statuses } from "@assetflow/shared";
export const idSchema = z.object({ id: z.uuid() });
export const text = z.string().trim().min(1).max(200);
export const notes = z.string().trim().max(2000).optional();
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "日期無效");
export const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(100).default(""),
  sort: z
    .enum(["createdAt", "name", "assetTag", "employeeNumber"])
    .default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  status: z.string().optional(),
  categoryId: z.uuid().optional(),
  departmentId: z.uuid().optional(),
  active: z.enum(["true", "false"]).optional(),
  targetId: z.uuid().optional(),
  targetType: z
    .enum([
      "Asset",
      "Employee",
      "AssetAssignment",
      "MaintenanceRecord",
      "Offboarding",
      "User",
      "Session",
    ])
    .optional(),
});
export const assetSchema = z.strictObject({
  assetTag: text.max(50).transform((v) => v.toUpperCase()),
  name: text,
  categoryId: z.uuid(),
  brand: text,
  model: text,
  serialNumber: z
    .string()
    .trim()
    .max(100)
    .nullable()
    .optional()
    .transform((v) => (v ? v.toUpperCase() : null)),
  purchasedAt: date,
  purchasePrice: z.number().min(0).max(9999999999.99).nullable().optional(),
  warrantyUntil: date.nullable().optional(),
  location: text,
});
export const employeeSchema = z.strictObject({
  employeeNumber: text.max(50).transform((v) => v.toUpperCase()),
  name: text,
  departmentId: z.uuid(),
  title: z.string().trim().max(100).optional(),
  email: z
    .email()
    .max(200)
    .transform((v) => v.toLowerCase()),
  joinedAt: date,
});
export const checkoutSchema = z.strictObject({
  assetId: z.uuid(),
  employeeId: z.uuid(),
  expectedReturnAt: date.optional(),
  notes,
});
export const checkinSchema = z
  .strictObject({
    condition: z.enum(["GOOD", "DAMAGED"]),
    notes,
    description: z.string().trim().max(2000).optional(),
  })
  .refine(
    (v) => v.condition !== "DAMAGED" || !!v.description?.trim(),
    "故障歸還必須填寫故障描述",
  );
export const maintenanceSchema = z.strictObject({
  assetId: z.uuid(),
  description: z.string().trim().min(3).max(2000),
  notes,
});
export const maintenanceUpdateSchema = z.strictObject({
  progress: text,
  notes,
});
export const completeMaintenanceSchema = z.strictObject({
  outcome: z.enum(["AVAILABLE", "RETIRED"]),
  notes,
});
export const offboardingSchema = z.strictObject({
  employeeId: z.uuid(),
  plannedLeaveAt: date,
  notes,
});
export const userSchema = z.strictObject({
  email: z
    .email()
    .max(200)
    .transform((v) => v.toLowerCase()),
  name: text,
  role: z.enum(roles),
  password: z.string().min(12).max(128),
});
export const userUpdateSchema = z.strictObject({
  role: z.enum(roles),
  active: z.boolean(),
});
export const loginSchema = z.strictObject({
  email: z
    .email()
    .max(200)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(128),
});
export const assetStatus = z.enum(statuses);
export type ListInput = z.infer<typeof listSchema>;
