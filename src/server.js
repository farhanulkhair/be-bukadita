const app = require("./app");

const PORT = process.env.PORT || 4000;

// Validate required environment variables
const requiredEnvVars = ["SUPABASE_URL", "SUPABASE_ANON_KEY"];
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error("❌ Missing required environment variables:");
  missingEnvVars.forEach((envVar) => {
    console.error(`   - ${envVar}`);
  });
  console.error(
    "\nPlease check your .env file and ensure all required variables are set."
  );
  process.exit(1);
}

// Start server
const server = app.listen(PORT, () => {
  console.log("🚀 Bukadita Backend API Server Started");
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log("📋 Available v1 endpoints:");
  console.log("   Auth:         /api/v1/auth/*");
  console.log("   Materials:    /api/v1/materials/*");
  console.log("   Modules:      /api/v1/modules/*");
  console.log("   Quizzes:      /api/v1/quizzes/* (admin redirects)");
  console.log("   Kuis:         /api/v1/kuis/* (user quiz access)");
  console.log("   User Quizzes: /api/v1/user-quizzes/* (quiz attempts)");
  console.log("   Users:        /api/v1/users/me");
  console.log("   Notes:        /api/v1/notes/*");
  console.log("   Admin:        /api/v1/admin/*");
  console.log("");

  // Bootstrap: ensure superadmin exists (optional, controlled via env)
  (async () => {
    try {
      const superEmail = process.env.SUPERADMIN_EMAIL;
      const superPass = process.env.SUPERADMIN_PASSWORD;
      const superPhone = process.env.SUPERADMIN_PHONE || null;
      const superName = process.env.SUPERADMIN_NAME || "Super Admin";
      if (!superEmail || !superPass) return; // Skip if not configured

      const { supabaseAdmin } = require("./lib/SupabaseClient");
      if (!supabaseAdmin) {
        console.warn(
          "[BOOTSTRAP] Service role not configured, cannot ensure superadmin"
        );
        return;
      }

      // Check if exists
      const { data: listRes, error: listErr } =
        await supabaseAdmin.auth.admin.listUsers();
      if (listErr) {
        console.warn("[BOOTSTRAP] listUsers failed:", listErr.message);
        return;
      }
      const exists = (listRes.users || []).find((u) => u.email === superEmail);
      if (!exists) {
        const { data: created, error: cErr } =
          await supabaseAdmin.auth.admin.createUser({
            email: superEmail,
            password: superPass,
            email_confirm: true,
            user_metadata: {
              full_name: superName,
              phone: superPhone,
              role: "superadmin",
            },
          });
        if (cErr) {
          console.warn("[BOOTSTRAP] create superadmin failed:", cErr.message);
          return;
        }
        const id = created.user.id;
        // ensure JWT carries role for RLS
        await supabaseAdmin.auth.admin.updateUserById(id, {
          app_metadata: { role: "superadmin" },
        });
        await supabaseAdmin.from("profiles").upsert(
          {
            id,
            email: superEmail,
            full_name: superName,
            phone: superPhone,
            role: "superadmin",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
        console.log(`[BOOTSTRAP] Superadmin created: ${superEmail}`);
      } else {
        // Ensure profile has superadmin role
        await supabaseAdmin
          .from("profiles")
          .update({ role: "superadmin" })
          .eq("id", exists.id);
        await supabaseAdmin.auth.admin.updateUserById(exists.id, {
          app_metadata: { role: "superadmin" },
        });
        console.log(`[BOOTSTRAP] Superadmin ensured: ${superEmail}`);
      }
    } catch (e) {
      console.warn("[BOOTSTRAP] Superadmin ensure error:", e.message);
    }
  })();
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    console.log("✅ Process terminated gracefully");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("🛑 SIGINT received. Shutting down gracefully...");
  server.close(() => {
    console.log("✅ Process terminated gracefully");
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

module.exports = server;
