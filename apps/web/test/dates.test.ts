import { afterEach, describe, expect, it, vi } from "vitest";
import {
  businessToday,
  dateOnlyFromDb,
  dateOnlyToDb,
  isDateOnly,
} from "@assetflow/shared";
import { dateInput, dateLabel, dateTimeLabel } from "../src/types";
import { assetInitial, employeeInitial } from "../src/composables/forms";

afterEach(() => vi.useRealTimers());

describe("Asia/Taipei date-only 與 timestamp", () => {
  it.each([
    ["2026-10-20T15:59:59.999Z", "2026-10-20"],
    ["2026-10-20T16:00:00.000Z", "2026-10-21"],
    ["2026-10-20T23:59:59.999Z", "2026-10-21"],
    ["2026-10-21T00:00:00.000Z", "2026-10-21"],
    ["2026-12-31T16:00:00.000Z", "2027-01-01"],
    ["2028-02-28T16:00:00.000Z", "2028-02-29"],
  ])("%s 的業務日期為 %s", (instant, expected) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(instant));
    expect(businessToday()).toBe(expected);
  });

  it.each([
    "2026-02-30",
    "2026-13-01",
    "0000-01-01",
    "2026-1-01",
    "2026-10-21T00:00:00Z",
  ])("拒絕無效 date-only：%s", (value) => {
    expect(isDateOnly(value)).toBe(false);
    expect(() => dateOnlyToDb(value)).toThrow(RangeError);
  });

  it("DATE carrier 往返不套用本地時區，日期輸入不接受時間戳", () => {
    for (const value of ["2028-02-29", "2026-01-01", "0099-12-31"]) {
      expect(dateOnlyFromDb(dateOnlyToDb(value))).toBe(value);
      expect(dateInput(value)).toBe(value);
    }
    expect(dateInput(null)).toBe("");
    expect(dateInput("2026-10-20T16:30:00Z")).toBe("");
    expect(dateLabel("2026-10-21")).toContain("21");
    expect(dateLabel("2026-10-20T16:30:00Z")).toBe(dateLabel("2026-10-21"));
    expect(dateTimeLabel("2026-10-20T16:30:00Z")).toBe(
      new Intl.DateTimeFormat("zh-TW", {
        timeZone: "Asia/Taipei",
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date("2026-10-20T16:30:00Z")),
    );
  });

  it("台灣午夜後新增資產與員工預填當地日期", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-20T16:00:00Z"));
    expect(assetInitial().purchasedAt).toBe("2026-10-21");
    expect(employeeInitial().joinedAt).toBe("2026-10-21");
  });
});
