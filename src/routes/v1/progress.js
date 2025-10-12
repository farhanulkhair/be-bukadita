const express = require("express");
const authMiddleware = require("../../middlewares/auth-middleware");
const {
  completePoin,
  getModuleProgress,
  getUserModulesProgress,
  checkSubMateriAccess,
} = require("../../controllers/progress-controller");

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// POST /api/v1/progress/materials/:materi_id/poins/:poin_id/complete
router.post("/materials/:materi_id/poins/:poin_id/complete", completePoin);

// GET /api/v1/progress/modules/:module_id - Get progress for specific module
router.get("/modules/:module_id", getModuleProgress);

// GET /api/v1/progress/modules - Get progress for all modules
router.get("/modules", getUserModulesProgress);

// GET /api/v1/progress/materials/:sub_materi_id/access - Check access to sub-materi
router.get("/materials/:sub_materi_id/access", checkSubMateriAccess);

module.exports = router;
