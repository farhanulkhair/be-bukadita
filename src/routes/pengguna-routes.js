const express = require("express");
const authMiddleware = require("../middlewares/auth-middleware");
const { getAllSchedules } = require("../controllers/schedule-controller");
const {
  getAllMaterials,
  getMaterialById,
} = require("../controllers/material-controller");
const {
  getAllQuizzes,
  getQuizById,
  submitQuizAnswers,
} = require("../controllers/quiz-controller");
const {
  getMyProfile,
  updateMyProfile,
} = require("../controllers/user-controller");

const router = express.Router();

// Schedules routes (public read)
router.get("/schedules", getAllSchedules);

// Materials routes (authenticated users)
router.get("/materials", authMiddleware, getAllMaterials);
router.get("/materials/:id", authMiddleware, getMaterialById);

// Quizzes routes (authenticated users)
router.get("/quizzes", authMiddleware, getAllQuizzes);
router.get("/quizzes/:id", authMiddleware, getQuizById);
router.post("/quizzes/:quizId/submit", authMiddleware, submitQuizAnswers);

// Self profile routes (authenticated users)
router.get("/profile", authMiddleware, getMyProfile);
router.put("/profile", authMiddleware, updateMyProfile);

module.exports = router;
