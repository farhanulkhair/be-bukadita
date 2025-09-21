const express = require("express");
const authMiddleware = require("../middlewares/auth-middleware");
const { requireAdmin } = require("../middlewares/role-middleware");
const {
  createSchedule,
  updateSchedule,
  deleteSchedule,
} = require("../controllers/schedule-controller");
const {
  createMaterial,
  updateMaterial,
  deleteMaterial,
} = require("../controllers/material-controller");
const {
  createQuizWithQuestions,
  deleteQuiz,
} = require("../controllers/quiz-controller");
const {
  getAllUsers,
  getDashboardStats,
  getAllQuizResults,
  updateUserRole,
} = require("../controllers/admin-controller");

const router = express.Router();

// Apply authentication and admin role requirement to all routes
router.use(authMiddleware);
router.use(requireAdmin);

// Schedule management
router.post("/schedules", createSchedule);
router.put("/schedules/:id", updateSchedule);
router.delete("/schedules/:id", deleteSchedule);

// Material management
router.post("/materials", createMaterial);
router.put("/materials/:id", updateMaterial);
router.delete("/materials/:id", deleteMaterial);

// Quiz management
router.post("/quizzes", createQuizWithQuestions);
router.delete("/quizzes/:id", deleteQuiz);

// User management
router.get("/users", getAllUsers);
router.put("/users/:id/role", updateUserRole);

// Dashboard and analytics
router.get("/dashboard/stats", getDashboardStats);
router.get("/quiz-results", getAllQuizResults);

module.exports = router;
