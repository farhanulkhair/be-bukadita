const express = require("express");
const authMiddleware = require("../../middlewares/auth-middleware");
const { optionalAuth } = require("../../middlewares/auth-middleware");
const { requireAdmin } = require("../../middlewares/role-middleware");
const {
  getModules,
  getModuleById,
  createModule,
  updateModule,
  deleteModule,
} = require("../../controllers/module-controller");

const router = express.Router();

// ============================================================================
// PUBLIC ROUTES (FE & Backoffice can access)
// ============================================================================

// GET /api/v1/modules - Get all modules (published for users, all for admin)
// Uses optional auth to detect admin role if logged in
router.get("/", optionalAuth, getModules);

// GET /api/v1/modules/:id - Get module by ID with sub-materials
router.get("/:id", optionalAuth, getModuleById);

// ============================================================================
// ADMIN ONLY ROUTES (Backoffice only)
// ============================================================================

// POST /api/v1/modules - Create new module (Admin only)
router.post("/", authMiddleware, requireAdmin, createModule);

// PUT /api/v1/modules/:id - Update module (Admin only)
router.put("/:id", authMiddleware, requireAdmin, updateModule);

// DELETE /api/v1/modules/:id - Delete module (Admin only)
router.delete("/:id", authMiddleware, requireAdmin, deleteModule);

module.exports = router;
