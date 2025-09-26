const express = require("express");
const {
  createOrUpdateProfile,
  register,
  login,
  logout,
  createMissingProfile,
  refresh,
} = require("../../controllers/auth-controller");
const authMiddleware = require("../../middlewares/auth-middleware");

const router = express.Router();

// Versioned v1 authentication routes
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.post("/refresh", refresh);
router.post("/profile", authMiddleware, createOrUpdateProfile);
router.post("/create-missing-profile", authMiddleware, createMissingProfile);

module.exports = router;
