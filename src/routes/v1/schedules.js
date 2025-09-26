const express = require("express");
const {
  getAllSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} = require("../../controllers/schedule-controller");
const authMiddleware = require("../../middlewares/auth-middleware");
const { requireAdmin } = require("../../middlewares/role-middleware");

const router = express.Router();

// Public schedules list
router.get("/", getAllSchedules);

// Admin CRUD for schedules
router.post("/", authMiddleware, requireAdmin, createSchedule);
router.put("/:id", authMiddleware, requireAdmin, updateSchedule);
router.delete("/:id", authMiddleware, requireAdmin, deleteSchedule);

module.exports = router;
