#!/usr/bin/env node
/*
  Quick Supabase connection check.
  - Loads .env
  - Uses src/lib/SupabaseClient.js to create anon and service-role clients
  - Attempts a minimal select against one of the known tables
  - Prints a concise JSON result
*/

require("dotenv").config();
const path = require("path");

async function tryTables(client, tables) {
  for (const t of tables) {
    try {
      const { data, error, count } = await client
        .from(t)
        .select("id", { count: "exact" })
        .range(0, 0);
      if (!error) {
        return {
          ok: true,
          table: t,
          count: typeof count === "number" ? count : data?.length || 0,
        };
      }
      // If table doesn't exist, continue to next
      const msg = (error.message || "").toLowerCase();
      if (
        msg.includes("does not exist") ||
        msg.includes("relation") ||
        msg.includes("table")
      ) {
        continue;
      }
      return { ok: false, table: t, error: error.message };
    } catch (e) {
      return { ok: false, table: t, error: e.message };
    }
  }
  return { ok: false, error: "No target tables available to query" };
}

async function main() {
  const env = {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  let clients;
  try {
    clients = require(path.join(
      __dirname,
      "..",
      "src",
      "lib",
      "SupabaseClient"
    ));
  } catch (e) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          reason: "Failed to load SupabaseClient.js",
          error: e.message,
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  const { supabaseAnon, supabaseAdmin } = clients;
  const tablesToTry = ["modules", "profiles", "materials"]; // try in this order

  const result = { env, anon: {}, service: {} };

  // Check anon client
  try {
    const anonRes = await tryTables(supabaseAnon, tablesToTry);
    result.anon = anonRes;
  } catch (e) {
    result.anon = { ok: false, error: e.message };
  }

  // Check service-role client (if available)
  if (supabaseAdmin) {
    try {
      const serviceRes = await tryTables(supabaseAdmin, tablesToTry);
      result.service = serviceRes;
    } catch (e) {
      result.service = { ok: false, error: e.message };
    }
  } else {
    result.service = { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY not set" };
  }

  // Summarize
  result.ok = !!(result.anon.ok || result.service.ok);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
