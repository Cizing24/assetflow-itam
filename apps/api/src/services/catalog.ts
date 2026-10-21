import argon2 from 'argon2';
import { z } from 'zod';
import { audit, lockAsset, lockEmployee, transaction } from '../db.js';
import { HttpError } from '../errors.js';
import { assetSchema, employeeSchema, userSchema, userUpdateSchema } from '../schemas.js';
const userSelect = { id: true, name: true, email: true, role: true, active: true, createdAt: true } as const;
export { userSelect };
export function saveAsset(actorId: string, input: z.infer<typeof assetSchema>, id?: string) {
  return transaction(async tx => {
    const before = id ? await lockAsset(tx, id) : null;
    if (input.warrantyUntil && input.warrantyUntil < input.purchasedAt) throw new HttpError(400, 'INVALID_DATE', '保固到期日不可早於購買日期。');
    const data = { ...input, purchasedAt: new Date(input.purchasedAt), warrantyUntil: input.warrantyUntil ? new Date(input.warrantyUntil) : null };
    const asset = id ? await tx.asset.update({ where: { id }, data }) : await tx.asset.create({ data });
    await audit(tx, actorId, id ? 'ASSET_UPDATED' : 'ASSET_CREATED', 'Asset', asset.id, { before: before ? JSON.parse(JSON.stringify(before)) : null, after: JSON.parse(JSON.stringify(asset)) });
    return asset;
  });
}
export function saveEmployee(actorId: string, input: z.infer<typeof employeeSchema>, id?: string) {
  return transaction(async tx => {
    const before = id ? await lockEmployee(tx, id) : null;
    if (before?.leftAt && input.joinedAt > before.leftAt.toISOString().slice(0, 10)) throw new HttpError(400, 'INVALID_DATE', '到職日期不可晚於離職日期。');
    const data = { ...input, joinedAt: new Date(input.joinedAt) };
    const employee = id ? await tx.employee.update({ where: { id }, data }) : await tx.employee.create({ data });
    await audit(tx, actorId, id ? 'EMPLOYEE_UPDATED' : 'EMPLOYEE_CREATED', 'Employee', employee.id, { before: before ? JSON.parse(JSON.stringify(before)) : null, after: JSON.parse(JSON.stringify(employee)) });
    return employee;
  });
}
export async function createUser(actorId: string, input: z.infer<typeof userSchema>) {
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  return transaction(async tx => {
    const user = await tx.user.create({ data: { email: input.email, name: input.name, role: input.role, passwordHash }, select: userSelect });
    await audit(tx, actorId, 'USER_CREATED', 'User', user.id, { email: user.email, role: user.role });
    return user;
  });
}
export function updateUser(actorId: string, id: string, input: z.infer<typeof userUpdateSchema>) {
  return transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(1837201)`;
    const before = await tx.user.findUnique({ where: { id } });
    if (!before) throw new HttpError(404, 'NOT_FOUND', '找不到使用者。');
    if (before.role === 'ADMIN' && before.active && (input.role !== 'ADMIN' || !input.active)) {
      if (await tx.user.count({ where: { role: 'ADMIN', active: true } }) <= 1) throw new HttpError(409, 'LAST_ADMIN', '至少必須保留一位啟用的管理員。');
    }
    const user = await tx.user.update({ where: { id }, data: input, select: userSelect });
    await tx.session.deleteMany({ where: { userId: id } });
    await audit(tx, actorId, 'USER_UPDATED', 'User', id, { before: { role: before.role, active: before.active }, after: input, sessionsRevoked: true });
    return user;
  });
}
