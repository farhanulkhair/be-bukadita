const { supabase } = require("../lib/SupabaseClient");
const Joi = require("joi");

// Validation schemas
const scheduleSchema = Joi.object({
  title: Joi.string().trim().min(3).max(200).required(),
  description: Joi.string().trim().max(1000).optional(),
  location: Joi.string().trim().max(200).optional(),
  date: Joi.date().iso().required(),
});

const scheduleUpdateSchema = Joi.object({
  title: Joi.string().trim().min(3).max(200).optional(),
  description: Joi.string().trim().max(1000).optional(),
  location: Joi.string().trim().max(200).optional(),
  date: Joi.date().iso().optional(),
});

// GET /api/pengguna/schedules - Get all schedules (public)
const getAllSchedules = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("posyandu_schedules")
      .select(
        `
        id,
        title,
        description,
        location,
        date,
        created_at,
        profiles:created_by (
          full_name
        )
      `
      )
      .order("date", { ascending: true });

    if (error) {
      console.error("Get schedules error:", error);
      return res.status(500).json({
        error: {
          message: "Failed to fetch schedules",
          code: "FETCH_ERROR",
        },
      });
    }

    res.status(200).json({
      message: "Schedules retrieved successfully",
      data,
    });
  } catch (error) {
    console.error("Schedule controller error:", error);
    res.status(500).json({
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
    });
  }
};

// POST /api/admin/schedules - Create schedule (admin only)
const createSchedule = async (req, res) => {
  try {
    const { error, value } = scheduleSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          message: error.details[0].message,
          code: "VALIDATION_ERROR",
        },
      });
    }

    const { title, description, location, date } = value;
    const createdBy = req.user.id;

    const { data, error: insertError } = await supabase
      .from("posyandu_schedules")
      .insert({
        title,
        description,
        location,
        date,
        created_by: createdBy,
      })
      .select(
        `
        id,
        title,
        description,
        location,
        date,
        created_at,
        profiles:created_by (
          full_name
        )
      `
      )
      .single();

    if (insertError) {
      console.error("Create schedule error:", insertError);
      return res.status(500).json({
        error: {
          message: "Failed to create schedule",
          code: "CREATION_ERROR",
        },
      });
    }

    res.status(201).json({
      message: "Schedule created successfully",
      data,
    });
  } catch (error) {
    console.error("Schedule controller error:", error);
    res.status(500).json({
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
    });
  }
};

// PUT /api/admin/schedules/:id - Update schedule (admin only)
const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;

    const { error, value } = scheduleUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          message: error.details[0].message,
          code: "VALIDATION_ERROR",
        },
      });
    }

    // Check if schedule exists
    const { data: existingSchedule, error: fetchError } = await supabase
      .from("posyandu_schedules")
      .select("id")
      .eq("id", id)
      .single();

    if (fetchError || !existingSchedule) {
      return res.status(404).json({
        error: {
          message: "Schedule not found",
          code: "NOT_FOUND",
        },
      });
    }

    const { data, error: updateError } = await supabase
      .from("posyandu_schedules")
      .update(value)
      .eq("id", id)
      .select(
        `
        id,
        title,
        description,
        location,
        date,
        created_at,
        profiles:created_by (
          full_name
        )
      `
      )
      .single();

    if (updateError) {
      console.error("Update schedule error:", updateError);
      return res.status(500).json({
        error: {
          message: "Failed to update schedule",
          code: "UPDATE_ERROR",
        },
      });
    }

    res.status(200).json({
      message: "Schedule updated successfully",
      data,
    });
  } catch (error) {
    console.error("Schedule controller error:", error);
    res.status(500).json({
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
    });
  }
};

// DELETE /api/admin/schedules/:id - Delete schedule (admin only)
const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if schedule exists
    const { data: existingSchedule, error: fetchError } = await supabase
      .from("posyandu_schedules")
      .select("id")
      .eq("id", id)
      .single();

    if (fetchError || !existingSchedule) {
      return res.status(404).json({
        error: {
          message: "Schedule not found",
          code: "NOT_FOUND",
        },
      });
    }

    const { error: deleteError } = await supabase
      .from("posyandu_schedules")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete schedule error:", deleteError);
      return res.status(500).json({
        error: {
          message: "Failed to delete schedule",
          code: "DELETE_ERROR",
        },
      });
    }

    res.status(200).json({
      message: "Schedule deleted successfully",
    });
  } catch (error) {
    console.error("Schedule controller error:", error);
    res.status(500).json({
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
    });
  }
};

module.exports = {
  getAllSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
};
