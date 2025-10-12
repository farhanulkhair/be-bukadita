const express = require("express");
const authMiddleware = require("../../middlewares/auth-middleware");
const { requireAdmin } = require("../../middlewares/role-middleware");
const {
  getModules,
  getModuleById,
  createModule,
  updateModule,
  deleteModule,
} = require("../../controllers/module-controller");

const router = express.Router();
const { createMaterial } = require("../../controllers/material-controller");

// Public read
router.get("/", getModules);
router.get("/:id", getModuleById);

// NOTE: Module quizzes endpoint temporarily disabled - use /admin/quizzes with module filter
router.get("/:module_id/quizzes", (req, res) => {
  return res.status(501).json({
    success: false,
    message:
      "Module quizzes endpoint not implemented. Use /api/v1/admin/quizzes with filtering.",
  });
});

// Admin-only CRUD
router.post("/", authMiddleware, requireAdmin, createModule);
router.put("/:id", authMiddleware, requireAdmin, updateModule);
router.delete("/:id", authMiddleware, requireAdmin, deleteModule);

// Admin nested alias: create material under a module (auto inject module_id)
router.post(
  "/:module_id/materials",
  authMiddleware,
  requireAdmin,
  (req, res, next) => {
    req.body = { ...(req.body || {}), module_id: req.params.module_id };
    return createMaterial(req, res, next);
  }
);

module.exports = router;
