#!/usr/bin/env node
// Seed sample development data: materials, quizzes, demo users (non-admin)
// Idempotent-ish: it will skip creating duplicates based on slug/title uniqueness.
require("dotenv/config");
const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function ensureUser(email, fullName) {
  let user = null;
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) throw error;
    const found = data.users.find((u) => u.email === email);
    if (found) {
      user = found;
      break;
    }
    if (data.users.length < 100) break;
    page++;
  }
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: "Password123",
      email_confirm: true,
      user_metadata: { full_name: fullName },
      app_metadata: { role: "pengguna" },
    });
    if (error) throw error;
    user = data.user;
  }
  // ensure profile row exists / updated
  await supabase.from("profiles").upsert(
    {
      id: user.id,
      full_name: fullName,
      email,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  return user.id;
}

// removed location/schedules seeding as those tables are no longer used

async function ensureMaterial(authorId) {
  const slug = "nutrisi-ibu-hamil";
  const { data, error } = await supabase
    .from("materials")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (data) return data.id;
  const { data: mat, error: mErr } = await supabase
    .from("materials")
    .insert({
      title: "Nutrisi Penting untuk Ibu Hamil",
      slug,
      content: "Konten contoh tentang nutrisi penting selama kehamilan.",
      author: authorId,
      published: true,
    })
    .select()
    .single();
  if (mErr) throw mErr;
  return mat.id;
}

async function ensureQuiz(authorId, materialId) {
  const title = "Kuis Nutrisi Dasar";
  const { data, error } = await supabase
    .from("quizzes")
    .select("id")
    .eq("title", title)
    .maybeSingle();
  if (error) throw error;
  if (data) return data.id;
  const { data: quiz, error: qErr } = await supabase
    .from("quizzes")
    .insert({
      title,
      description: "Tes pengetahuan dasar nutrisi ibu hamil",
      material_id: materialId,
      created_by: authorId,
      passing_score: 60,
    })
    .select()
    .single();
  if (qErr) throw qErr;
  // add questions
  const { data: question, error: qsErr } = await supabase
    .from("quiz_questions")
    .insert({
      quiz_id: quiz.id,
      question_text:
        "Vitamin apa yang penting untuk perkembangan tabung saraf janin?",
    })
    .select()
    .single();
  if (qsErr) throw qsErr;
  const choices = [
    { question_id: question.id, choice_text: "Vitamin C", is_correct: false },
    { question_id: question.id, choice_text: "Asam folat", is_correct: true },
    { question_id: question.id, choice_text: "Vitamin K", is_correct: false },
  ];
  await supabase.from("quiz_choices").insert(choices);
  return quiz.id;
}

async function run() {
  try {
    console.log("Seeding sample data...");
    const demoUserId = await ensureUser(
      "demo_pengguna@example.com",
      "Demo Pengguna"
    );
    // schedules/location removed
    const materialId = await ensureMaterial(demoUserId);
    await ensureQuiz(demoUserId, materialId);
    console.log("✅ Sample data seed complete");
  } catch (e) {
    console.error("❌ Sample data seed failed:", e.message);
    process.exit(1);
  }
}

run();
