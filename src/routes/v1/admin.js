const express = require("express");
const authMiddleware = require("../../middlewares/auth-middleware");
const {
  requireAdmin,
  requireSuperadmin,
} = require("../../middlewares/role-middleware");
const {
  getAllUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  getDashboardStats,
  getAllQuizResults,
  updateUserRole,
  inviteAdmin,
  getSystemStats,
} = require("../../controllers/admin-controller");

const router = express.Router();

// Protect all admin routes
router.use(authMiddleware, requireAdmin);

// (Material, Quiz, Schedule CRUD moved to resource routers)

// Users CRUD
router.get("/users", getAllUsers);
router.post("/users", createUser);
router.get("/users/:id", getUserById);
router.put("/users/:id", updateUser);
router.put("/users/:id/role", updateUserRole);
router.delete("/users/:id", deleteUser);

// Dashboard & analytics
router.get("/dashboard/stats", getDashboardStats);
router.get("/quiz-results", getAllQuizResults);

// New: superadmin-only invite endpoint to create an admin user directly
router.post("/invite", requireSuperadmin, async (req, res, next) => {
  // Force role to 'admin' regardless of payload to avoid privilege escalation
  req.body.role = "admin";
  return inviteAdmin(req, res, next);
});

// New: stats alias for clarity (superadmin or admin both allowed via requireAdmin applied globally)
router.get("/stats", getSystemStats);

module.exports = router;
