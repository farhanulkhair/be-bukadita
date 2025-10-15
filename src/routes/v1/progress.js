const express = require("express");
const authMiddleware = require("../../middlewares/auth-middleware");
const {
  completePoin,
  getModuleProgress,
  getUserModulesProgress,
  checkSubMateriAccess,
  getSubMateriProgress,
  completeSubMateri,
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

// GET /api/v1/progress/sub-materis/:id - Get progress for specific sub-materi
router.get("/sub-materis/:id", getSubMateriProgress);

// POST /api/v1/progress/sub-materis/:id/complete - Mark sub-materi as completed
router.post("/sub-materis/:id/complete", completeSubMateri);

module.exports = router;
