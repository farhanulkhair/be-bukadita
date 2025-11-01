const express = require("express");
const authMiddleware = require("../../middlewares/auth-middleware");
const { optionalAuth } = require("../../middlewares/auth-middleware");
const { requireAdmin } = require("../../middlewares/role-middleware");
const {
  getAllMaterials,
  getMaterialById,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  getPublicMaterials,
  getMaterialPoints,
  getMaterialQuizzes,
} = require("../../controllers/material-controller");
const {
  getPoinsBySubMateri,
  getPoinById,
  createPoin,
  createPoinWithMedia,
  updatePoin,
  deletePoin,
  uploadPoinMedia,
  deletePoinMedia,
  getPoinMedia,
  updatePoinMedia,
} = require("../../controllers/poin-controller");
const {
  getQuizForSubMateri,
} = require("../../controllers/quiz-controller");

const router = express.Router();

// ============================================================================
// PUBLIC ROUTES (FE can access - read only)
// ============================================================================

// GET /api/v1/materials/public - Get published materials only
router.get("/public", getPublicMaterials);

// GET /api/v1/materials/:id - Get material by ID (published for users, all for admin)
router.get("/:id", optionalAuth, getMaterialById);

// GET /api/v1/materials/:id/points - Get material points summary
router.get("/:id/points", optionalAuth, getMaterialPoints);

// GET /api/v1/materials/:id/quizzes - Get material quizzes summary
router.get("/:id/quizzes", optionalAuth, getMaterialQuizzes);

// GET /api/v1/materials/:subMateriId/poins - Get all poins for a sub-material
router.get("/:subMateriId/poins", optionalAuth, getPoinsBySubMateri);

// GET /api/v1/materials/:subMateriId/quiz - Get quiz for sub-material (users)
router.get("/:subMateriId/quiz", optionalAuth, getQuizForSubMateri);

// ============================================================================
// ADMIN ONLY ROUTES (Backoffice only)
// ============================================================================

// GET /api/v1/materials - Get all materials with filters (Admin can see drafts)
router.get("/", optionalAuth, getAllMaterials);

// POST /api/v1/materials - Create new material (Admin only)
router.post("/", authMiddleware, requireAdmin, createMaterial);

// PUT /api/v1/materials/:id - Update material (Admin only)
router.put("/:id", authMiddleware, requireAdmin, updateMaterial);

// DELETE /api/v1/materials/:id - Delete material (Admin only)
router.delete("/:id", authMiddleware, requireAdmin, deleteMaterial);

// ============================================================================
// POIN MANAGEMENT (Admin only)
// ============================================================================

// POST /api/v1/materials/:subMateriId/poins - Create poin for material
router.post("/:subMateriId/poins", authMiddleware, requireAdmin, createPoin);

// POST /api/v1/materials/:subMateriId/poins-with-media - Create poin with media
router.post("/:subMateriId/poins-with-media", authMiddleware, requireAdmin, createPoinWithMedia);

// GET /api/v1/materials/poins/:id - Get specific poin by ID
router.get("/poins/:id", authMiddleware, requireAdmin, getPoinById);

// PUT /api/v1/materials/poins/:id - Update poin
router.put("/poins/:id", authMiddleware, requireAdmin, updatePoin);

// DELETE /api/v1/materials/poins/:id - Delete poin
router.delete("/poins/:id", authMiddleware, requireAdmin, deletePoin);

// ============================================================================
// POIN MEDIA MANAGEMENT (Admin only)
// ============================================================================

// POST /api/v1/materials/poins/:poinId/media - Upload media to poin
router.post("/poins/:poinId/media", authMiddleware, requireAdmin, uploadPoinMedia);

// GET /api/v1/materials/poins/:poinId/media - Get all media for poin
router.get("/poins/:poinId/media", authMiddleware, requireAdmin, getPoinMedia);

// PUT /api/v1/materials/poins/media/:mediaId - Update media caption/order
router.put("/poins/media/:mediaId", authMiddleware, requireAdmin, updatePoinMedia);

// DELETE /api/v1/materials/poins/media/:mediaId - Delete media
router.delete("/poins/media/:mediaId", authMiddleware, requireAdmin, deletePoinMedia);

module.exports = router;
