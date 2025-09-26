const express = require("express");
const {
  getAllMaterials,
  getMaterialBySlug,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  getPublicMaterials,
} = require("../../controllers/material-controller");
const authMiddleware = require("../../middlewares/auth-middleware");
const { requireAdmin } = require("../../middlewares/role-middleware");

const router = express.Router();

// Materials (public read of published, authenticated may later extend)
// Public list (published only) & detail by slug; if authenticated admin/author may see drafts
router.get("/public", getPublicMaterials); // strictly published (anon)
router.get("/", getAllMaterials); // legacy / mixed (admin can see drafts)
router.get("/:slug", getMaterialBySlug); // public detail by slug

// Admin protected CRUD
router.post("/", authMiddleware, requireAdmin, createMaterial);
router.put("/:id", authMiddleware, requireAdmin, updateMaterial);
router.delete("/:id", authMiddleware, requireAdmin, deleteMaterial);

module.exports = router;
