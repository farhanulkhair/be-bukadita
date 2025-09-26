const express = require("express");

// Sub-routers
const authRouter = require("./auth");
const materialsRouter = require("./materials");
const quizzesRouter = require("./quizzes");
const schedulesRouter = require("./schedules");
const usersRouter = require("./users");
const adminRouter = require("./admin");

const router = express.Router();

// Mount resource routers (all already versioned under /api/v1 in app.js via this index)
router.use("/auth", authRouter);
router.use("/materials", materialsRouter);
router.use("/quizzes", quizzesRouter);
router.use("/schedules", schedulesRouter);
router.use("/users", usersRouter);
router.use("/admin", adminRouter);

module.exports = router;
