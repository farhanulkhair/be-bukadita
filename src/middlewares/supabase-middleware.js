const { supabaseAnon, supabaseAdmin } = require("../lib/SupabaseClient");

// Ensures every request has a baseline Supabase client reference.
// auth-middleware (when present) will override req.supabase with a user-scoped client.
module.exports = function supabaseClientMiddleware(req, _res, next) {
  if (!req.supabase) {
    req.supabase = supabaseAnon; // default anonymous (RLS enforced)
  }
  // Provide explicit references if a controller needs elevated (service role) access
  req.supabaseAnon = supabaseAnon;
  req.supabaseAdmin = supabaseAdmin;
  next();
};
