const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey) {
  throw new Error("Supabase URL and SUPABASE_ANON_KEY must be provided");
}

// Base anon client (no user auth) for public / server tasks that still respect RLS
const supabaseAnon = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Service-role client for privileged server operations (bypass RLS). NEVER expose to client.
const supabaseAdmin = serviceKey
  ? createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

module.exports = { supabaseAnon, supabaseAdmin };
