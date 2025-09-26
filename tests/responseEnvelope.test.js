const request = require("supertest");
const app = require("../src/app");

/*
  Regression test: ensure standardized response envelope across representative endpoints.
  We intentionally sample:
   - Auth login (POST) expected success envelope
   - Public materials list (GET) expected success envelope with pagination structure (if present)
   - Admin stats (GET) requires superadmin (auto-create if missing) to assert envelope

  Invariants for every JSON response we check:
    error: boolean
    code: string (UPPER_SNAKE_CASE by convention, but we only assert type + non-empty)
    message: string (non-empty)
    data: optional object/array/primitive accepted (not asserted strictly here)
*/

describe("Standard Response Envelope Regression", () => {
  let superToken;

  // Helper to ensure a superadmin user exists and obtain a token
  const ensureSuperadmin = async () => {
    const email = process.env.SUPERADMIN_EMAIL || "superadmin@bukadita.com";
    const password = process.env.SUPERADMIN_PASSWORD || "Password123!";

    // Try login first
    let loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password });

    if (loginRes.status !== 200) {
      // Attempt registration flow (will create profile fallbacks internally)
      const full_name = "Super Admin";
      await request(app)
        .post("/api/v1/auth/register")
        .send({ email, password, full_name });
      loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({ email, password });
    }

    expect(loginRes.status).toBe(200);
    // Auth login response uses data.access_token (not nested under data.session)
    expect(loginRes.body).toHaveProperty("data.access_token");
    return loginRes.body.data.access_token;
  };

  beforeAll(async () => {
    superToken = await ensureSuperadmin();
  });

  const assertEnvelope = (body) => {
    expect(body).toHaveProperty("error");
    expect(typeof body.error).toBe("boolean");
    expect(body).toHaveProperty("code");
    expect(typeof body.code).toBe("string");
    expect(body.code.length).toBeGreaterThan(0);
    expect(body).toHaveProperty("message");
    expect(typeof body.message).toBe("string");
    expect(body.message.length).toBeGreaterThan(0);
  };

  test("Auth login returns standardized envelope", async () => {
    const email = `regression_login_${Date.now()}@example.com`;
    const password = "Password123!";
    const full_name = "Envelope Tester";

    await request(app)
      .post("/api/v1/auth/register")
      .send({ email, password, full_name });
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password });
    expect(res.status).toBe(200);
    assertEnvelope(res.body);
    expect(res.body.error).toBe(false);
  });

  test("Public materials list returns standardized envelope and pagination keys (if data.pagination present)", async () => {
    const res = await request(app).get("/api/v1/materials/public");
    expect(res.status).toBe(200);
    assertEnvelope(res.body);
    if (res.body.data && res.body.data.pagination) {
      const p = res.body.data.pagination;
      [
        "page",
        "limit",
        "total",
        "totalPages",
        "hasNextPage",
        "hasPrevPage",
      ].forEach((k) => {
        expect(p).toHaveProperty(k);
      });
    }
  });

  test("Admin stats returns standardized envelope", async () => {
    const res = await request(app)
      .get("/api/v1/admin/dashboard/stats")
      .set("Authorization", `Bearer ${superToken}`);
    expect([200, 201]).toContain(res.status);
    assertEnvelope(res.body);
    expect(res.body.error).toBe(false);
  });
});
