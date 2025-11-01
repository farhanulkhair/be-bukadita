const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middlewares/auth-middleware");
const {
  getAllNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  togglePin,
  toggleArchive,
} = require("../../controllers/notes-controller");

// ============================================================================
// USER ROUTES (FE - authenticated users can manage their own notes)
// All routes require authentication
// ============================================================================

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/v1/notes - Get all notes for current user
router.get("/", getAllNotes);

// POST /api/v1/notes - Create new note
router.post("/", createNote);

// GET /api/v1/notes/:id - Get note by ID
router.get("/:id", getNoteById);

// PUT /api/v1/notes/:id - Update note
router.put("/:id", updateNote);

// DELETE /api/v1/notes/:id - Delete note
router.delete("/:id", deleteNote);

// POST /api/v1/notes/:id/toggle-pin - Toggle pin status
router.post("/:id/toggle-pin", togglePin);

// POST /api/v1/notes/:id/toggle-archive - Toggle archive status
router.post("/:id/toggle-archive", toggleArchive);

module.exports = router;

