const express = require("express");

// Sub-routers
const authRouter = require("./auth");
const materialsRouter = require("./materials");
const quizzesRouter = require("./quizzes");
const usersRouter = require("./users");
const modulesRouter = require("./modules");
const adminRouter = require("./admin");
const notesRouter = require("../notes-routes");
const userQuizzesRouter = require("./user-quizzes");
const progressRouter = require("./progress");

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
router.use("/notes", notesRouter);
router.use("/user-quizzes", userQuizzesRouter);
router.use("/progress", progressRouter);

// Direct poin details routes (for admin management)
router.get("/poins/:id", getPoinById); // Get specific poin (with access control)
router.put("/poins/:id", authMiddleware, requireAdmin, updatePoin); // Admin update poin
router.delete("/poins/:id", authMiddleware, requireAdmin, deletePoin); // Admin delete poin

// Direct quiz questions routes (for admin management - fallback endpoints)
const {
  updateQuestion,
  deleteQuestion,
} = require("../../controllers/quiz-controller");

router.put("/quiz-questions/:id", authMiddleware, requireAdmin, updateQuestion); // Admin update question
router.delete(
  "/quiz-questions/:id",
  authMiddleware,
  requireAdmin,
  deleteQuestion
); // Admin delete question

module.exports = router;
