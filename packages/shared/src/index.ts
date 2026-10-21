export * from "./dates.js";
export const roles = ["ADMIN", "IT_STAFF", "VIEWER"] as const;
export type Role = (typeof roles)[number];
export const statuses = [
  "AVAILABLE",
  "ASSIGNED",
  "MAINTENANCE",
  "RETIRED",
] as const;
export type AssetStatus = (typeof statuses)[number];
export const statusLabels: Record<AssetStatus, string> = {
  AVAILABLE: "可借出",
  ASSIGNED: "已領用",
  MAINTENANCE: "維修中",
  RETIRED: "已除役",
};
export const roleLabels: Record<Role, string> = {
  ADMIN: "系統管理員",
  IT_STAFF: "IT 管理人員",
  VIEWER: "檢視者",
};
export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}
export interface ApiErrorBody {
  error: { code: string; message: string; requestId: string };
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
