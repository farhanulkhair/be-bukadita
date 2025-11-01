const { success, failure } = require("../utils/respond");

// Import validation schemas from validator
const {
  createNoteSchema,
  updateNoteSchema,
  searchNotesSchema,
} = require("../validators/notes-validator");

// Helper function to format note response
const formatNoteResponse = (note) => {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    pinned: note.pinned,
    archived: note.archived,
    created_at: note.created_at,
    updated_at: note.updated_at,
  };
};

// GET /api/v1/notes - Get user's notes with search and filters
const getAllNotes = async (req, res) => {
  try {
    const { error, value } = searchNotesSchema.validate(req.query);
    if (error) {
      return failure(
        res,
        "NOTES_VALIDATION_ERROR",
        error.details[0].message,
        422
      );
    }

    const { q, pinned, archived, page, limit } = value;
    const offset = (page - 1) * limit;
    const userId = req.user?.id;

    if (!userId) {
      return failure(res, "UNAUTHORIZED", "User ID tidak ditemukan", 401);
    }

    const sb = req.supabase;

    // Build base query
    let query = sb
      .from("notes")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("pinned", { ascending: false }) // Pinned notes first
      .order("updated_at", { ascending: false }); // Then by last updated

    // Apply filters
    if (pinned !== undefined) {
      query = query.eq("pinned", pinned === "true");
    }

    if (archived !== undefined) {
      query = query.eq("archived", archived === "true");
    } else {
      // By default, don't show archived notes unless explicitly requested
      query = query.eq("archived", false);
    }

    // Apply full-text search if query provided
    if (q && q.trim()) {
      query = query.textSearch("title,content", `'${q.trim()}'`);
    }

    // Get total count for pagination
    const { count } = await sb
      .from("notes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    // Get paginated results
    const { data: notes, error: fetchError } = await query.range(
      offset,
      offset + limit - 1
    );

    if (fetchError) {
      console.error("Fetch notes error:", fetchError);
      return failure(res, "NOTES_FETCH_ERROR", "Gagal mengambil notes", 500, {
        details: fetchError.message,
      });
    }

    const formattedNotes = notes?.map(formatNoteResponse) || [];

    return success(res, "NOTES_FETCH_SUCCESS", "Notes berhasil diambil", {
      notes: formattedNotes,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasNextPage: offset + limit < (count || 0),
        hasPrevPage: page > 1,
      },
      filters: {
        search: q || null,
        pinned: pinned ? pinned === "true" : null,
        archived: archived ? archived === "true" : false,
      },
    });
  } catch (error) {
    console.error("Notes controller error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// GET /api/v1/notes/:id - Get specific note
const getNoteById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return failure(res, "UNAUTHORIZED", "User ID tidak ditemukan", 401);
    }

    const sb = req.supabase;

    const { data: note, error: fetchError } = await sb
      .from("notes")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (fetchError || !note) {
      return failure(res, "NOTE_NOT_FOUND", "Note tidak ditemukan", 404);
    }

    return success(
      res,
      "NOTE_FETCH_SUCCESS",
      "Note berhasil diambil",
      formatNoteResponse(note)
    );
  } catch (error) {
    console.error("Notes controller error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// POST /api/v1/notes - Create new note
const createNote = async (req, res) => {
  try {
    const { error, value } = createNoteSchema.validate(req.body);
    if (error) {
      return failure(
        res,
        "NOTE_VALIDATION_ERROR",
        error.details[0].message,
        422
      );
    }

    const userId = req.user?.id;
    if (!userId) {
      return failure(res, "UNAUTHORIZED", "User ID tidak ditemukan", 401);
    }

    const sb = req.supabase;

    const noteData = {
      ...value,
      user_id: userId,
      updated_at: new Date().toISOString(),
    };

    const { data: newNote, error: insertError } = await sb
      .from("notes")
      .insert([noteData])
      .select("*")
      .single();

    if (insertError) {
      console.error("Create note error:", insertError);
      return failure(res, "NOTE_CREATE_ERROR", "Gagal membuat note", 500, {
        details: insertError.message,
      });
    }

    return success(
      res,
      "NOTE_CREATE_SUCCESS",
      "Note berhasil dibuat",
      formatNoteResponse(newNote),
      201
    );
  } catch (error) {
    console.error("Notes controller error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// PUT /api/v1/notes/:id - Update note
const updateNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = updateNoteSchema.validate(req.body);

    if (error) {
      return failure(
        res,
        "NOTE_VALIDATION_ERROR",
        error.details[0].message,
        422
      );
    }

    const userId = req.user?.id;
    if (!userId) {
      return failure(res, "UNAUTHORIZED", "User ID tidak ditemukan", 401);
    }

    const sb = req.supabase;

    // Check if note exists and belongs to user
    const { data: existingNote, error: fetchError } = await sb
      .from("notes")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (fetchError || !existingNote) {
      return failure(res, "NOTE_NOT_FOUND", "Note tidak ditemukan", 404);
    }

    // Update note
    const updateData = {
      ...value,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedNote, error: updateError } = await sb
      .from("notes")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (updateError) {
      console.error("Update note error:", updateError);
      return failure(res, "NOTE_UPDATE_ERROR", "Gagal memperbarui note", 500, {
        details: updateError.message,
      });
    }

    return success(
      res,
      "NOTE_UPDATE_SUCCESS",
      "Note berhasil diperbarui",
      formatNoteResponse(updatedNote)
    );
  } catch (error) {
    console.error("Notes controller error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// DELETE /api/v1/notes/:id - Delete note
const deleteNote = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return failure(res, "UNAUTHORIZED", "User ID tidak ditemukan", 401);
    }

    const sb = req.supabase;

    // Check if note exists and belongs to user
    const { data: existingNote, error: fetchError } = await sb
      .from("notes")
      .select("id, title")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (fetchError || !existingNote) {
      return failure(res, "NOTE_NOT_FOUND", "Note tidak ditemukan", 404);
    }

    // Delete note
    const { error: deleteError } = await sb
      .from("notes")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (deleteError) {
      console.error("Delete note error:", deleteError);
      return failure(res, "NOTE_DELETE_ERROR", "Gagal menghapus note", 500, {
        details: deleteError.message,
      });
    }

    return success(res, "NOTE_DELETE_SUCCESS", "Note berhasil dihapus", {
      deletedId: id,
      title: existingNote.title,
    });
  } catch (error) {
    console.error("Notes controller error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// POST /api/v1/notes/:id/toggle-pin - Toggle pin status
const togglePin = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return failure(res, "UNAUTHORIZED", "User ID tidak ditemukan", 401);
    }

    const sb = req.supabase;

    // Get current note
    const { data: currentNote, error: fetchError } = await sb
      .from("notes")
      .select("id, pinned, title")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (fetchError || !currentNote) {
      return failure(res, "NOTE_NOT_FOUND", "Note tidak ditemukan", 404);
    }

    // Toggle pin status
    const newPinnedStatus = !currentNote.pinned;

    const { data: updatedNote, error: updateError } = await sb
      .from("notes")
      .update({
        pinned: newPinnedStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (updateError) {
      console.error("Toggle pin error:", updateError);
      return failure(res, "NOTE_PIN_ERROR", "Gagal mengubah status pin", 500, {
        details: updateError.message,
      });
    }

    return success(
      res,
      "NOTE_PIN_SUCCESS",
      `Note berhasil ${newPinnedStatus ? "di-pin" : "di-unpin"}`,
      formatNoteResponse(updatedNote)
    );
  } catch (error) {
    console.error("Notes controller error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// POST /api/v1/notes/:id/toggle-archive - Toggle archive status
const toggleArchive = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return failure(res, "UNAUTHORIZED", "User ID tidak ditemukan", 401);
    }

    const sb = req.supabase;

    // Get current note
    const { data: currentNote, error: fetchError } = await sb
      .from("notes")
      .select("id, archived, title")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (fetchError || !currentNote) {
      return failure(res, "NOTE_NOT_FOUND", "Note tidak ditemukan", 404);
    }

    // Toggle archive status
    const newArchivedStatus = !currentNote.archived;

    const { data: updatedNote, error: updateError } = await sb
      .from("notes")
      .update({
        archived: newArchivedStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (updateError) {
      console.error("Toggle archive error:", updateError);
      return failure(
        res,
        "NOTE_ARCHIVE_ERROR",
        "Gagal mengubah status arsip",
        500,
        {
          details: updateError.message,
        }
      );
    }

    return success(
      res,
      "NOTE_ARCHIVE_SUCCESS",
      `Note berhasil ${newArchivedStatus ? "diarsipkan" : "dipulihkan"}`,
      formatNoteResponse(updatedNote)
    );
  } catch (error) {
    console.error("Notes controller error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

module.exports = {
  getAllNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  togglePin,
  toggleArchive,
};
