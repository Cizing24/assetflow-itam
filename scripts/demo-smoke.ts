import assert from "node:assert/strict";

const origin = process.env.SMOKE_BASE_URL;
if (!origin || process.env.SMOKE_ALLOW_WRITE !== "synthetic-demo")
  throw new Error(
    "Explicit synthetic-demo smoke authorization and SMOKE_BASE_URL are required.",
  );
const base = new URL(origin);
if (
  base.protocol !== "https:" &&
  !["127.0.0.1", "localhost"].includes(base.hostname)
)
  throw new Error("Remote smoke requires HTTPS.");

async function login(
  alias: string,
  password: string | undefined,
  role: string,
) {
  assert(
    password,
    "Provide the private smoke credentials through environment variables.",
  );
  const response = await fetch(new URL("/api/auth/login", base), {
    method: "POST",
    headers: { Origin: base.origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `${alias}@assetflow.example.test`,
      password,
    }),
  });
  assert.equal(response.status, 200, `Login failed for ${role}`);
  const result = await response.json();
  assert.equal(result.user.role, role);
  const cookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith("__Host-assetflow="));
  assert(
    cookie?.includes("Secure") &&
      cookie.includes("HttpOnly") &&
      cookie.includes("SameSite=Strict"),
  );
  return {
    Cookie: cookie.split(";")[0]!,
    Origin: base.origin,
    "Content-Type": "application/json",
    "X-CSRF-Token": result.csrfToken,
  };
}

const viewer = await login(
  "viewer",
  process.env.DEMO_VIEWER_PASSWORD,
  "VIEWER",
);
const it = await login("it", process.env.DEMO_IT_PASSWORD, "IT_STAFF");
const denied = await fetch(new URL("/api/assignments", base), {
  method: "POST",
  headers: viewer,
  body: "{}",
});
assert.equal(denied.status, 403);
const usersDenied = await fetch(new URL("/api/users", base), { headers: it });
assert.equal(usersDenied.status, 403);
const csrfDenied = await fetch(new URL("/api/assignments", base), {
  method: "POST",
  headers: { ...it, "X-CSRF-Token": "wrong" },
  body: "{}",
});
assert.equal(csrfDenied.status, 403);
const originDenied = await fetch(new URL("/api/assignments", base), {
  method: "POST",
  headers: { ...it, Origin: "https://other.example.test" },
  body: "{}",
});
assert.equal(originDenied.status, 403);
const assetsResponse = await fetch(
  new URL("/api/assets?status=AVAILABLE", base),
  { headers: it },
);
assert.equal(assetsResponse.status, 200);
const employeesResponse = await fetch(
  new URL("/api/employees?status=ACTIVE", base),
  { headers: it },
);
assert.equal(employeesResponse.status, 200);
const asset = (await assetsResponse.json()).items.find(
  (item: { assetTag: string }) => item.assetTag.startsWith("DEMO-"),
);
const employee = (await employeesResponse.json()).items.find(
  (item: { employeeNumber: string }) => item.employeeNumber.startsWith("DEMO-"),
);
assert(
  asset && employee,
  "Smoke only operates on provisioned synthetic records.",
);
const checkout = await fetch(new URL("/api/assignments", base), {
  method: "POST",
  headers: it,
  body: JSON.stringify({
    assetId: asset.id,
    employeeId: employee.id,
    notes: "Synthetic deployment smoke",
  }),
});
assert.equal(checkout.status, 201);
const assignment = await checkout.json();
const assigned = await fetch(new URL(`/api/assets/${asset.id}`, base), {
  headers: it,
});
assert.equal((await assigned.json()).status, "ASSIGNED");
const checkin = await fetch(
  new URL(`/api/assignments/${assignment.id}/checkin`, base),
  {
    method: "POST",
    headers: it,
    body: JSON.stringify({
      condition: "GOOD",
      notes: "Synthetic smoke returned",
    }),
  },
);
assert.equal(checkin.status, 200);
const available = await fetch(new URL(`/api/assets/${asset.id}`, base), {
  headers: viewer,
});
assert.equal((await available.json()).status, "AVAILABLE");
for (const headers of [viewer, it]) {
  const logout = await fetch(new URL("/api/auth/logout", base), {
    method: "POST",
    headers,
    body: "{}",
  });
  assert.equal(logout.status, 200);
}
console.log(
  "PASS: HTTPS-mode Cookie, VIEWER/IT permissions, Origin/CSRF, checkout/read/checkin/read. Synthetic audit history retained.",
);
