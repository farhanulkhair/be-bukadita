require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing environment variables!");
  console.error("SUPABASE_URL:", supabaseUrl ? "✓ Set" : "✗ Missing");
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY:",
    supabaseKey ? "✓ Set" : "✗ Missing"
  );
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseKey);

async function checkQuizzes() {
  console.log("🔍 Checking quizzes in database...\n");

  // Get all quizzes
  const { data: quizzes, error } = await client
    .from("materis_quizzes")
    .select("id, title, sub_materi_id, module_id, published")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("❌ Error fetching quizzes:", error);
    return;
  }

  if (!quizzes || quizzes.length === 0) {
    console.log("⚠️  No quizzes found in database!");
    console.log("\n💡 You need to create quizzes in Supabase first.");
    console.log(
      "   Use the admin panel or insert directly into materis_quizzes table."
    );
    return;
  }

  console.log(`✅ Found ${quizzes.length} quizzes:\n`);

  quizzes.forEach((quiz, index) => {
    console.log(`${index + 1}. ID: ${quiz.id}`);
    console.log(`   Title: ${quiz.title || "(no title)"}`);
    console.log(`   Module ID: ${quiz.module_id || "null"}`);
    console.log(`   Sub-Materi ID: ${quiz.sub_materi_id || "null"}`);
    console.log(`   Published: ${quiz.published ? "Yes" : "No"}`);
    console.log("");
  });

  // Show mapping suggestion
  console.log(
    '\n📋 To fix "quizId: undefined" error, add quizId to your static data:'
  );
  console.log("\nExample for pengelolaan-posyandu.ts:");
  console.log("```typescript");
  console.log("subMateris: [");
  console.log("  {");
  console.log('    id: "sub1",');
  console.log(
    '    quizId: "' +
      (quizzes[0]?.id || "YOUR_QUIZ_UUID_HERE") +
      '", // ← ADD THIS'
  );
  console.log('    title: "...",');
  console.log("    // ... rest of properties");
  console.log("  }");
  console.log("]");
  console.log("```");
}

checkQuizzes()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
