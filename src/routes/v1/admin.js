const express = require("express");
const authMiddleware = require("../../middlewares/auth-middleware");
const {
  requireAdmin,
  requireSuperadmin,
} = require("../../middlewares/role-middleware");
const {
  getDashboardStats,
  getAllQuizResults,
  inviteAdmin,
  getSystemStats,
} = require("../../controllers/admin-controller");
const {
  getComprehensiveDashboardStats
} = require("../../controllers/dashboard-controller");

const router = express.Router();

// ============================================================================
// ADMIN ROUTES
// All routes require admin authentication
// ============================================================================

// Protect all admin routes
router.use(authMiddleware, requireAdmin);

// Prevent caching for admin API responses
router.use((req, res, next) => {
  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

// ============================================================================
// DASHBOARD & ANALYTICS
// ============================================================================

// GET /api/v1/admin/dashboard/stats - Get comprehensive dashboard statistics (NEW - with real data)
router.get("/dashboard/stats", authMiddleware, requireAdmin, getComprehensiveDashboardStats);

// GET /api/v1/admin/stats - Get system statistics (alias for legacy support)
router.get("/stats", authMiddleware, requireAdmin, getSystemStats);

// GET /api/v1/admin/progress/stats - Get progress statistics (alias for dashboard stats)
router.get("/progress/stats", authMiddleware, requireAdmin, getComprehensiveDashboardStats);

// GET /api/v1/admin/quiz-results - Get all quiz results
router.get("/quiz-results", getAllQuizResults);

// ============================================================================
// ADMIN MANAGEMENT (Superadmin only)
// ============================================================================

// POST /api/v1/admin/invite - Invite new admin (Superadmin only)
router.post("/invite", requireSuperadmin, async (req, res, next) => {
  // Force role to 'admin' to prevent privilege escalation
  req.body.role = "admin";
  return inviteAdmin(req, res, next);
});

// ============================================================================
// NOTE: Other admin functionalities have been moved to resource-specific routes:
// - User management: /api/v1/users (with requireAdmin middleware)
// - Module management: /api/v1/modules (with requireAdmin middleware)
// - Material management: /api/v1/materials (with requireAdmin middleware)
// - Quiz management: /api/v1/quizzes/admin/* (with requireAdmin middleware)
// - Poin management: /api/v1/materials/poins/* (with requireAdmin middleware)
// ============================================================================

module.exports = router;
