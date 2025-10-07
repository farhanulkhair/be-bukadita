const express = require("express");

// Sub-routers
const authRouter = require("./auth");
const materialsRouter = require("./materials");
const quizzesRouter = require("./quizzes");
const usersRouter = require("./users");
const modulesRouter = require("./modules");
const adminRouter = require("./admin");

const router = express.Router();

// Poin details router for direct access
const {
  getPoinById,
  updatePoin,
  deletePoin,
} = require("../../controllers/poin-controller");
const authMiddleware = require("../../middlewares/auth-middleware");
const { requireAdmin } = require("../../middlewares/role-middleware");

// Mount resource routers (all already versioned under /api/v1 in app.js via this index)
router.use("/auth", authRouter);
router.use("/materials", materialsRouter);
router.use("/quizzes", quizzesRouter);
router.use("/users", usersRouter);
router.use("/admin", adminRouter);
router.use("/modules", modulesRouter);

// Direct poin details routes (for admin management)
router.get("/poins/:id", getPoinById); // Get specific poin (with access control)
router.put("/poins/:id", authMiddleware, requireAdmin, updatePoin); // Admin update poin
router.delete("/poins/:id", authMiddleware, requireAdmin, deletePoin); // Admin delete poin

module.exports = router;
