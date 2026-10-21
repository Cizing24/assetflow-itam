import type { AssetStatus, Role } from "@assetflow/shared";
import {
  BUSINESS_TIME_ZONE,
  dateOnlyToDb,
  isDateOnly,
} from "@assetflow/shared";
export interface Lookup {
  id: string;
  name: string;
}
export interface Lookups {
  categories: Lookup[];
  departments: Lookup[];
}
export interface Employee {
  id: string;
  employeeNumber: string;
  name: string;
  email: string;
  title: string | null;
  status: "ACTIVE" | "OFFBOARDING" | "INACTIVE";
  departmentId: string;
  department: Lookup;
  joinedAt: string;
  leftAt: string | null;
  createdAt: string;
  assignments?: Assignment[];
  offboardings?: Offboarding[];
  _count?: { assignments: number };
}
export interface Asset {
  id: string;
  assetTag: string;
  name: string;
  categoryId: string;
  category: Lookup;
  brand: string;
  model: string;
  serialNumber: string | null;
  purchasedAt: string;
  purchasePrice: string | null;
  warrantyUntil: string | null;
  location: string;
  status: AssetStatus;
  createdAt: string;
  assignments: Assignment[];
  maintenance?: Maintenance[];
}
export interface Assignment {
  id: string;
  assetId: string;
  asset: Asset;
  employeeId: string;
  employee: Employee;
  checkoutBy: Lookup;
  checkedOutAt: string;
  expectedReturnAt: string | null;
  checkoutNotes: string | null;
  returnedAt: string | null;
  condition: string | null;
  checkinBy: Lookup | null;
  checkinNotes: string | null;
}
export interface Maintenance {
  id: string;
  asset: Asset;
  description: string;
  progress: string;
  startedAt: string;
  completedAt: string | null;
  outcome: AssetStatus | null;
  notes: string | null;
  operator: Lookup;
}
export interface Offboarding {
  id: string;
  employee: Employee;
  plannedLeaveAt: string;
  startedAt: string;
  completedAt: string | null;
  notes: string | null;
  operator: Lookup;
  completedBy: Lookup | null;
}
export interface AuditLog {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  actor: Lookup;
  createdAt: string;
  changes: Record<string, unknown>;
  result: string;
}
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
}
export interface DashboardData {
  total: number;
  counts: Record<AssetStatus, number>;
  utilization: number;
  overdueCount: number;
  pendingReturns: Assignment[];
  recentActivity: AuditLog[];
  offboardingCount: number;
}
export const dateLabel = (v?: string | null) =>
  v
    ? new Intl.DateTimeFormat("zh-TW", {
        dateStyle: "medium",
        timeZone: isDateOnly(v) ? "UTC" : BUSINESS_TIME_ZONE,
      }).format(isDateOnly(v) ? dateOnlyToDb(v) : new Date(v))
    : "—";
export const dateTimeLabel = (v: string) =>
  new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: BUSINESS_TIME_ZONE,
  }).format(new Date(v));
// Only DATE fields belong in date inputs. Timestamps must be formatted separately.
export const dateInput = (v?: string | null) => (v && isDateOnly(v) ? v : "");
export const employmentLabels = {
  ACTIVE: "在職",
  OFFBOARDING: "交接中",
  INACTIVE: "已離職",
};
export const actionLabels: Record<string, string> = {
  LOGIN: "登入系統",
  LOGOUT: "登出系統",
  ASSET_CREATED: "新增資產",
  ASSET_UPDATED: "更新資產",
  ASSET_RETIRED: "設備除役",
  EMPLOYEE_CREATED: "建立員工",
  EMPLOYEE_UPDATED: "更新員工",
  CHECKOUT: "設備領用",
  CHECKIN: "設備歸還",
  MAINTENANCE_STARTED: "設備送修",
  MAINTENANCE_UPDATED: "更新維修",
  MAINTENANCE_COMPLETED: "維修結案",
  OFFBOARDING_STARTED: "啟動交接",
  OFFBOARDING_COMPLETED: "完成交接",
  USER_CREATED: "建立帳號",
  USER_UPDATED: "更新帳號",
};
