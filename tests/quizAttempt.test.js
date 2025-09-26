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

  // Create quiz
  const { data: quiz, error: quizErr } = await admin
    .from("quizzes")
    .insert({ title: "Sample Quiz", description: "Desc", passing_score: 50 })
    .select()
    .single();
  if (quizErr) throw quizErr;

  // Create one question
  const { data: question, error: qErr } = await admin
    .from("quiz_questions")
    .insert({ quiz_id: quiz.id, question_text: "2 + 2 = ?", position: 0 })
    .select()
    .single();
  if (qErr) throw qErr;

  // Choices
  const { data: choices, error: cErr } = await admin
    .from("quiz_choices")
    .insert([
      {
        question_id: question.id,
        choice_text: "3",
        is_correct: false,
        position: 0,
      },
      {
        question_id: question.id,
        choice_text: "4",
        is_correct: true,
        position: 1,
      },
    ])
    .select();
  if (cErr) throw cErr;

  const correct = choices.find((c) => c.is_correct);
  return { quiz, question, correctChoice: correct };
}

describe("POST /api/v1/quizzes/:quizId/attempts", () => {
  let token;
  let seeded;

  beforeAll(async () => {
    token = await registerUser(`attempter_${Date.now()}@example.com`);
    seeded = await seedQuiz();
  });

  it("records an attempt and returns score/passed fields", async () => {
    const res = await request(app)
      .post(`/api/v1/quizzes/${seeded.quiz.id}/attempts`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        answers: [
          {
            question_id: seeded.question.id,
            choice_id: seeded.correctChoice.id,
          },
        ],
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.error).toBe(false);
    expect(res.body.code).toBe("QUIZ_ATTEMPT_SUCCESS");
    expect(res.body.message).toMatch(/recorded/i);
    expect(res.body?.data?.attempt_id).toBeTruthy();
    expect(typeof res.body.data.score).toBe("number");
    expect(res.body.data.total_questions).toBe(1);
    expect(res.body.data.correct_answers).toBe(1);
    expect(res.body.data.passed).toBe(true);
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
