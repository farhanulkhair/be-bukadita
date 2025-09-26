const express = require("express");
const authMiddleware = require("../../middlewares/auth-middleware");
const { requireAdmin } = require("../../middlewares/role-middleware");
const {
  getAllQuizzes,
  getQuizById,
  submitQuizAnswers,
  createQuizAttempt,
  createQuizWithQuestions,
  updateQuiz,
  deleteQuiz,
} = require("../../controllers/quiz-controller");

const router = express.Router();

// Public (or user-auth required for attempt submission). Keeping auth for listing if quizzes are restricted.
router.get("/", authMiddleware, getAllQuizzes);
router.get("/:id", authMiddleware, getQuizById);

// Attempts & legacy submit
router.post("/:id/attempts", authMiddleware, createQuizAttempt);
router.post("/:id/submit", authMiddleware, submitQuizAnswers); // legacy

// Admin quiz management
router.post("/", authMiddleware, requireAdmin, createQuizWithQuestions);
router.put("/:id", authMiddleware, requireAdmin, updateQuiz);
router.delete("/:id", authMiddleware, requireAdmin, deleteQuiz);

module.exports = router;
