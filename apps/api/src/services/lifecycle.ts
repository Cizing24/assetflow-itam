import { z } from "zod";
import { businessToday, dateOnlyToDb, dateOnlyFromDb } from "@assetflow/shared";
import { audit, db, lockAsset, lockEmployee, transaction } from "../db.js";
import { HttpError } from "../errors.js";
import {
  checkoutSchema,
  checkinSchema,
  maintenanceSchema,
  maintenanceUpdateSchema,
  completeMaintenanceSchema,
  offboardingSchema,
  completeOffboardingSchema,
} from "../schemas.js";
const conflict = (message: string): never => {
  throw new HttpError(409, "BUSINESS_CONFLICT", message);
};
export function checkout(
  actorId: string,
  input: z.infer<typeof checkoutSchema>,
) {
  return transaction(async (tx) => {
    const employee = await lockEmployee(tx, input.employeeId);
    if (employee.status !== "ACTIVE")
      conflict("只有在職且未進行離職交接的員工可以領用。");
    const asset = await lockAsset(tx, input.assetId);
    if (asset.status !== "AVAILABLE") conflict("只有可借出的設備可以領用。");
    if (input.expectedReturnAt && input.expectedReturnAt < businessToday())
      throw new HttpError(400, "INVALID_DATE", "預計歸還日期不可早於今天。");
    const changed = await tx.asset.updateMany({
      where: { id: asset.id, status: "AVAILABLE" },
      data: { status: "ASSIGNED" },
    });
    if (changed.count !== 1) conflict("設備狀態已改變。");
    const assignment = await tx.assetAssignment.create({
      data: {
        assetId: asset.id,
        employeeId: employee.id,
        checkoutById: actorId,
        expectedReturnAt: input.expectedReturnAt
          ? dateOnlyToDb(input.expectedReturnAt)
          : null,
        checkoutNotes: input.notes,
      },
    });
    await audit(tx, actorId, "CHECKOUT", "Asset", asset.id, {
      assignmentId: assignment.id,
      employeeId: employee.id,
      from: "AVAILABLE",
      to: "ASSIGNED",
    });
    return assignment;
  });
}
export async function checkin(
  actorId: string,
  id: string,
  input: z.infer<typeof checkinSchema>,
) {
  const reference = await db.assetAssignment.findUnique({ where: { id } });
  if (!reference) throw new HttpError(404, "NOT_FOUND", "找不到領用紀錄。");
  return transaction(async (tx) => {
    await lockEmployee(tx, reference.employeeId);
    const asset = await lockAsset(tx, reference.assetId);
    const assignment = await tx.assetAssignment.findUniqueOrThrow({
      where: { id },
    });
    if (assignment.returnedAt) conflict("此筆設備已歸還。");
    if (asset.status !== "ASSIGNED") conflict("設備狀態與領用紀錄不一致。");
    const status = input.condition === "GOOD" ? "AVAILABLE" : "MAINTENANCE";
    const updated = await tx.assetAssignment.update({
      where: { id },
      data: {
        returnedAt: new Date(),
        condition: input.condition,
        checkinById: actorId,
        checkinNotes: input.notes,
      },
    });
    await tx.asset.update({ where: { id: asset.id }, data: { status } });
    if (status === "MAINTENANCE")
      await tx.maintenanceRecord.create({
        data: {
          assetId: asset.id,
          operatorId: actorId,
          description: input.description!,
          notes: input.notes,
        },
      });
    await audit(tx, actorId, "CHECKIN", "Asset", asset.id, {
      assignmentId: id,
      condition: input.condition,
      from: "ASSIGNED",
      to: status,
      notes: input.notes ?? "",
    });
    return updated;
  });
}
export function startMaintenance(
  actorId: string,
  input: z.infer<typeof maintenanceSchema>,
) {
  return transaction(async (tx) => {
    const asset = await lockAsset(tx, input.assetId);
    if (asset.status !== "AVAILABLE")
      conflict("只能將可借出設備送修；領用中設備請先以故障方式歸還。");
    await tx.asset.update({
      where: { id: asset.id },
      data: { status: "MAINTENANCE" },
    });
    const record = await tx.maintenanceRecord.create({
      data: {
        assetId: asset.id,
        operatorId: actorId,
        description: input.description,
        notes: input.notes,
      },
    });
    await audit(tx, actorId, "MAINTENANCE_STARTED", "Asset", asset.id, {
      maintenanceId: record.id,
      description: input.description,
    });
    return record;
  });
}
export async function changeMaintenance(
  actorId: string,
  id: string,
  input:
    | z.infer<typeof maintenanceUpdateSchema>
    | z.infer<typeof completeMaintenanceSchema>,
) {
  const ref = await db.maintenanceRecord.findUnique({ where: { id } });
  if (!ref) throw new HttpError(404, "NOT_FOUND", "找不到維修紀錄。");
  return transaction(async (tx) => {
    await lockAsset(tx, ref.assetId);
    const record = await tx.maintenanceRecord.findUniqueOrThrow({
      where: { id },
    });
    if (record.completedAt) conflict("維修已完成，無法再次修改。");
    if ("outcome" in input) {
      await tx.asset.update({
        where: { id: ref.assetId },
        data: { status: input.outcome },
      });
      const updated = await tx.maintenanceRecord.update({
        where: { id },
        data: {
          completedAt: new Date(),
          outcome: input.outcome,
          progress: "已完成",
          notes: input.notes ?? record.notes,
        },
      });
      await audit(tx, actorId, "MAINTENANCE_COMPLETED", "Asset", ref.assetId, {
        maintenanceId: id,
        outcome: input.outcome,
      });
      return updated;
    }
    const updated = await tx.maintenanceRecord.update({
      where: { id },
      data: input,
    });
    await audit(tx, actorId, "MAINTENANCE_UPDATED", "Asset", ref.assetId, {
      maintenanceId: id,
      progress: input.progress,
      notes: input.notes ?? "",
    });
    return updated;
  });
}
export function retire(actorId: string, id: string, reason: string) {
  return transaction(async (tx) => {
    const asset = await lockAsset(tx, id);
    if (asset.status !== "AVAILABLE")
      conflict("只有可借出設備可以直接除役；維修設備請完成維修並選擇除役。");
    const updated = await tx.asset.update({
      where: { id },
      data: { status: "RETIRED" },
    });
    await audit(tx, actorId, "ASSET_RETIRED", "Asset", id, {
      from: asset.status,
      to: "RETIRED",
      reason,
    });
    return updated;
  });
}
export function startOffboarding(
  actorId: string,
  input: z.infer<typeof offboardingSchema>,
) {
  return transaction(async (tx) => {
    const employee = await lockEmployee(tx, input.employeeId);
    if (employee.status !== "ACTIVE") conflict("此員工已離職或正在交接中。");
    if (input.plannedLeaveAt < dateOnlyFromDb(employee.joinedAt))
      throw new HttpError(400, "INVALID_DATE", "離職日期不可早於到職日期。");
    await tx.employee.update({
      where: { id: employee.id },
      data: { status: "OFFBOARDING" },
    });
    const offboarding = await tx.offboarding.create({
      data: {
        employeeId: employee.id,
        operatorId: actorId,
        plannedLeaveAt: dateOnlyToDb(input.plannedLeaveAt),
        notes: input.notes,
      },
    });
    await audit(tx, actorId, "OFFBOARDING_STARTED", "Employee", employee.id, {
      offboardingId: offboarding.id,
      plannedLeaveAt: input.plannedLeaveAt,
    });
    return offboarding;
  });
}
export async function completeOffboarding(
  actorId: string,
  id: string,
  input: z.infer<typeof completeOffboardingSchema>,
) {
  const ref = await db.offboarding.findUnique({ where: { id } });
  if (!ref) throw new HttpError(404, "NOT_FOUND", "找不到交接紀錄。");
  return transaction(async (tx) => {
    const employee = await lockEmployee(tx, ref.employeeId);
    const record = await tx.offboarding.findUniqueOrThrow({ where: { id } });
    if (record.completedAt) conflict("交接已完成。");
    if (employee.status !== "OFFBOARDING" || employee.leftAt)
      conflict("員工狀態與交接紀錄不一致。");
    const completedAt = new Date();
    if (
      input.leftAt < dateOnlyFromDb(employee.joinedAt) ||
      input.leftAt > businessToday(completedAt)
    )
      throw new HttpError(
        400,
        "INVALID_DATE",
        "實際離職日期須介於到職日期與今天之間。",
      );
    const outstanding = await tx.assetAssignment.count({
      where: { employeeId: ref.employeeId, returnedAt: null },
    });
    if (outstanding)
      conflict(`仍有 ${outstanding} 項設備未歸還，無法完成交接。`);
    await tx.employee.update({
      where: { id: ref.employeeId },
      data: { status: "INACTIVE", leftAt: dateOnlyToDb(input.leftAt) },
    });
    const updated = await tx.offboarding.update({
      where: { id },
      data: { completedAt, completedById: actorId },
    });
    await audit(
      tx,
      actorId,
      "OFFBOARDING_COMPLETED",
      "Employee",
      ref.employeeId,
      {
        offboardingId: id,
        outstanding: 0,
        plannedLeaveAt: dateOnlyFromDb(record.plannedLeaveAt),
        leftAt: input.leftAt,
        completedAt: completedAt.toISOString(),
      },
    );
    return updated;
  });
}
