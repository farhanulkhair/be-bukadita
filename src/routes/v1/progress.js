const express = require("express");
const authMiddleware = require("../../middlewares/auth-middleware");
const { requireAdmin } = require("../../middlewares/role-middleware");
const {
  completePoin,
  getModuleProgress,
  getUserModulesProgress,
  checkSubMateriAccess,
  getSubMateriProgress,
  completeSubMateri,
} = require("../../controllers/progress-controller");

const router = express.Router();

// ============================================================================
// USER ROUTES (FE - authenticated users can track their progress)
// All routes require authentication
// ============================================================================

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/v1/progress/modules - Get progress for all modules
router.get("/modules", getUserModulesProgress);

// GET /api/v1/progress/modules/:module_id - Get progress for specific module
router.get("/modules/:module_id", getModuleProgress);

// GET /api/v1/progress/sub-materis/:id - Get progress for specific sub-materi
router.get("/sub-materis/:id", getSubMateriProgress);

// GET /api/v1/progress/materials/:sub_materi_id/access - Check access to sub-materi
router.get("/materials/:sub_materi_id/access", checkSubMateriAccess);

// POST /api/v1/progress/materials/:materi_id/poins/:poin_id/complete - Mark poin as completed
router.post("/materials/:materi_id/poins/:poin_id/complete", completePoin);

// POST /api/v1/progress/sub-materis/:id/complete - Mark sub-materi as completed
router.post("/sub-materis/:id/complete", completeSubMateri);

// ============================================================================
// ADMIN ROUTES (Backoffice - can view all users' progress if needed)
// These can be added later if admin needs to monitor user progress
// ============================================================================

// Example: GET /api/v1/progress/admin/users/:userId/modules
// This can be implemented if backoffice needs to view user progress

module.exports = router;
