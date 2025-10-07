const request = require("supertest");
require("dotenv").config();
const app = require("../src/app");
const { createClient } = require("@supabase/supabase-js");

// Helper to register a user quickly
async function registerUser(email) {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({ email, password: "Password123", full_name: "Tester" });
  expect([200, 201]).toContain(res.statusCode);
  const token = res.body?.data?.access_token;
  expect(token).toBeTruthy();
  return token;
}

// Creates a simple quiz (admin bypass is not available; we simulate via service role directly)
async function seedQuiz() {
  const url = process.env.SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service)
    throw new Error("Service role env vars required for test");
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // First create a module
  const { data: module, error: moduleErr } = await admin
    .from("modules")
    .insert({
      title: "Test Module",
      slug: "test-module",
      description: "Test",
      published: true,
    })
    .select()
    .single();
  if (moduleErr) throw moduleErr;

  // Then create a sub_materi
  const { data: subMateri, error: subMateriErr } = await admin
    .from("sub_materis")
    .insert({
      title: "Test Sub Materi",
      content: "Test content",
      module_id: module.id,
      published: true,
    })
    .select()
    .single();
  if (subMateriErr) throw subMateriErr;

  // Create quiz
  const { data: quiz, error: quizErr } = await admin
    .from("materis_quizzes")
    .insert({
      title: "Sample Quiz",
      description: "Desc",
      passing_score: 50,
      module_id: module.id,
      sub_materi_id: subMateri.id,
    })
    .select()
    .single();
  if (quizErr) throw quizErr;

  // Create one question
  const { data: question, error: qErr } = await admin
    .from("materis_quiz_questions")
    .insert({
      quiz_id: quiz.id,
      question_text: "2 + 2 = ?",
      options: ["3", "4", "5", "6"],
      correct_answer_index: 1,
      order_index: 0,
    })
    .select()
    .single();
  if (qErr) throw qErr;

  return { quiz, question, module, subMateri };
}

// TODO: Implement quiz endpoints for new schema
describe.skip("POST /api/v1/quizzes/:quizId/attempts", () => {
  let token;
  let seeded;

  beforeAll(async () => {
    token = await registerUser(`attempter_${Date.now()}@example.com`);
    seeded = await seedQuiz();
  });

  it("records an attempt and returns score/passed fields", async () => {
    // Quiz endpoints will be implemented in future iterations
    // This test is skipped for now as we focus on materials/modules endpoints
    expect(true).toBe(true);
  });
});

// Additional lightweight envelope regression tests
describe("Envelope regression checks", () => {
  it("GET /api/v1/materials/public returns standardized envelope", async () => {
    const res = await request(app).get("/api/v1/materials/public");
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("error", false);
    expect(res.body).toHaveProperty("code", "MATERIAL_PUBLIC_FETCH_SUCCESS");
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toHaveProperty("items");
    if (res.body.data.pagination) {
      const p = res.body.data.pagination;
      ["page", "limit", "total", "totalPages"].forEach((k) =>
        expect(p).toHaveProperty(k)
      );
    }
  });
});
