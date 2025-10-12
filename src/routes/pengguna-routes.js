const express = require("express");
const authMiddleware = require("../middlewares/auth-middleware");
const { getAllSchedules } = require("../controllers/schedule-controller");
const {
  getAllMaterials,
  getMaterialById,
} = require("../controllers/material-controller");

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

// Quizzes routes (authenticated users) - TEMPORARILY DISABLED
// Note: Quiz functionality moved to /materials/:subMateriId/quiz
router.get("/quizzes", (req, res) => {
  return res.status(501).json({
    success: false,
    message:
      "General quiz listing not implemented. Access quizzes through specific materials.",
  });
});

router.get("/quizzes/:id", (req, res) => {
  return res.status(501).json({
    success: false,
    message:
      "Direct quiz access not implemented. Access quizzes through /materials/:subMateriId/quiz",
  });
});

router.post("/quizzes/:quizId/submit", (req, res) => {
  return res.status(501).json({
    success: false,
    message: "Quiz submission feature will be implemented in future updates.",
  });
});

// Self profile routes (authenticated users)
router.get("/profile", authMiddleware, getMyProfile);
router.put("/profile", authMiddleware, updateMyProfile);

module.exports = router;
