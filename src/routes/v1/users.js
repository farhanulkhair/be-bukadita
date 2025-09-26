const express = require("express");
const authMiddleware = require("../../middlewares/auth-middleware");
const {
  getMyProfile,
  updateMyProfile,
} = require("../../controllers/user-controller");

const router = express.Router();

router.get("/me", authMiddleware, getMyProfile);
router.put("/me", authMiddleware, updateMyProfile);

module.exports = router;
