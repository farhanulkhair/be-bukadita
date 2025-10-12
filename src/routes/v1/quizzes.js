const express = require("express");
const authMiddleware = require("../../middlewares/auth-middleware");
const { requireAdmin } = require("../../middlewares/role-middleware");

const router = express.Router();

// NOTE: Quiz management routes have been moved to /admin/quizzes
// This file is kept for backward compatibility or future user-specific quiz endpoints

// Redirect admin quiz operations to admin routes
router.get("/", (req, res) => {
  return res.status(301).json({
    success: false,
    message: "Quiz management has been moved to /api/v1/admin/quizzes",
    redirect: "/api/v1/admin/quizzes",
  });
});

router.get("/:id", (req, res) => {
  return res.status(301).json({
    success: false,
    message: "Quiz detail has been moved to /api/v1/admin/quizzes/:id",
    redirect: `/api/v1/admin/quizzes/${req.params.id}`,
  });
});

// Legacy endpoints - deprecated
router.post("/:id/attempts", (req, res) => {
  return res.status(410).json({
    success: false,
    message:
      "This endpoint has been deprecated. Use /api/v1/materials/:subMateriId/quiz for user quiz access.",
  });
});

router.post("/:id/submit", (req, res) => {
  return res.status(410).json({
    success: false,
    message:
      "This endpoint has been deprecated. Quiz submission will be implemented in future user quiz features.",
  });
});

// Admin routes redirects
router.post("/", (req, res) => {
  return res.status(301).json({
    success: false,
    message: "Quiz creation has been moved to /api/v1/admin/quizzes",
    redirect: "/api/v1/admin/quizzes",
  });
});

router.put("/:id", (req, res) => {
  return res.status(301).json({
    success: false,
    message: "Quiz update has been moved to /api/v1/admin/quizzes/:id",
    redirect: `/api/v1/admin/quizzes/${req.params.id}`,
  });
});

router.delete("/:id", (req, res) => {
  return res.status(301).json({
    success: false,
    message: "Quiz deletion has been moved to /api/v1/admin/quizzes/:id",
    redirect: `/api/v1/admin/quizzes/${req.params.id}`,
  });
});

module.exports = router;
