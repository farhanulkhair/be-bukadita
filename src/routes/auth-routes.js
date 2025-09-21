const express = require("express");
const {
  createOrUpdateProfile,
  testLogin,
  register,
  login,
  logout,
  debugUsers,
  createMissingProfile,
} = require("../controllers/auth-controller");
const authMiddleware = require("../middlewares/auth-middleware");

const router = express.Router();

// POST /api/auth/register - Register with email & password
router.post("/register", register);

// POST /api/auth/login - Login with email & password
router.post("/login", login);

// POST /api/auth/logout - Logout user
router.post("/logout", logout);

// POST /api/auth/profile - Create or update profile after sign-in
router.post("/profile", authMiddleware, createOrUpdateProfile);

// POST /api/auth/create-missing-profile - Create profile for user if missing
router.post("/create-missing-profile", authMiddleware, createMissingProfile);

module.exports = router;
