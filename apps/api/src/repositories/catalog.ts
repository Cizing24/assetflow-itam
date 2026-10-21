import { Prisma } from "@prisma/client";
import { businessToday, dateOnlyToDb } from "@assetflow/shared";
import { db } from "../db.js";
import { assetStatus, type ListInput } from "../schemas.js";
import { z } from "zod";
const paging = (q: ListInput) => ({
  skip: (q.page - 1) * q.pageSize,
  take: q.pageSize,
});
const page = <T>(q: ListInput, items: T[], total: number) => ({
  items,
  total,
  page: q.page,
  pageSize: q.pageSize,
});
export const actorSelect = { id: true, name: true } as const;
export const assetInclude = {
  category: true,
  assignments: {
    where: { returnedAt: null },
    include: { employee: { include: { department: true } } },
  },
} as const;
export async function assets(q: ListInput) {
  const where: Prisma.AssetWhereInput = {
    ...(q.status ? { status: assetStatus.parse(q.status) } : {}),
    ...(q.categoryId ? { categoryId: q.categoryId } : {}),
    ...(q.search
      ? {
          OR: ["name", "assetTag", "serialNumber", "brand", "model"].map(
            (field) => ({
              [field]: { contains: q.search, mode: "insensitive" },
            }),
          ),
        }
      : {}),
  };
  const sort = ["name", "assetTag", "createdAt"].includes(q.sort)
    ? q.sort
    : "createdAt";
  const [items, total] = await db.$transaction([
    db.asset.findMany({
      where,
      include: assetInclude,
      ...paging(q),
      orderBy: [{ [sort]: q.order }, { id: "asc" }],
    }),
    db.asset.count({ where }),
  ]);
  return page(q, items, total);
}
export async function employees(q: ListInput) {
  const status = q.status
    ? z.enum(["ACTIVE", "OFFBOARDING", "INACTIVE"]).parse(q.status)
    : undefined;
  const where: Prisma.EmployeeWhereInput = {
    status,
    departmentId: q.departmentId,
    ...(q.search
      ? {
          OR: ["name", "employeeNumber", "email"].map((field) => ({
            [field]: { contains: q.search, mode: "insensitive" },
          })),
        }
      : {}),
  };
  const sort = ["name", "employeeNumber", "createdAt"].includes(q.sort)
    ? q.sort
    : "createdAt";
  const [items, total] = await db.$transaction([
    db.employee.findMany({
      where,
      include: {
        department: true,
        _count: { select: { assignments: { where: { returnedAt: null } } } },
      },
      ...paging(q),
      orderBy: [{ [sort]: q.order }, { id: "asc" }],
    }),
    db.employee.count({ where }),
  ]);
  return page(q, items, total);
}
export async function assignments(q: ListInput) {
  const where: Prisma.AssetAssignmentWhereInput = {
    ...(q.active
      ? { returnedAt: q.active === "true" ? null : { not: null } }
      : {}),
    ...(q.search
      ? {
          OR: [
            { asset: { name: { contains: q.search, mode: "insensitive" } } },
            { employee: { name: { contains: q.search, mode: "insensitive" } } },
            {
              asset: { assetTag: { contains: q.search, mode: "insensitive" } },
            },
          ],
        }
      : {}),
  };
  const [items, total] = await db.$transaction([
    db.assetAssignment.findMany({
      where,
      include: {
        asset: true,
        employee: true,
        checkoutBy: { select: actorSelect },
        checkinBy: { select: actorSelect },
      },
      ...paging(q),
      orderBy: [{ checkedOutAt: "desc" }, { id: "asc" }],
    }),
    db.assetAssignment.count({ where }),
  ]);
  return page(q, items, total);
}
export async function maintenance(q: ListInput) {
  const where: Prisma.MaintenanceRecordWhereInput = {
    ...(q.active
      ? { completedAt: q.active === "true" ? null : { not: null } }
      : {}),
    ...(q.search
      ? { asset: { name: { contains: q.search, mode: "insensitive" } } }
      : {}),
  };
  const [items, total] = await db.$transaction([
    db.maintenanceRecord.findMany({
      where,
      include: { asset: true, operator: { select: actorSelect } },
      ...paging(q),
      orderBy: [{ startedAt: "desc" }, { id: "asc" }],
    }),
    db.maintenanceRecord.count({ where }),
  ]);
  return page(q, items, total);
}
export async function offboardings(q: ListInput) {
  const where: Prisma.OffboardingWhereInput = {
    ...(q.active
      ? { completedAt: q.active === "true" ? null : { not: null } }
      : {}),
    ...(q.search
      ? { employee: { name: { contains: q.search, mode: "insensitive" } } }
      : {}),
  };
  const [items, total] = await db.$transaction([
    db.offboarding.findMany({
      where,
      include: {
        employee: {
          include: {
            department: true,
            assignments: {
              where: { returnedAt: null },
              include: { asset: true },
            },
          },
        },
        operator: { select: actorSelect },
        completedBy: { select: actorSelect },
      },
      ...paging(q),
      orderBy: [{ startedAt: "desc" }, { id: "asc" }],
    }),
    db.offboarding.count({ where }),
  ]);
  return page(q, items, total);
}
export async function auditLogs(q: ListInput) {
  const where: Prisma.AuditLogWhereInput = {
    targetId: q.targetId,
    targetType: q.targetType,
    ...(q.search
      ? {
          OR: [
            { action: { contains: q.search, mode: "insensitive" } },
            { actor: { name: { contains: q.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [items, total] = await db.$transaction([
    db.auditLog.findMany({
      where,
      include: { actor: { select: actorSelect } },
      ...paging(q),
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    }),
    db.auditLog.count({ where }),
  ]);
  return page(q, items, total);
}
export function dashboard() {
  const today = dateOnlyToDb(businessToday());
  return db.$transaction(
    async (tx) => {
      const groups = await tx.asset.groupBy({ by: ["status"], _count: true });
      const counts = { AVAILABLE: 0, ASSIGNED: 0, MAINTENANCE: 0, RETIRED: 0 };
      for (const g of groups) counts[g.status] = g._count;
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const activeTotal = total - counts.RETIRED;
      return {
        total,
        counts,
        utilization: activeTotal
          ? Math.round((counts.ASSIGNED / activeTotal) * 100)
          : 0,
        overdueCount: await tx.assetAssignment.count({
          where: {
            returnedAt: null,
            expectedReturnAt: {
              lt: today,
            },
          },
        }),
        pendingReturns: await tx.assetAssignment.findMany({
          where: { returnedAt: null, expectedReturnAt: { not: null } },
          include: { asset: true, employee: true },
          orderBy: { expectedReturnAt: "asc" },
          take: 8,
        }),
        recentActivity: await tx.auditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 8,
          include: { actor: { select: actorSelect } },
        }),
        offboardingCount: await tx.offboarding.count({
          where: { completedAt: null },
        }),
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
