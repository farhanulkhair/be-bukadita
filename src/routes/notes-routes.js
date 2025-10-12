const express = require("express");
const router = express.Router();

// Import controllers
const {
  getAllNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  togglePin,
  toggleArchive,
} = require("../controllers/notes-controller");

// Import middlewares
const authMiddleware = require("../middlewares/auth-middleware");

// Apply auth middleware to all routes
router.use(authMiddleware);

// Notes CRUD routes
router.get("/", getAllNotes); // GET /api/v1/notes
router.post("/", createNote); // POST /api/v1/notes
router.get("/:id", getNoteById); // GET /api/v1/notes/:id
router.put("/:id", updateNote); // PUT /api/v1/notes/:id
router.delete("/:id", deleteNote); // DELETE /api/v1/notes/:id

// Notes action routes
router.post("/:id/toggle-pin", togglePin); // POST /api/v1/notes/:id/toggle-pin
router.post("/:id/toggle-archive", toggleArchive); // POST /api/v1/notes/:id/toggle-archive

module.exports = router;
