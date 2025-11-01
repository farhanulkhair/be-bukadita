const express = require("express");
const authMiddleware = require("../../middlewares/auth-middleware");
const { requireAdmin } = require("../../middlewares/role-middleware");
const {
  getMyProfile,
  updateMyProfile,
  uploadProfilePhoto,
  deleteProfilePhoto,
  changePassword,
  upload,
} = require("../../controllers/user-controller");
const {
  getAllUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  updateUserRole,
} = require("../../controllers/admin-controller");

const router = express.Router();

// ============================================================================
// USER ROUTES (FE - self management)
// ============================================================================

// GET /api/v1/users/me - Get current user profile
router.get("/me", authMiddleware, getMyProfile);

// PUT /api/v1/users/me - Update current user profile
router.put("/me", authMiddleware, updateMyProfile);

// POST /api/v1/users/me/profile-photo - Upload profile photo
router.post(
  "/me/profile-photo",
  authMiddleware,
  upload.single("photo"),
  uploadProfilePhoto
);

// DELETE /api/v1/users/me/profile-photo - Delete profile photo
router.delete("/me/profile-photo", authMiddleware, deleteProfilePhoto);

// POST /api/v1/users/me/change-password - Change password
router.post("/me/change-password", authMiddleware, changePassword);

// ============================================================================
// ADMIN ONLY ROUTES (Backoffice - user management)
// ============================================================================

// GET /api/v1/users - Get all users (Admin only)
router.get("/", authMiddleware, requireAdmin, getAllUsers);

// POST /api/v1/users - Create new user (Admin only)
router.post("/", authMiddleware, requireAdmin, createUser);

// GET /api/v1/users/:id - Get user by ID (Admin only)
router.get("/:id", authMiddleware, requireAdmin, getUserById);

// PUT /api/v1/users/:id - Update user (Admin only)
router.put("/:id", authMiddleware, requireAdmin, updateUser);

// PUT /api/v1/users/:id/role - Update user role (Admin only)
router.put("/:id/role", authMiddleware, requireAdmin, updateUserRole);

// DELETE /api/v1/users/:id - Delete user (Admin only)
router.delete("/:id", authMiddleware, requireAdmin, deleteUser);

module.exports = router;
