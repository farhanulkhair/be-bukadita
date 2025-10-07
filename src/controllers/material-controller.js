const Joi = require("joi");
const { success, failure } = require("../utils/respond");
const {
  createSubMateriSchema,
  updateSubMateriSchema,
} = require("../validators/sub-materi-validator");
const {
  createPoinDetailSchema,
  updatePoinDetailSchema,
} = require("../validators/poin-validator");

// Helper function to generate slug from title
const generateSlug = (title) => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim("-");
};

// GET /api/v1/materials/public - strictly published sub_materis (RLS + explicit filter)
// Optional query: module_id
const getPublicMaterials = async (req, res) => {
  try {
    const moduleId = (req.query.module_id || "").trim();
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limitRaw = parseInt(req.query.limit || "10", 10);
    const limit = Math.min(Math.max(limitRaw, 1), 100);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Force anon client to rely on RLS; fallback to req.supabase if already anon
    const sb = req.supabaseAnon || req.supabase;
    let query = sb
      .from("sub_materis")
      .select(
        `id, title, content, module_id, order_index, published, created_at, updated_at`,
        { count: "exact" }
      )
      .eq("published", true)
      .order("order_index", { ascending: true });

    if (moduleId) {
      query = query.eq("module_id", moduleId);
    }

    let { data, error, count } = await query.range(from, to);

    if (error) {
      console.error("Get public materials error:", error);
      return failure(
        res,
        "MATERIAL_PUBLIC_FETCH_ERROR",
        "Gagal mengambil daftar materi public",
        500,
        { details: error.message }
      );
    }

    const total = count || 0;
    return success(
      res,
      "MATERIAL_PUBLIC_FETCH_SUCCESS",
      "Daftar materi public berhasil diambil",
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
        filters: moduleId ? { module_id: moduleId } : undefined,
      }
    );
  } catch (e) {
    console.error("Public materials controller error:", e);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: e.message,
    });
  }
};

// GET /api/v1/materials - List sub_materis dengan search dan filter
// Query params: page, limit, search (judul/deskripsi), published (admin only), module_id
const getAllMaterials = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limitRaw = parseInt(req.query.limit || "10", 10);
    const limit = Math.min(Math.max(limitRaw, 1), 100);
    const search = (req.query.search || "").trim();
    const moduleFilter = (req.query.module_id || "").trim();
    const isAdmin =
      req.profile && ["admin", "superadmin"].includes(req.profile.role);

    // Use admin client for admin users to bypass RLS restrictions
    const sb = isAdmin ? req.supabaseAdmin || req.supabase : req.supabase;

    let query = sb
      .from("sub_materis")
      .select(
        `id, title, content, module_id, order_index, published, created_at, updated_at, modules(id, title)`,
        { count: "exact" }
      )
      .order("order_index", { ascending: true });

    // Non-admin: only published (sama dengan getModules logic)
    if (!isAdmin) {
      query = query.eq("published", true);
    }
    // Admin: tampilkan semua (published & unpublished) - tidak peduli parameter published

    if (moduleFilter) {
      query = query.eq("module_id", moduleFilter);
    }

    if (search) {
      const escaped = search.replace(/%/g, "");
      query = query.or(`title.ilike.%${escaped}%,content.ilike.%${escaped}%`);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    let { data, error, count } = await query.range(from, to);

    if (error) {
      console.error("Get materials error:", error);
      return failure(
        res,
        "MATERIAL_FETCH_ERROR",
        "Gagal mengambil daftar materi",
        500,
        { details: error.message }
      );
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);
    return success(
      res,
      "MATERIAL_FETCH_SUCCESS",
      "Daftar materi berhasil diambil",
      {
        items: data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        filters: {
          module_id: moduleFilter || undefined,
          search: search || undefined,
        },
      }
    );
  } catch (error) {
    console.error("Material controller error (list):", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// GET /api/v1/materials/:id - Detail sub_materi dengan poin-poin pembelajaran
const getMaterialById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.profile?.role;
    const isAdmin = userRole && ["admin", "superadmin"].includes(userRole);
    // Use admin client for admin users to bypass RLS restrictions
    const sb = isAdmin ? req.supabaseAdmin || req.supabase : req.supabase;

    // Fetch sub_materi dengan info module
    const { data: material, error } = await sb
      .from("sub_materis")
      .select(
        `
        id, title, content, module_id, order_index, published, created_at, updated_at,
        modules(id, title, slug)
      `
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Material fetch error:", error);
      return failure(
        res,
        "MATERIAL_FETCH_ERROR",
        "Gagal mengambil detail materi",
        500,
        { details: error.message }
      );
    }

    if (!material) {
      return failure(res, "MATERIAL_NOT_FOUND", "Materi tidak ditemukan", 404);
    }

    // Cek akses untuk non-admin
    if (!material.published && !isAdmin) {
      return failure(
        res,
        "MATERIAL_NOT_PUBLISHED",
        "Materi belum dipublikasi",
        403
      );
    }

    // Fetch poin-poin detail materi
    const { data: poinDetails, error: poinError } = await sb
      .from("poin_details")
      .select(
        "id, title, content_html, order_index, duration_label, duration_minutes, created_at"
      )
      .eq("sub_materi_id", id)
      .order("order_index", { ascending: true });

    if (poinError) {
      console.error("Poin details fetch error:", poinError);
      return failure(
        res,
        "POIN_FETCH_ERROR",
        "Gagal mengambil poin-poin materi",
        500,
        { details: poinError.message }
      );
    }

    // Jika user login, ambil progress-nya
    let userProgress = null;
    if (userId && !isAdmin) {
      // Get progress poin
      const poinIds = poinDetails?.map((p) => p.id) || [];
      const { data: poinProgress } = await sb
        .from("user_poin_progress")
        .select("poin_id, is_completed, completed_at")
        .eq("user_id", userId)
        .in("poin_id", poinIds);

      // Get progress sub_materi
      const { data: subMateriProgress } = await sb
        .from("user_sub_materi_progress")
        .select(
          "is_completed, is_unlocked, current_poin_index, last_accessed_at"
        )
        .eq("user_id", userId)
        .eq("sub_materi_id", id)
        .maybeSingle();

      userProgress = {
        sub_materi_progress: subMateriProgress || {
          completed: false,
          progress_percentage: 0,
        },
        poin_progress: poinProgress || [],
      };
    }

    // Enrichment: tambahkan progress ke setiap poin untuk user
    const enrichedPoinDetails =
      poinDetails?.map((poin) => {
        const progress = userProgress?.poin_progress?.find(
          (pp) => pp.poin_id === poin.id
        );
        return {
          ...poin,
          user_progress: progress || { completed: false },
        };
      }) || [];

    return success(
      res,
      "MATERIAL_DETAIL_SUCCESS",
      "Detail materi berhasil diambil",
      {
        ...material,
        poin_details: enrichedPoinDetails,
        user_progress: userProgress?.sub_materi_progress || null,
      }
    );
  } catch (error) {
    console.error("Material controller error (detail):", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// POST /api/v1/materials - Create sub_materi (admin only)
const createMaterial = async (req, res) => {
  try {
    const { error, value } = createSubMateriSchema.validate(req.body);
    if (error) {
      return failure(
        res,
        "MATERIAL_VALIDATION_ERROR",
        error.details[0].message,
        422
      );
    }

    const sb = req.supabaseAdmin || req.supabase;

    // Cek apakah module exists
    const { data: module, error: moduleError } = await sb
      .from("modules")
      .select("id")
      .eq("id", value.module_id)
      .single();

    if (moduleError || !module) {
      return failure(res, "MODULE_NOT_FOUND", "Module tidak ditemukan", 404);
    }

    // Auto-set order_index jika tidak disediakan
    if (value.order_index === undefined || value.order_index === 0) {
      const { data: lastMaterial } = await sb
        .from("sub_materis")
        .select("order_index")
        .eq("module_id", value.module_id)
        .order("order_index", { ascending: false })
        .limit(1)
        .maybeSingle();

      value.order_index = (lastMaterial?.order_index || 0) + 1;
    }

    const { data, error: insertError } = await sb
      .from("sub_materis")
      .insert({
        title: value.title,
        content: value.content || "",
        module_id: value.module_id,
        order_index: value.order_index,
        published: value.published || false,
      })
      .select(
        `
        id, title, content, module_id, order_index, published, created_at, updated_at
      `
      )
      .single();

    if (insertError) {
      if (insertError.code === "23503") {
        return failure(
          res,
          "MATERIAL_MODULE_NOT_FOUND",
          "Module tidak ditemukan atau tidak valid",
          400,
          { details: insertError.message }
        );
      }
      console.error("Create material error:", insertError);
      return failure(
        res,
        "MATERIAL_CREATE_ERROR",
        "Gagal membuat materi",
        500,
        { details: insertError.message }
      );
    }

    return success(
      res,
      "MATERIAL_CREATE_SUCCESS",
      "Materi berhasil dibuat",
      data,
      201
    );
  } catch (error) {
    console.error("Material controller error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// PUT /api/admin/materials/:id - Update material (admin only)
const updateMaterial = async (req, res) => {
  try {
    const { id } = req.params;

    const { error, value } = updateSubMateriSchema.validate(req.body);
    if (error) {
      return failure(
        res,
        "MATERIAL_VALIDATION_ERROR",
        error.details[0].message,
        422
      );
    }

    const sb = req.supabaseAdmin || req.supabase;

    // Check if material exists
    const { data: existingMaterial, error: fetchError } = await sb
      .from("sub_materis")
      .select("id, module_id, order_index")
      .eq("id", id)
      .single();

    if (fetchError || !existingMaterial) {
      return failure(res, "MATERIAL_NOT_FOUND", "Materi tidak ditemukan", 404);
    }

    // Validate module_id if provided
    if (value.module_id && value.module_id !== existingMaterial.module_id) {
      const { data: module, error: moduleError } = await sb
        .from("modules")
        .select("id")
        .eq("id", value.module_id)
        .single();

      if (moduleError || !module) {
        return failure(res, "MODULE_NOT_FOUND", "Module tidak ditemukan", 404);
      }
    }

    // Handle order_index changes
    let updatePayload = { ...value };

    if (
      value.order_index !== undefined &&
      value.order_index !== existingMaterial.order_index
    ) {
      // Validate order_index doesn't conflict
      const targetModuleId = value.module_id || existingMaterial.module_id;

      const { data: conflictCheck } = await sb
        .from("sub_materis")
        .select("id")
        .eq("module_id", targetModuleId)
        .eq("order_index", value.order_index)
        .neq("id", id)
        .maybeSingle();

      if (conflictCheck) {
        return failure(
          res,
          "ORDER_INDEX_CONFLICT",
          "Order index sudah digunakan dalam module ini",
          409
        );
      }
    }

    const { data, error: updateError } = await sb
      .from("sub_materis")
      .update(updatePayload)
      .eq("id", id)
      .select(
        `
        id, title, content, module_id, order_index, published, created_at, updated_at
      `
      )
      .single();

    if (updateError) {
      console.error("Update material error:", updateError);
      if (updateError.code === "23503") {
        return failure(
          res,
          "MATERIAL_MODULE_NOT_FOUND",
          "Module tidak ditemukan atau tidak valid",
          400,
          { details: updateError.message }
        );
      }
      return failure(
        res,
        "MATERIAL_UPDATE_ERROR",
        "Gagal memperbarui materi",
        500,
        { details: updateError.message }
      );
    }

    return success(
      res,
      "MATERIAL_UPDATE_SUCCESS",
      "Materi berhasil diperbarui",
      data
    );
  } catch (error) {
    console.error("Material controller error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// DELETE /api/v1/materials/:id - Delete sub_materi (admin only)
const deleteMaterial = async (req, res) => {
  try {
    const { id } = req.params;

    const sb = req.supabaseAdmin || req.supabase;

    // Check if material exists and has dependencies
    const { data: existingMaterial, error: fetchError } = await sb
      .from("sub_materis")
      .select(
        `
        id,
        title,
        module_id,
        poin_details(count)
      `
      )
      .eq("id", id)
      .single();

    if (fetchError || !existingMaterial) {
      return failure(res, "MATERIAL_NOT_FOUND", "Materi tidak ditemukan", 404);
    }

    // Check if material has poin_details that should be handled
    const poinCount = existingMaterial.poin_details?.[0]?.count || 0;

    if (poinCount > 0) {
      // Inform admin about cascade delete behavior
      console.log(
        `Deleting sub_materi ${id} will cascade delete ${poinCount} poin details`
      );
    }

    // Check if users have progress on this material
    const { data: progressExists } = await sb
      .from("user_sub_materi_progress")
      .select("id")
      .eq("sub_materi_id", id)
      .limit(1)
      .maybeSingle();

    if (progressExists) {
      return failure(
        res,
        "MATERIAL_HAS_PROGRESS",
        "Tidak dapat menghapus materi yang sudah memiliki progress pengguna. Silakan archive materi dengan set published=false",
        409
      );
    }

    // Delete the material (cascade will handle poin_details and quiz relationships)
    const { error: deleteError } = await sb
      .from("sub_materis")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete material error:", deleteError);
      if (deleteError.code === "23503") {
        return failure(
          res,
          "MATERIAL_DELETE_CONSTRAINT",
          "Tidak dapat menghapus materi karena masih terhubung dengan data lain",
          409,
          { details: deleteError.message }
        );
      }
      return failure(
        res,
        "MATERIAL_DELETE_ERROR",
        "Gagal menghapus materi",
        500,
        { details: deleteError.message }
      );
    }

    return success(res, "MATERIAL_DELETE_SUCCESS", "Materi berhasil dihapus", {
      deletedId: id,
      poinDetailsDeleted: poinCount,
    });
  } catch (error) {
    console.error("Material controller error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

module.exports = {
  getAllMaterials,
  getMaterialById,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  getPublicMaterials,
};
