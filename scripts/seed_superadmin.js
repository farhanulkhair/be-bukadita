#!/usr/bin/env node
// Superadmin seeding (idempotent). CommonJS version for current project setup.
require("dotenv/config");
const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserByEmail(email) {
  let page = 1;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) throw error;
    const found = data.users.find((u) => u.email === email);
    if (found) return found;
    if (data.users.length < 100) return null; // last page
    page++;
  }
}

async function ensureSuperadmin() {
  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;
  const name = process.env.SUPERADMIN_NAME || "Super Admin";
  if (!email || !password) {
    console.error("SUPERADMIN_EMAIL or SUPERADMIN_PASSWORD missing in env");
    process.exit(1);
  }

  console.log("[seed] Ensuring superadmin:", email);
  let user = await findUserByEmail(email);
  if (!user) {
    console.log("[seed] Creating new superadmin user");
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
      app_metadata: { role: "superadmin" },
    });
    if (error) throw error;
    user = data.user;
  } else {
    // Update metadata if needed
    const needsRole = user.app_metadata?.role !== "superadmin";
    const needsName = user.user_metadata?.full_name !== name;
    if (needsRole || needsName) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        app_metadata: { ...(user.app_metadata || {}), role: "superadmin" },
        user_metadata: { ...(user.user_metadata || {}), full_name: name },
      });
      if (error) throw error;
    }
  }

  console.log("[seed] User id:", user.id);
  // Use role (text) instead of role_id (FK)
  const { data: profile, error: pErr } = await supabaseAdmin
    .from("profiles")
    .upsert(
      {
        id: user.id,
        full_name: name,
        email,
        role: "superadmin",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select()
    .single();
  if (pErr) throw pErr;
  console.log("[seed] Profile ensured with role: superadmin");
}

ensureSuperadmin()
  .then(() => {
    console.log("✅ Superadmin seed complete");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Superadmin seed failed:", err.message);
    process.exit(1);
  });
