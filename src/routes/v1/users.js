const express = require("express");
const authMiddleware = require("../../middlewares/auth-middleware");
const {
  getMyProfile,
  updateMyProfile,
  uploadProfilePhoto,
  deleteProfilePhoto,
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

module.exports = router;
