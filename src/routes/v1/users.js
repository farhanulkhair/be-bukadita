const express = require("express");
const authMiddleware = require("../../middlewares/auth-middleware");
const {
  getMyProfile,
  updateMyProfile,
  uploadProfilePhoto,
  deleteProfilePhoto,
  changePassword,
  upload,
} = require("../../controllers/user-controller");

const router = express.Router();

router.get("/me", authMiddleware, getMyProfile);
router.put("/me", authMiddleware, updateMyProfile);

// Profile photo endpoints
router.post(
  "/me/profile-photo",
  authMiddleware,
  upload.single("photo"),
  uploadProfilePhoto
);
router.delete("/me/profile-photo", authMiddleware, deleteProfilePhoto);

// Change password endpoint
router.post("/me/change-password", authMiddleware, changePassword);

module.exports = router;
