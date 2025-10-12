const express = require("express");
const authMiddleware = require("../../middlewares/auth-middleware");
const {
  requireAdmin,
  requireSuperadmin,
} = require("../../middlewares/role-middleware");
const {
  getAllUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  getDashboardStats,
  getAllQuizResults,
  updateUserRole,
  inviteAdmin,
  getSystemStats,
} = require("../../controllers/admin-controller");

const router = express.Router();

// Protect all admin routes
router.use(authMiddleware, requireAdmin);
// Prevent caching for admin API responses (avoid 304 Not Modified on auth-protected data)
router.use((req, res, next) => {
  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

// Alias: Admin Modules endpoints (map to modules controller but under /admin)
const {
  getModules,
  getModuleById,
  createModule,
  updateModule,
  deleteModule,
} = require("../../controllers/module-controller");
const { createMaterial } = require("../../controllers/material-controller");

router.get("/modules", getModules);
router.get("/modules/:id", getModuleById);
router.post("/modules", createModule);
router.put("/modules/:id", updateModule);
router.delete("/modules/:id", deleteModule);
// Nested create material under module (admin alias)
router.post("/modules/:module_id/materials", (req, res, next) => {
  req.body = { ...(req.body || {}), module_id: req.params.module_id };
  return createMaterial(req, res, next);
});

// Users CRUD
router.get("/users", getAllUsers);
router.post("/users", createUser);
router.get("/users/:id", getUserById);
router.put("/users/:id", updateUser);
router.put("/users/:id/role", updateUserRole);
router.delete("/users/:id", deleteUser);

// Dashboard & analytics
router.get("/dashboard/stats", getDashboardStats);
router.get("/quiz-results", getAllQuizResults);

// New: superadmin-only invite endpoint to create an admin user directly
router.post("/invite", requireSuperadmin, async (req, res, next) => {
  // Force role to 'admin' regardless of payload to avoid privilege escalation
  req.body.role = "admin";
  return inviteAdmin(req, res, next);
});

// New: stats alias for clarity (superadmin or admin both allowed via requireAdmin applied globally)
router.get("/stats", getSystemStats);

// Add sub-materis endpoint for admin compatibility
const {
  getAllMaterials,
  getMaterialById,
} = require("../../controllers/material-controller");
const {
  getPoinsBySubMateri,
  getPoinById,
  createPoin,
  createPoinWithMedia,
  updatePoin,
  deletePoin,
} = require("../../controllers/poin-controller");

router.get("/sub-materis", getAllMaterials);
router.get("/sub-materis/:id", getMaterialById); // Admin access to any material (including drafts)

// Admin CRUD endpoints for poin details
router.get("/sub-materis/:subMateriId/poins", getPoinsBySubMateri); // Get all poins for a sub_materi
router.post("/sub-materis/:subMateriId/poins", createPoin); // Create poin for any material (including drafts)
router.post("/sub-materis/:subMateriId/poins-with-media", createPoinWithMedia); // Create poin with media upload
router.get("/poins/:id", getPoinById); // Get specific poin detail
router.put("/poins/:id", updatePoin); // Update poin detail
router.delete("/poins/:id", deletePoin); // Delete poin detail

// Media upload endpoints for poin details
const {
  uploadPoinMedia,
  deletePoinMedia,
  getPoinMedia,
  updatePoinMedia,
} = require("../../controllers/poin-controller");
router.post("/poins/:poinId/media", uploadPoinMedia); // Upload media to poin_media table & bucket
router.get("/poins/:poinId/media", getPoinMedia); // Get all media for a poin
router.put("/poins/media/:mediaId", updatePoinMedia); // Update media caption and order
router.delete("/poins/media/:mediaId", deletePoinMedia); // Delete media record and file

// Quiz Management Endpoints
const {
  getAllQuizzes,
  getQuizById,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  addQuestionToQuiz,
  updateQuestion,
  deleteQuestion,
  getSubMaterisForDropdown,
} = require("../../controllers/quiz-controller");

// Quiz CRUD
router.get("/quizzes", getAllQuizzes); // Get all quizzes with pagination and filters
router.get("/quizzes/:id", getQuizById); // Get quiz detail with questions
router.post("/quizzes", createQuiz); // Create new quiz
router.put("/quizzes/:id", updateQuiz); // Update quiz
router.delete("/quizzes/:id", deleteQuiz); // Delete quiz (soft delete)

// Quiz Questions Management
router.post("/quizzes/:quizId/questions", addQuestionToQuiz); // Add question to quiz
router.put("/questions/:id", updateQuestion); // Update specific question
router.delete("/questions/:id", deleteQuestion); // Delete question

// Alternative endpoints for frontend compatibility (consistent with poin pattern)
router.get(
  "/quiz-questions/:id",
  (req, res, next) => {
    // Redirect to existing pattern, if needed in future
    req.url = req.url.replace("/quiz-questions/", "/questions/");
    next();
  },
  (req, res) => {
    // For now, just return method not allowed, but could implement getQuestionById if needed
    res.status(405).json({
      success: false,
      code: "METHOD_NOT_ALLOWED",
      message: "Use GET /api/v1/admin/quizzes/:id to get questions",
    });
  }
);

router.put(
  "/quiz-questions/:id",
  (req, res, next) => {
    // Redirect to existing updateQuestion endpoint
    req.url = req.url.replace("/quiz-questions/", "/questions/");
    next();
  },
  updateQuestion
);

router.delete(
  "/quiz-questions/:id",
  (req, res, next) => {
    // Redirect to existing deleteQuestion endpoint
    req.url = req.url.replace("/quiz-questions/", "/questions/");
    next();
  },
  deleteQuestion
);

// Helper endpoint for dropdown data
router.get("/quiz-sub-materis", getSubMaterisForDropdown); // Get sub materis for quiz dropdown

module.exports = router;
