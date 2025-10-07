const { success, failure } = require("../utils/respond");
const {
  createModuleSchema,
  updateModuleSchema,
} = require("../validators/module-validator");

// helper: generate slug from title
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// GET /api/v1/modules - list modules (published only for non-admin), with pagination and optional search
async function getModules(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limitRaw = parseInt(req.query.limit || "10", 10);
    const limit = Math.min(Math.max(limitRaw, 1), 100);
    const search = (req.query.search || "").trim();

    const isAdmin =
      req.profile && ["admin", "superadmin"].includes(req.profile.role);
    const sb = req.supabase; // anon or user client

    let query = sb
      .from("modules")
      .select(
        "id, title, slug, description, published, created_at, updated_at, duration_label, duration_minutes, lessons, difficulty, category",
        {
          count: "exact",
        }
      )
      .order("created_at", { ascending: false });

    if (!isAdmin) query = query.eq("published", true);
    if (search) {
      const escaped = search.replace(/%/g, "");
      query = query.or(
        `title.ilike.%${escaped}%,description.ilike.%${escaped}%`
      );
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await query.range(from, to);
    if (error) {
      return failure(
        res,
        "MODULE_FETCH_ERROR",
        "Failed to fetch modules",
        500,
        { details: error.message }
      );
    }
    const total = count || 0;
    return success(
      res,
      "MODULE_FETCH_SUCCESS",
      "Modules retrieved successfully",
      {
        items: data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1,
        },
      }
    );
  } catch (e) {
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: e.message,
    });
  }
}

// GET /api/v1/modules/:id - detail module + nested materials (published filtering for non-admin)
async function getModuleById(req, res) {
  try {
    const { id } = req.params;
    const isAdmin =
      req.profile && ["admin", "superadmin"].includes(req.profile.role);
    const sb = req.supabase;

    const { data: module, error: modErr } = await sb
      .from("modules")
      .select(
        "id, title, slug, description, published, created_at, updated_at, duration_label, duration_minutes, lessons, difficulty, category"
      )
      .eq("id", id)
      .maybeSingle();
    if (modErr) {
      return failure(res, "MODULE_FETCH_ERROR", "Failed to fetch module", 500, {
        details: modErr.message,
      });
    }
    if (!module) {
      return failure(res, "MODULE_NOT_FOUND", "Module not found", 404);
    }

    // fetch materials under this module (best-effort)
    let materials = [];
    try {
      let mQuery = sb
        .from("sub_materis")
        .select(
          "id, title, content, published, created_at, updated_at, order_index"
        )
        .eq("module_id", id)
        .order("order_index", { ascending: true });
      if (!isAdmin) mQuery = mQuery.eq("published", true);
      const mRes = await mQuery;
      if (mRes.error) {
        const msg = (mRes.error.message || "").toLowerCase();
        // Fallback: if module_id column doesn't exist yet in materials (early schema), return empty list instead of 500
        if (
          msg.includes("module_id") &&
          (msg.includes("does not exist") || msg.includes("column"))
        ) {
          materials = [];
        } else {
          return failure(
            res,
            "MODULE_MATERIALS_FETCH_ERROR",
            "Failed to fetch module materials",
            500,
            { details: mRes.error.message }
          );
        }
      } else {
        materials = mRes.data || [];
      }
    } catch (mErr) {
      // Any unexpected error -> fail gracefully
      return failure(
        res,
        "MODULE_MATERIALS_FETCH_ERROR",
        "Failed to fetch module materials",
        500,
        { details: mErr.message }
      );
    }

    return success(
      res,
      "MODULE_DETAIL_SUCCESS",
      "Module retrieved successfully",
      { ...module, materials }
    );
  } catch (e) {
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: e.message,
    });
  }
}

// POST /api/v1/modules - admin only
async function createModule(req, res) {
  try {
    const { error: valErr, value } = createModuleSchema.validate(
      req.body || {}
    );
    if (valErr) {
      return failure(
        res,
        "MODULE_VALIDATION_ERROR",
        valErr.details[0].message,
        422
      );
    }
    const sb = req.supabaseAdmin || req.supabase; // prefer service role for admin ops
    // ensure slug
    const baseSlug = generateSlug(value.title);
    let slug = baseSlug || `module-${Date.now()}`;
    try {
      const { data: existingSlug } = await sb
        .from("modules")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (existingSlug) slug = `${slug}-${Date.now()}`;
    } catch (_) {}

    const { data, error } = await sb
      .from("modules")
      .insert({
        title: value.title,
        slug,
        description: value.description ?? "",
        published: value.published ?? false,
        duration_label: value.duration_label || null,
        duration_minutes: value.duration_minutes || null,
        lessons: value.lessons || null,
        difficulty: value.difficulty || null,
        category: value.category || null,
      })
      .select(
        "id, title, slug, description, published, created_at, updated_at, duration_label, duration_minutes, lessons, difficulty, category"
      )
      .single();
    if (error) {
      console.error("[MODULES] Create error:", error);
      return failure(
        res,
        "MODULE_CREATE_ERROR",
        "Failed to create module",
        500,
        { details: error.message }
      );
    }
    return success(res, "MODULE_CREATE_SUCCESS", "Module created", data, 201);
  } catch (e) {
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: e.message,
    });
  }
}

// PUT /api/v1/modules/:id - admin only
async function updateModule(req, res) {
  try {
    const { id } = req.params;
    const { error: valErr, value } = updateModuleSchema.validate(
      req.body || {}
    );
    if (valErr) {
      return failure(
        res,
        "MODULE_VALIDATION_ERROR",
        valErr.details[0].message,
        422
      );
    }
    const sb = req.supabaseAdmin || req.supabase;
    const { data: existing, error: fErr } = await sb
      .from("modules")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (fErr) {
      return failure(res, "MODULE_FETCH_ERROR", "Failed to fetch module", 500, {
        details: fErr.message,
      });
    }
    if (!existing)
      return failure(res, "MODULE_NOT_FOUND", "Module not found", 404);

    const payload = { ...value, updated_at: new Date().toISOString() };
    const { data, error } = await sb
      .from("modules")
      .update(payload)
      .eq("id", id)
      .select(
        "id, title, slug, description, published, created_at, updated_at, duration_label, duration_minutes, lessons, difficulty, category"
      )
      .single();
    if (error) {
      console.error("[MODULES] Update error:", error);
      return failure(
        res,
        "MODULE_UPDATE_ERROR",
        "Failed to update module",
        500,
        { details: error.message }
      );
    }
    return success(res, "MODULE_UPDATE_SUCCESS", "Module updated", data);
  } catch (e) {
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: e.message,
    });
  }
}

// DELETE /api/v1/modules/:id - admin only
async function deleteModule(req, res) {
  try {
    const { id } = req.params;
    const sb = req.supabaseAdmin || req.supabase;
    const { data: existing, error: fErr } = await sb
      .from("modules")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (fErr) {
      return failure(res, "MODULE_FETCH_ERROR", "Failed to fetch module", 500, {
        details: fErr.message,
      });
    }
    if (!existing)
      return failure(res, "MODULE_NOT_FOUND", "Module not found", 404);

    const { error } = await sb.from("modules").delete().eq("id", id);
    if (error) {
      console.error("[MODULES] Delete error:", error);
      return failure(
        res,
        "MODULE_DELETE_ERROR",
        "Failed to delete module",
        500,
        { details: error.message }
      );
    }
    return success(res, "MODULE_DELETE_SUCCESS", "Module deleted", { id });
  } catch (e) {
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: e.message,
    });
  }
}

module.exports = {
  getModules,
  getModuleById,
  createModule,
  updateModule,
  deleteModule,
};
