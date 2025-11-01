const express = require("express");

// ============================================================================
// CONSOLIDATED V1 API ROUTES
// All routes follow consistent pattern:
// - Public routes: No authentication required
// - User routes: authMiddleware required
// - Admin routes: authMiddleware + requireAdmin required
// ============================================================================

// Import route modules
const authRouter = require("./auth");
const modulesRouter = require("./modules");
const materialsRouter = require("./materials");
const quizzesRouter = require("./quizzes");
const usersRouter = require("./users");
const notesRouter = require("./notes");
const progressRouter = require("./progress");
const adminRouter = require("./admin");

const router = express.Router();

// ============================================================================
// MOUNT ROUTES
// ============================================================================

// Auth routes (register, login, logout, refresh)
router.use("/auth", authRouter);

// Module routes (public read, admin CRUD)
router.use("/modules", modulesRouter);

// Material routes (public read, admin CRUD, includes poins)
router.use("/materials", materialsRouter);

// Quiz routes (consolidated - user quiz taking + admin management)
router.use("/quizzes", quizzesRouter);

// User routes (self-management + admin user management)
router.use("/users", usersRouter);

// Notes routes (authenticated users)
router.use("/notes", notesRouter);

// Progress routes (user progress tracking)
router.use("/progress", progressRouter);

// Admin routes (dashboard, stats, admin invite)
router.use("/admin", adminRouter);

// ============================================================================
// API INFO ENDPOINT
// ============================================================================

router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Bukadita API v1",
    version: "1.0.0",
    endpoints: {
      auth: "/api/v1/auth",
      modules: "/api/v1/modules",
      materials: "/api/v1/materials",
      quizzes: "/api/v1/quizzes",
      users: "/api/v1/users",
      notes: "/api/v1/notes",
      progress: "/api/v1/progress",
      admin: "/api/v1/admin",
    },
    documentation: {
      api_docs: "/api-docs",
      endpoint_list: "/endpoint-list",
      user_guide: "/user-guide",
    },
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
