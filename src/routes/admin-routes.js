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
  createUser,
  getUserById,
  updateUser,
  deleteUser,
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

// User management (CRUD)
router.get("/users", getAllUsers); // Get all users with pagination & search
router.post("/users", createUser); // Create new user account
router.get("/users/:id", getUserById); // Get user detail by ID
router.put("/users/:id", updateUser); // Update user profile data
router.put("/users/:id/role", updateUserRole); // Update user role specifically
router.delete("/users/:id", deleteUser); // Delete user account

// Dashboard and analytics
router.get("/dashboard/stats", getDashboardStats);
router.get("/quiz-results", getAllQuizResults);

module.exports = router;
