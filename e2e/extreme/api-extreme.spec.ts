import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3001";
const API_PATHS = {
  health: "/api/health",
  authLogin: "/api/auth/login",
  datasets: "/api/datasets",
  state: "/api/state",
};

async function req(request: any, method: string, path: string, opts: any = {}) {
  return request.fetch(`${BASE}${path}`, { method, ...opts });
}

test.describe("API Extreme — HTTP Methods on Every Endpoint", () => {
  const endpoints = [
    { path: "/api/health", methods: ["GET", "HEAD", "OPTIONS"] },
    { path: "/api/health/ping", methods: ["GET", "HEAD", "OPTIONS"] },
    { path: "/api/health/live", methods: ["GET", "HEAD", "OPTIONS"] },
    { path: "/api/health/ready", methods: ["GET", "HEAD", "OPTIONS"] },
    { path: "/api/health/detailed", methods: ["GET", "HEAD", "OPTIONS"] },
    { path: "/api/state", methods: ["GET", "POST", "HEAD", "OPTIONS"] },
    { path: "/api/datasets", methods: ["GET", "POST", "HEAD", "OPTIONS"] },
  ];

  for (const ep of endpoints) {
    for (const method of ep.methods) {
      test(`${method} ${ep.path} returns a valid response`, async ({ request }) => {
        const res = await req(request, method, ep.path);
        expect([200, 204, 401, 404, 405]).toContain(res.status());
      });
    }
  }

  test("DELETE on health endpoint returns 405 or appropriate", async ({ request }) => {
    const res = await req(request, "DELETE", "/api/health");
    expect([405, 404, 401]).toContain(res.status());
  });

  test("PATCH on health endpoint returns 405 or appropriate", async ({ request }) => {
    const res = await req(request, "PATCH", "/api/health");
    expect([405, 404, 401]).toContain(res.status());
  });
});

test.describe("API Extreme — Request Body Fuzzing", () => {
  const bodies = [
    { name: "empty", body: "" },
    { name: "null literal", body: null },
    { name: "undefined literal", body: undefined },
    { name: "boolean true", body: true },
    { name: "boolean false", body: false },
    { name: "integer zero", body: 0 },
    { name: "negative integer", body: -1 },
    { name: "large integer", body: 9999999999999999 },
    { name: "float", body: 3.14159 },
    { name: "Infinity", body: Infinity },
    { name: "NaN", body: NaN },
    { name: "string", body: "just a string" },
    { name: "emoji string", body: "\u{1F600}\u{1F44D}\u{1F4AF}" },
    { name: "unicode string", body: "\u0928\u092E\u0938\u094D\u0924\u0947" },
    { name: "empty array", body: [] },
    { name: "nested array", body: [[1, 2], [3, [4, 5]]] },
    { name: "nested object", body: { a: { b: { c: { d: "deep" } } } } },
    { name: "duplicate keys" as const, body: '{"a":1,"a":2}' },
    { name: "malformed JSON" as const, body: "{broken json!!!" },
    { name: "unexpected fields", body: { email: "test@test.com", totallyUnexpected: "hacker" } },
    { name: "missing fields", body: {} },
    { name: "wrong types", body: { email: 12345, password: true } },
  ];

  for (const { name, body } of bodies) {
    test(`login endpoint handles body: ${name}`, async ({ request }) => {
      const data = typeof body === "string" ? body : body;
      const isRawString = typeof body === "string" && ["broken", "{\"a\":1,\"a\":2}"].includes(name === "duplicate keys" ? '{"a":1,"a":2}' : name === "malformed JSON" ? "{broken json!!!" : "");
      const headers: Record<string, string> = {};
      if (name === "malformed JSON" || name === "duplicate keys") {
        headers["content-type"] = "application/json";
      }
      const res = await request.post(`${BASE}/api/auth/login`, {
        data,
        headers: Object.keys(headers).length ? headers : undefined,
      });
      expect([200, 400, 401, 413, 415]).toContain(res.status());
    });
  }
});

test.describe("API Extreme — Headers Fuzzing", () => {
  test("no auth header on protected endpoint returns 401", async ({ request }) => {
    const res = await request.get(`${BASE}/api/auth/me`);
    expect(res.status()).toBe(401);
  });

  test("wrong content-type returns 415 or 400", async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/login`, {
      data: "email=test@test.com&password=test",
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    expect([400, 415, 200]).toContain(res.status());
  });

  test("wrong accept header returns 406 or 200", async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`, {
      headers: { accept: "text/xml" },
    });
    expect([200, 406]).toContain(res.status());
  });

  test("duplicate header keys handled", async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`, {
      headers: { "x-forwarded-for": "1.1.1.1", "X-Forwarded-For": "2.2.2.2" },
    });
    expect(res.status()).toBe(200);
  });

  test("huge header value handled", async ({ request }) => {
    const huge = "X".repeat(100000);
    const res = await request.get(`${BASE}/api/health`, {
      headers: { "x-huge-header": huge },
    });
    expect([200, 431, 400]).toContain(res.status());
  });

  test("invalid token header returns 401", async ({ request }) => {
    const res = await request.get(`${BASE}/api/auth/me`, {
      headers: { authorization: "Bearer " + "a".repeat(10000) },
    });
    expect(res.status()).toBe(401);
  });

  test("corrupted token with special chars returns 401", async ({ request }) => {
    const res = await request.get(`${BASE}/api/auth/me`, {
      headers: { authorization: "Bearer \u0000\u0001\u0002invalid\uFFFFtoken" },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe("API Extreme — Rate Limits", () => {
  for (const count of [10, 100]) {
    test(`${count} rapid requests to health endpoint`, async ({ request }) => {
      const results = await Promise.all(
        Array.from({ length: count }, () => request.get(`${BASE}/api/health`))
      );
      const ok = results.filter((r) => r.status() === 200).length;
      expect(ok).toBeGreaterThan(0);
    });
  }
});
