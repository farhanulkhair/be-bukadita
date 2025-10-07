const request = require("supertest");
require("dotenv").config();
const app = require("../src/app");
const { createClient } = require("@supabase/supabase-js");

async function ensureSuperadminLogin() {
  const email = process.env.SUPERADMIN_EMAIL || `superadmin_test@example.com`;
  const password = process.env.SUPERADMIN_PASSWORD || `Password123!`;
  let res = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password });
  if (res.statusCode === 401 || !res.body?.data?.access_token) {
    const url = process.env.SUPABASE_URL;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !service)
      throw new Error(
        "Service role env vars required to create superadmin for tests"
      );
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
      throw new Error("Failed to create superadmin: " + createErr.message);
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
  const token = res.body?.data?.access_token;
  if (!token) throw new Error("Cannot obtain superadmin token");
  return token;
}

describe("Modules API", () => {
  let adminToken;
  let createdId;

  beforeAll(async () => {
    adminToken = await ensureSuperadminLogin();
  });

  it("GET /api/v1/modules (public)", async () => {
    const res = await request(app).get("/api/v1/modules");
    expect(res.statusCode).toBe(200);
    expect(res.body.error).toBe(false);
    expect(res.body.code).toBe("MODULE_FETCH_SUCCESS");
  });

  it("POST /api/v1/modules (admin)", async () => {
    const res = await request(app)
      .post("/api/v1/modules")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: `Module ${Date.now()}`,
        description: "desc",
        published: true,
      });
    expect([200, 201]).toContain(res.statusCode);
    expect(res.body.error).toBe(false);
    expect(res.body.code).toBe("MODULE_CREATE_SUCCESS");
    createdId = res.body.data.id;
  });

  it("PUT /api/v1/modules/:id (admin)", async () => {
    const res = await request(app)
      .put(`/api/v1/modules/${createdId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ description: "updated" });
    expect(res.statusCode).toBe(200);
    expect(res.body.code).toBe("MODULE_UPDATE_SUCCESS");
  });

  it("GET /api/v1/modules/:id (public with nested materials)", async () => {
    const res = await request(app).get(`/api/v1/modules/${createdId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.code).toBe("MODULE_DETAIL_SUCCESS");
    expect(res.body.data).toHaveProperty("materials");
  });

  it("DELETE /api/v1/modules/:id (admin)", async () => {
    const res = await request(app)
      .delete(`/api/v1/modules/${createdId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.code).toBe("MODULE_DELETE_SUCCESS");
  });
});
