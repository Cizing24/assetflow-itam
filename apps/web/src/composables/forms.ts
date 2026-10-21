import type { Field } from '../components/FormDialog.vue';
import type { Lookups, Asset, Employee } from '../types';
import { dateInput } from '../types';
export function assetFields(lookups: Lookups): Field[] { return [
  { key: 'assetTag', label: '資產編號', required: true }, { key: 'name', label: '資產名稱', required: true },
  { key: 'categoryId', label: '分類', type: 'select', required: true, options: lookups.categories.map(c => ({ value: c.id, label: c.name })) },
  { key: 'location', label: '存放位置', required: true }, { key: 'brand', label: '品牌', required: true }, { key: 'model', label: '型號', required: true },
  { key: 'serialNumber', label: '序號', hint: '選填；有值時全系統唯一，不區分大小寫。' }, { key: 'purchasedAt', label: '購買日期', type: 'date', required: true },
  { key: 'purchasePrice', label: '購買價格（NT$）', type: 'number', min: 0, max: 9999999999.99 }, { key: 'warrantyUntil', label: '保固到期日', type: 'date' },
]; }
export function assetInitial(asset?: Asset): Record<string, string> { return asset ? { assetTag: asset.assetTag, name: asset.name, categoryId: asset.categoryId, location: asset.location, brand: asset.brand, model: asset.model, serialNumber: asset.serialNumber ?? '', purchasedAt: dateInput(asset.purchasedAt), purchasePrice: asset.purchasePrice ?? '', warrantyUntil: dateInput(asset.warrantyUntil) } : { purchasedAt: new Date().toISOString().slice(0, 10) }; }
export function assetPayload(v: Record<string, string>) { return { ...v, serialNumber: v.serialNumber || null, purchasePrice: v.purchasePrice ? Number(v.purchasePrice) : null, warrantyUntil: v.warrantyUntil || null }; }
export function employeeFields(lookups: Lookups): Field[] { return [{ key: 'employeeNumber', label: '員工編號', required: true }, { key: 'name', label: '姓名', required: true }, { key: 'departmentId', label: '部門', type: 'select', required: true, options: lookups.departments.map(d => ({ value: d.id, label: d.name })) }, { key: 'title', label: '職稱' }, { key: 'email', label: '電子郵件', type: 'email', required: true }, { key: 'joinedAt', label: '到職日期', type: 'date', required: true }]; }
export function employeeInitial(employee?: Employee): Record<string, string> { return employee ? { employeeNumber: employee.employeeNumber, name: employee.name, departmentId: employee.departmentId, title: employee.title ?? '', email: employee.email, joinedAt: dateInput(employee.joinedAt) } : { joinedAt: new Date().toISOString().slice(0, 10) }; }
export const checkinFields: Field[] = [{ key: 'condition', label: '設備狀況', type: 'select', required: true, options: [{ value: 'GOOD', label: '正常 · 恢復可借出' }, { value: 'DAMAGED', label: '故障 · 自動送修' }] }, { key: 'description', label: '故障描述', type: 'textarea', hint: '選擇故障歸還時必填。' }, { key: 'notes', label: '歸還備註', type: 'textarea' }];
export function checkinPayload(v: Record<string, string>) { if (v.condition === 'DAMAGED' && !v.description?.trim()) throw new Error('故障歸還必須填寫故障描述。'); return v; }
