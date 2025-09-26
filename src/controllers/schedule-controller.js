const Joi = require("joi");
const { success, failure } = require("../utils/respond");

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
    const sb = req.supabase; // injected by supabase-middleware
    const { data, error } = await sb
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
      return failure(
        res,
        "SCHEDULE_FETCH_ERROR",
        "Failed to fetch schedules",
        500,
        { details: error.message }
      );
    }

    return success(
      res,
      "SCHEDULE_FETCH_SUCCESS",
      "Schedules retrieved successfully",
      { items: data }
    );
  } catch (error) {
    console.error("Schedule controller error:", error);
    return failure(
      res,
      "SCHEDULE_INTERNAL_ERROR",
      "Internal server error",
      500
    );
  }
};

// POST /api/admin/schedules - Create schedule (admin only)
const createSchedule = async (req, res) => {
  try {
    const { error, value } = scheduleSchema.validate(req.body);
    if (error) {
      return failure(
        res,
        "SCHEDULE_VALIDATION_ERROR",
        error.details[0].message,
        400
      );
    }

    const { title, description, location, date } = value;
    const createdBy = req.user.id;

    const sb = req.supabase;
    const { data, error: insertError } = await sb
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
      return failure(
        res,
        "SCHEDULE_CREATE_ERROR",
        "Failed to create schedule",
        500,
        { details: insertError.message }
      );
    }

    return success(
      res,
      "SCHEDULE_CREATE_SUCCESS",
      "Schedule created successfully",
      data,
      201
    );
  } catch (error) {
    console.error("Schedule controller error:", error);
    return failure(
      res,
      "SCHEDULE_INTERNAL_ERROR",
      "Internal server error",
      500
    );
  }
};

// PUT /api/admin/schedules/:id - Update schedule (admin only)
const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;

    const { error, value } = scheduleUpdateSchema.validate(req.body);
    if (error) {
      return failure(
        res,
        "SCHEDULE_VALIDATION_ERROR",
        error.details[0].message,
        400
      );
    }

    // Check if schedule exists
    const sb = req.supabase;
    const { data: existingSchedule, error: fetchError } = await sb
      .from("posyandu_schedules")
      .select("id")
      .eq("id", id)
      .single();

    if (fetchError || !existingSchedule) {
      return failure(res, "SCHEDULE_NOT_FOUND", "Schedule not found", 404);
    }

    const { data, error: updateError } = await sb
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
      return failure(
        res,
        "SCHEDULE_UPDATE_ERROR",
        "Failed to update schedule",
        500,
        { details: updateError.message }
      );
    }

    return success(
      res,
      "SCHEDULE_UPDATE_SUCCESS",
      "Schedule updated successfully",
      data
    );
  } catch (error) {
    console.error("Schedule controller error:", error);
    return failure(
      res,
      "SCHEDULE_INTERNAL_ERROR",
      "Internal server error",
      500
    );
  }
};

// DELETE /api/admin/schedules/:id - Delete schedule (admin only)
const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if schedule exists
    const sb = req.supabase;
    const { data: existingSchedule, error: fetchError } = await sb
      .from("posyandu_schedules")
      .select("id")
      .eq("id", id)
      .single();

    if (fetchError || !existingSchedule) {
      return failure(res, "SCHEDULE_NOT_FOUND", "Schedule not found", 404);
    }

    const { error: deleteError } = await sb
      .from("posyandu_schedules")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete schedule error:", deleteError);
      return failure(
        res,
        "SCHEDULE_DELETE_ERROR",
        "Failed to delete schedule",
        500,
        { details: deleteError.message }
      );
    }

    return success(
      res,
      "SCHEDULE_DELETE_SUCCESS",
      "Schedule deleted successfully"
    );
  } catch (error) {
    console.error("Schedule controller error:", error);
    return failure(
      res,
      "SCHEDULE_INTERNAL_ERROR",
      "Internal server error",
      500
    );
  }
};

module.exports = {
  getAllSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
};
