require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing environment variables!");
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseKey);

// Sample quizzes matching the static data structure
const sampleQuizzes = [
  {
    module_id: 1,
    sub_materi_id: "sub1",
    title: "Kuis: Paket Pelayanan Posyandu untuk Seluruh Siklus Hidup",
    description: "Uji pemahaman Anda tentang paket pelayanan posyandu",
    quiz_type: "sub",
    time_limit_seconds: 900, // 15 minutes
    passing_score: 70,
    published: true,
  },
  {
    module_id: 1,
    sub_materi_id: "sub2",
    title: "Kuis: Sistem Pencatatan dan Pelaporan",
    description: "Uji pemahaman Anda tentang sistem pencatatan dan pelaporan",
    quiz_type: "sub",
    time_limit_seconds: 900,
    passing_score: 70,
    published: true,
  },
  {
    module_id: 1,
    sub_materi_id: "sub3",
    title: "Kuis: Pelaksanaan Kunjungan Rumah",
    description: "Uji pemahaman Anda tentang pelaksanaan kunjungan rumah",
    quiz_type: "sub",
    time_limit_seconds: 900,
    passing_score: 70,
    published: true,
  },
];

// Sample questions for quiz 1 (sub1)
const quiz1Questions = [
  {
    question_text: "Apa yang dimaksud dengan paket pelayanan posyandu?",
    options: [
      { text: "Pelayanan kesehatan hanya untuk ibu hamil" },
      { text: "Pelayanan komprehensif untuk semua kelompok usia" },
      { text: "Pelayanan khusus balita" },
      { text: "Pelayanan darurat saja" },
    ],
    correct_answer_index: 1,
    explanation:
      "Paket pelayanan posyandu mencakup pelayanan komprehensif untuk semua kelompok usia dalam siklus hidup.",
    order_index: 0,
  },
  {
    question_text: "Manakah yang termasuk sarana utama posyandu?",
    options: [
      { text: "Timbangan dan alat ukur" },
      { text: "Komputer dan printer" },
      { text: "Kursi roda" },
      { text: "Ambulans" },
    ],
    correct_answer_index: 0,
    explanation:
      "Timbangan dan alat ukur merupakan sarana utama yang harus tersedia di posyandu.",
    order_index: 1,
  },
  {
    question_text: "Berapa jumlah meja dalam sistem pelayanan posyandu?",
    options: [
      { text: "3 meja" },
      { text: "4 meja" },
      { text: "5 meja" },
      { text: "6 meja" },
    ],
    correct_answer_index: 2,
    explanation:
      "Sistem pelayanan posyandu menggunakan 5 meja: pendaftaran, penimbangan, pencatatan, penyuluhan & pelayanan, dan pelayanan kesehatan.",
    order_index: 2,
  },
];

async function seedQuizzes() {
  console.log("🌱 Seeding sample quizzes to database...\n");

  try {
    // Insert quiz for sub1
    console.log("1️⃣  Creating quiz for sub-materi sub1...");
    const { data: quiz1, error: quiz1Error } = await client
      .from("materis_quizzes")
      .insert(sampleQuizzes[0])
      .select()
      .single();

    if (quiz1Error) {
      console.error("❌ Error creating quiz 1:", quiz1Error);
      return;
    }

    console.log("✅ Quiz 1 created with ID:", quiz1.id);

    // Insert questions for quiz 1
    console.log("   Adding questions to quiz 1...");
    const questionsWithQuizId = quiz1Questions.map((q) => ({
      ...q,
      quiz_id: quiz1.id,
    }));

    const { error: questionsError } = await client
      .from("materis_quiz_questions")
      .insert(questionsWithQuizId);

    if (questionsError) {
      console.error("❌ Error creating questions:", questionsError);
      return;
    }

    console.log("✅ 3 questions added to quiz 1\n");

    // Insert other quizzes (without questions for now)
    console.log("2️⃣  Creating quizzes for sub2 and sub3...");
    const { data: otherQuizzes, error: otherError } = await client
      .from("materis_quizzes")
      .insert([sampleQuizzes[1], sampleQuizzes[2]])
      .select();

    if (otherError) {
      console.error("❌ Error creating other quizzes:", otherError);
      return;
    }

    console.log("✅ Created", otherQuizzes.length, "additional quizzes\n");

    // Show mapping instructions
    console.log("═══════════════════════════════════════════════════════════");
    console.log("✅ SEEDING COMPLETED! Now update your static data files:");
    console.log(
      "═══════════════════════════════════════════════════════════\n"
    );

    console.log("📝 Add these quizId values to pengelolaan-posyandu.ts:\n");
    console.log("subMateris: [");
    console.log("  {");
    console.log('    id: "sub1",');
    console.log(`    quizId: "${quiz1.id}", // ← ADD THIS LINE`);
    console.log(
      '    title: "Paket Pelayanan Posyandu untuk Seluruh Siklus Hidup",'
    );
    console.log("    // ... rest of properties");
    console.log("  },");
    console.log("  {");
    console.log('    id: "sub2",');
    console.log(`    quizId: "${otherQuizzes[0].id}", // ← ADD THIS LINE`);
    console.log("    // ...");
    console.log("  },");
    console.log("  {");
    console.log('    id: "sub3",');
    console.log(`    quizId: "${otherQuizzes[1].id}", // ← ADD THIS LINE`);
    console.log("    // ...");
    console.log("  },");
    console.log("]");
    console.log("\n✅ After adding quizId, refresh browser and test again!");
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

seedQuizzes()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
