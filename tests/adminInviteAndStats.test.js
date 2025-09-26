const request = require("supertest");
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const app = require("../src/app");

async function ensureSuperadminLogin() {
  const email = process.env.SUPERADMIN_EMAIL || `superadmin_test@example.com`;
  const password = process.env.SUPERADMIN_PASSWORD || `Password123!`;
  let res = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password });
  if (res.statusCode === 401) {
    const url = process.env.SUPABASE_URL;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !service) {
      throw new Error(
        "Service role env vars required to auto-create superadmin for tests"
      );
    }
    const admin = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: "Test Superadmin" },
        app_metadata: { role: "superadmin" },
      });
    if (createErr && !/already registered/i.test(createErr.message)) {
      throw new Error(
        "Failed to create superadmin fallback: " + createErr.message
      );
    }
    if (created?.user?.id) {
      await admin.from("profiles").upsert(
        {
          id: created.user.id,
          full_name: created.user.user_metadata?.full_name || "Test Superadmin",
          email: created.user.email,
          role: "superadmin",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    }
    res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password });
  }
  if (![200, 202].includes(res.statusCode)) {
    throw new Error(
      "Cannot login superadmin: status " +
        res.statusCode +
        " body: " +
        JSON.stringify(res.body)
    );
  }
  const token = res.body?.data?.access_token;
  if (!token) throw new Error("Superadmin login missing access token");
  return token;
}

function randomEmail(prefix) {
  return `${prefix}_${Date.now()}@example.com`;
}

describe("Admin invite & stats endpoints", () => {
  let adminToken;

  beforeAll(async () => {
    adminToken = await ensureSuperadminLogin();
    // Attempt to ensure profile role is superadmin (in case trigger/profile missing)
    const url = process.env.SUPABASE_URL;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && service) {
      const admin = createClient(url, service, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      // decode token payload (JWT) to get user id
      try {
        const payload = JSON.parse(
          Buffer.from(adminToken.split(".")[1], "base64").toString()
        );
        const userId = payload?.sub;
        if (userId) {
          await admin
            .from("profiles")
            .upsert(
              {
                id: userId,
                email: payload.email || "superadmin_test@example.com",
                full_name: "Test Superadmin",
                role: "superadmin",
                updated_at: new Date().toISOString(),
              },
              { onConflict: "id" }
            );
        }
      } catch (e) {
        // ignore decoding issues
      }
    }
  });

  it("POST /api/v1/admin/users creates user (invite style)", async () => {
    const email = randomEmail("invited");
    const res = await request(app)
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email,
        password: "Password123",
        full_name: "Invited User",
        role: "pengguna",
      });
    expect([201, 200]).toContain(res.statusCode);
    expect(res.body.error).toBe(false);
    expect(res.body.code).toBe("ADMIN_USER_CREATE_SUCCESS");
    expect(res.body.data).toHaveProperty("id");
    expect(res.body.data).toHaveProperty("email", email);
  });

  it("GET /api/v1/admin/dashboard/stats returns stats envelope", async () => {
    const res = await request(app)
      .get("/api/v1/admin/dashboard/stats")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.error).toBe(false);
    expect(res.body.code).toBe("ADMIN_STATS_SUCCESS");
    const data = res.body.data;
    expect(data).toHaveProperty("users");
    expect(data).toHaveProperty("materials");
    expect(data).toHaveProperty("quizzes");
    expect(data).toHaveProperty("schedules");
  });
});
