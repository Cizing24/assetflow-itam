import { dateOnlyFromDb } from "@assetflow/shared";

const dateOnlyFields = new Set([
  "joinedAt",
  "leftAt",
  "purchasedAt",
  "warrantyUntil",
  "expectedReturnAt",
  "plannedLeaveAt",
]);

// Apply at the HTTP boundary, including nested detail/list responses. Keep JSON
// audit snapshots and non-plain objects (e.g. Prisma Decimal) intact.
export function serializeDates(value: unknown, field = ""): unknown {
  if (value instanceof Date)
    return dateOnlyFields.has(field)
      ? dateOnlyFromDb(value)
      : value.toISOString();
  if (Array.isArray(value)) return value.map((item) => serializeDates(item));
  if (
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  )
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        serializeDates(item, key),
      ]),
    );
  return value;
}
