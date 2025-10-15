const express = require("express");
const {
  getAllMaterials,
  getMaterialById,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  getPublicMaterials,
} = require("../../controllers/material-controller");
const {
  getPoinsBySubMateri,
  createPoin,
} = require("../../controllers/poin-controller");
const authMiddleware = require("../../middlewares/auth-middleware");
const { requireAdmin } = require("../../middlewares/role-middleware");

const router = express.Router();

// Materials (public read of published, authenticated may later extend)
// Public list (published only) & detail by ID; if authenticated admin/author may see drafts
router.get("/public", getPublicMaterials); // strictly published (anon)
router.get("/", getAllMaterials); // admin can see all materials with pagination
router.get("/:id", getMaterialById); // public detail by ID with poin_details

// Nested poin routes - support both admin and public access
router.get("/:subMateriId/poins", getPoinsBySubMateri); // Get poins for a material
router.post("/:subMateriId/poins", authMiddleware, requireAdmin, createPoin); // Admin can add poins to any material

// Quiz routes for users
const { getQuizForSubMateri } = require("../../controllers/quiz-controller");
router.get("/:subMateriId/quiz", getQuizForSubMateri); // Get quiz for sub_materi (published only for users)

// Additional routes for material points and quizzes (REST API style)
const {
  getMaterialPoints,
  getMaterialQuizzes,
} = require("../../controllers/material-controller");
router.get("/:id/points", getMaterialPoints); // Get points for a material
router.get("/:id/quizzes", getMaterialQuizzes); // Get quizzes for a material

// Admin protected CRUD
router.post("/", authMiddleware, requireAdmin, createMaterial);
router.put("/:id", authMiddleware, requireAdmin, updateMaterial);
router.delete("/:id", authMiddleware, requireAdmin, deleteMaterial);

module.exports = router;
