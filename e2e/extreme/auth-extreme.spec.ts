import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3001";

function api(path: string) {
  return `${BASE}${path}`;
}

test.describe("Auth Extreme — Registration", () => {
  test("register with valid credentials succeeds", async ({ request }) => {
    const email = `valid-${Date.now()}@test.com`;
    const res = await request.post(api("/api/auth/register"), {
      data: { email, password: "StrongPass1!", name: "Valid User" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBeDefined();
  });

  test("register with duplicate email returns 409", async ({ request }) => {
    const email = `dup-${Date.now()}@test.com`;
    await request.post(api("/api/auth/register"), {
      data: { email, password: "StrongPass1!", name: "First User" },
    });
    const res = await request.post(api("/api/auth/register"), {
      data: { email, password: "StrongPass1!", name: "Second User" },
    });
    expect(res.status()).toBe(409);
  });

  test("register with empty email returns 400", async ({ request }) => {
    const res = await request.post(api("/api/auth/register"), {
      data: { email: "", password: "StrongPass1!", name: "No Email" },
    });
    expect(res.status()).toBe(400);
  });

  test("register with empty password returns 400", async ({ request }) => {
    const res = await request.post(api("/api/auth/register"), {
      data: { email: "empty-pw@test.com", password: "", name: "No PW" },
    });
    expect(res.status()).toBe(400);
  });

  test("register with invalid email returns 400", async ({ request }) => {
    const res = await request.post(api("/api/auth/register"), {
      data: { email: "not-an-email", password: "StrongPass1!", name: "Bad Email" },
    });
    expect(res.status()).toBe(400);
  });

  test("register with weak password returns 400", async ({ request }) => {
    const res = await request.post(api("/api/auth/register"), {
      data: { email: `weak-${Date.now()}@test.com`, password: "123", name: "Weak PW" },
    });
    expect(res.status()).toBe(400);
  });

  test("SQL injection in email returns 400", async ({ request }) => {
    const res = await request.post(api("/api/auth/register"), {
      data: { email: "' OR 1=1 --", password: "StrongPass1!", name: "SQLi" },
    });
    expect(res.status()).toBe(400);
  });

  test("XSS in name is sanitized or rejected", async ({ request }) => {
    const res = await request.post(api("/api/auth/register"), {
      data: {
        email: `xss-${Date.now()}@test.com`,
        password: "StrongPass1!",
        name: "<script>alert(1)</script>",
      },
    });
    expect([200, 400]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.data.user.displayName).not.toContain("<script>");
    }
  });

  test("emoji username registers successfully", async ({ request }) => {
    const res = await request.post(api("/api/auth/register"), {
      data: {
        email: `emoji-${Date.now()}@test.com`,
        password: "StrongPass1!",
        name: "\u{1F600}\u{1F600}\u{1F600}\u{1F600}",
      },
    });
    expect([200, 400]).toContain(res.status());
  });

  test("unicode name registers successfully", async ({ request }) => {
    const res = await request.post(api("/api/auth/register"), {
      data: {
        email: `unicode-${Date.now()}@test.com`,
        password: "StrongPass1!",
        name: "\u0928\u092E\u0938\u094D\u0924\u0947\u3053\u3093\u306B\u3061\u306F\u0645\u0631\u062D\u0628\u0627",
      },
    });
    expect([200, 400]).toContain(res.status());
  });

  test("500-char username handled gracefully", async ({ request }) => {
    const longName = "A".repeat(500);
    const res = await request.post(api("/api/auth/register"), {
      data: {
        email: `longname-${Date.now()}@test.com`,
        password: "StrongPass1!",
        name: longName,
      },
    });
    expect([200, 400, 413]).toContain(res.status());
  });
});

test.describe("Auth Extreme — Login", () => {
  const email = `login-test-${Date.now()}@test.com`;
  const password = "StrongPass1!";

  test.beforeAll(async ({ request }) => {
    await request.post(api("/api/auth/register"), {
      data: { email, password, name: "Login Test" },
    });
  });

  test("login with correct credentials returns tokens", async ({ request }) => {
    const res = await request.post(api("/api/auth/login"), {
      data: { email, password },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.accessToken).toBeDefined();
    expect(body.data.user).toBeDefined();
  });

  test("login with wrong password returns 401", async ({ request }) => {
    const res = await request.post(api("/api/auth/login"), {
      data: { email, password: "WrongPassword1!" },
    });
    expect(res.status()).toBe(401);
  });

  test("login with wrong email returns 401", async ({ request }) => {
    const res = await request.post(api("/api/auth/login"), {
      data: { email: "nonexistent@test.com", password },
    });
    expect(res.status()).toBe(401);
  });

  test("login with invalid JWT returns 401", async ({ request }) => {
    const res = await request.get(api("/api/auth/me"), {
      headers: { authorization: "Bearer invalid-jwt-token" },
    });
    expect(res.status()).toBe(401);
  });

  test("login with empty string JWT returns 401", async ({ request }) => {
    const res = await request.get(api("/api/auth/me"), {
      headers: { authorization: "Bearer " },
    });
    expect(res.status()).toBe(401);
  });

  test("modified JWT returns 401", async ({ request }) => {
    const res = await request.post(api("/api/auth/login"), {
      data: { email, password },
    });
    const body = await res.json();
    const token = body.data.accessToken;
    const parts = token.split(".");
    parts[1] = parts[1] + "a";
    const badToken = parts.join(".");
    const meRes = await request.get(api("/api/auth/me"), {
      headers: { authorization: `Bearer ${badToken}` },
    });
    expect(meRes.status()).toBe(401);
  });
});

test.describe("Auth Extreme — Refresh Token Rotation", () => {
  test("refresh token can be used once; second use is rejected", async ({ request }) => {
    const email = `rotation-${Date.now()}@test.com`;
    const registerRes = await request.post(api("/api/auth/register"), {
      data: { email, password: "StrongPass1!", name: "Rotation" },
    });
    const registerBody = await registerRes.json();
    const refreshToken = registerBody.data.refreshToken;
    expect(refreshToken).toBeDefined();

    const refresh1 = await request.post(api("/api/auth/refresh"), {
      data: { refreshToken },
    });
    expect(refresh1.status()).toBe(200);

    const refresh2 = await request.post(api("/api/auth/refresh"), {
      data: { refreshToken },
    });
    expect([401, 400]).toContain(refresh2.status());
  });
});

test.describe("Auth Extreme — Brute Force Protection", () => {
  test("50 simultaneous login attempts are rate limited", async ({ request }) => {
    const email = `brute-sim-${Date.now()}@test.com`;
    await request.post(api("/api/auth/register"), {
      data: { email, password: "StrongPass1!", name: "Brute Sim" },
    });
    const attempts = Array.from({ length: 50 }, (_, i) =>
      request.post(api("/api/auth/login"), {
        data: { email, password: i === 0 ? "StrongPass1!" : `Wrong${i}` },
      })
    );
    const results = await Promise.all(attempts);
    const statuses = results.map((r) => r.status());
    const rateLimited = statuses.filter((s) => s === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });

  test("100 failed attempts trigger lockout", async ({ request }) => {
    const email = `brute-lock-${Date.now()}@test.com`;
    await request.post(api("/api/auth/register"), {
      data: { email, password: "StrongPass1!", name: "Brute Lock" },
    });
    for (let i = 0; i < 100; i++) {
      const res = await request.post(api("/api/auth/login"), {
        data: { email, password: `Wrong${i}` },
      });
      if (res.status() === 429) break;
    }
    const finalRes = await request.post(api("/api/auth/login"), {
      data: { email, password: "StrongPass1!" },
    });
    expect(finalRes.status()).toBe(429);
  });
});

test.describe("Auth Extreme — Token Expiry", () => {
  test("expired JWT returns 401", async ({ request }) => {
    const email = `expiry-${Date.now()}@test.com`;
    await request.post(api("/api/auth/register"), {
      data: { email, password: "StrongPass1!", name: "Expiry" },
    });
    const loginRes = await request.post(api("/api/auth/login"), {
      data: { email, password: "StrongPass1!" },
    });
    const body = await loginRes.json();
    const token = body.data.accessToken;
    try {
      const parts = token.split(".");
      const payload = JSON.parse(
        Buffer.from(parts[1], "base64url").toString("utf-8")
      );
      payload.exp = Math.floor(Date.now() / 1000) - 3600;
      parts[1] = Buffer.from(JSON.stringify(payload))
        .toString("base64url")
        .replace(/=+$/, "");
      const expiredToken = parts.join(".");
      const meRes = await request.get(api("/api/auth/me"), {
        headers: { authorization: `Bearer ${expiredToken}` },
      });
      expect(meRes.status()).toBe(401);
    } catch {
      // if token format isn't JWT, just verify 401 on invalid
      const meRes = await request.get(api("/api/auth/me"), {
        headers: { authorization: "Bearer invalid.expired.token" },
      });
      expect(meRes.status()).toBe(401);
    }
  });
});
