const Joi = require("joi");
const { success, failure } = require("../utils/respond");

// Validation schemas
const materialSchema = Joi.object({
  title: Joi.string().trim().min(3).max(200).required(),
  slug: Joi.string()
    .trim()
    .pattern(/^[a-z0-9-]+$/)
    .max(200)
    .optional(),
  content: Joi.string().trim().min(10).required(),
  published: Joi.boolean().default(false),
});

const materialUpdateSchema = Joi.object({
  title: Joi.string().trim().min(3).max(200).optional(),
  slug: Joi.string()
    .trim()
    .pattern(/^[a-z0-9-]+$/)
    .max(200)
    .optional(),
  content: Joi.string().trim().min(10).optional(),
  published: Joi.boolean().optional(),
});

// Helper function to generate slug from title
const generateSlug = (title) => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim("-");
};

// GET /api/v1/materials/public - strictly published materials (RLS + explicit filter)
// Optional query: slug
const getPublicMaterials = async (req, res) => {
  try {
    const slug = (req.query.slug || "").trim();
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limitRaw = parseInt(req.query.limit || "10", 10);
    const limit = Math.min(Math.max(limitRaw, 1), 100);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Force anon client to rely on RLS; fallback to req.supabase if already anon
    const sb = req.supabaseAnon || req.supabase;
    let query = sb
      .from("materials")
      .select(
        `id, title, slug, content, published, created_at, updated_at, profiles:author ( full_name )`,
        { count: "exact" }
      )
      .eq("published", true)
      .order("created_at", { ascending: false });

    if (slug) {
      query = query.eq("slug", slug);
    }

    let { data, error, count } = await query.range(from, to);
    if (error && error.code === "PGRST200") {
      // Fallback: remove relationship if schema missing FK for tests / early DB state
      try {
        const fallbackQuery = sb
          .from("materials")
          .select(
            `id, title, slug, content, published, created_at, updated_at`,
            { count: "exact" }
          )
          .eq("published", true)
          .order("created_at", { ascending: false });
        if (slug) fallbackQuery.eq("slug", slug);
        const fallback = await fallbackQuery.range(from, to);
        data = fallback.data;
        error = fallback.error;
        count = fallback.count;
      } catch (fbErr) {
        console.error("Public materials fallback error:", fbErr);
      }
    }
    if (error) {
      console.error("Get public materials error:", error);
      return failure(
        res,
        "MATERIAL_PUBLIC_FETCH_ERROR",
        "Failed to fetch public materials",
        500
      );
    }

    const total = count || 0;
    return success(
      res,
      "MATERIAL_PUBLIC_FETCH_SUCCESS",
      "Public materials retrieved successfully",
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
        filters: slug ? { slug } : undefined,
      }
    );
  } catch (e) {
    console.error("Public materials controller error:", e);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500);
  }
};

// GET /api/v1/materials - Public/Authenticated list with pagination & search
// Query params: page (default 1), limit (default 10, max 100), search (title/content), published (admin only override)
const getAllMaterials = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limitRaw = parseInt(req.query.limit || "10", 10);
    const limit = Math.min(Math.max(limitRaw, 1), 100);
    const search = (req.query.search || "").trim();
    const publishedFilter = req.query.published; // only respected for admin
    const isAdmin =
      req.profile && ["admin", "superadmin"].includes(req.profile.role);

    const sb = req.supabase; // provided by middleware (user client or anon)

    let query = sb
      .from("materials")
      .select(
        `id, title, slug, content, published, created_at, updated_at, profiles:author ( full_name )`,
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    // Non-admin: only published (RLS should already enforce but we double filter for clarity)
    if (!isAdmin) {
      query = query.eq("published", true);
    } else if (publishedFilter !== undefined) {
      query = query.eq("published", publishedFilter === "true");
    }

    if (search) {
      // Basic case-insensitive search on title & content
      const escaped = search.replace(/%/g, "");
      query = query.or(`title.ilike.%${escaped}%,content.ilike.%${escaped}%`);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    let { data, error, count } = await query.range(from, to);

    if (error && error.code === "PGRST200") {
      // Fallback without relationship (author) for environments lacking FK
      try {
        let fbQuery = sb
          .from("materials")
          .select(
            `id, title, slug, content, published, created_at, updated_at`,
            { count: "exact" }
          )
          .order("created_at", { ascending: false });
        if (!isAdmin) {
          fbQuery = fbQuery.eq("published", true);
        } else if (publishedFilter !== undefined) {
          fbQuery = fbQuery.eq("published", publishedFilter === "true");
        }
        if (search) {
          const escaped = search.replace(/%/g, "");
          fbQuery = fbQuery.or(
            `title.ilike.%${escaped}%,content.ilike.%${escaped}%`
          );
        }
        const fbRes = await fbQuery.range(from, to);
        data = fbRes.data;
        error = fbRes.error;
        count = fbRes.count;
      } catch (fbErr) {
        console.error("Materials fallback error:", fbErr);
      }
    }

    if (error) {
      console.error("Get materials error:", error);
      return failure(
        res,
        "MATERIAL_FETCH_ERROR",
        "Failed to fetch materials",
        500
      );
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);
    return success(
      res,
      "MATERIAL_FETCH_SUCCESS",
      "Materials retrieved successfully",
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
      }
    );
  } catch (error) {
    console.error("Material controller error (list):", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500);
  }
};

// GET /api/v1/materials/:slug - Public detail (published) or admin/author can view draft
const getMaterialBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user?.id;
    const userRole = req.profile?.role;
    const isAdmin = userRole && ["admin", "superadmin"].includes(userRole);
    const sb = req.supabase;

    // Fetch material by slug first (no published restriction to check author/admin)
    const { data: material, error } = await sb
      .from("materials")
      .select(
        `id, title, slug, content, published, author, created_at, updated_at, profiles:author ( full_name )`
      )
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      console.error("Material fetch error:", error);
      return failure(
        res,
        "MATERIAL_FETCH_ERROR",
        "Failed to fetch material",
        500
      );
    }
    if (!material) {
      return failure(res, "MATERIAL_NOT_FOUND", "Material not found", 404);
    }

    const isAuthor = userId && material.author === userId;
    if (!material.published && !isAdmin && !isAuthor) {
      return failure(
        res,
        "MATERIAL_NOT_PUBLISHED",
        "Material not published",
        403
      );
    }

    // Optionally aggregate sections & media if those tables exist (best-effort)
    let sections = [];
    let media = [];
    try {
      const { data: secData, error: secErr } = await sb
        .from("material_sections")
        .select("id, title, body, position")
        .eq("material_id", material.id)
        .order("position", { ascending: true });
      if (!secErr && secData) sections = secData;
    } catch (e) {
      // ignore if table absent
    }
    try {
      const { data: mediaData, error: mediaErr } = await sb
        .from("material_media")
        .select("id, url, type, position, caption")
        .eq("material_id", material.id)
        .order("position", { ascending: true });
      if (!mediaErr && mediaData) media = mediaData;
    } catch (e) {
      // ignore
    }

    return success(
      res,
      "MATERIAL_DETAIL_SUCCESS",
      "Material retrieved successfully",
      {
        ...material,
        sections,
        media,
      }
    );
  } catch (error) {
    console.error("Material controller error (detail):", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500);
  }
};

// POST /api/admin/materials - Create material (admin only)
const createMaterial = async (req, res) => {
  try {
    const { error, value } = materialSchema.validate(req.body);
    if (error) {
      return failure(
        res,
        "MATERIAL_VALIDATION_ERROR",
        error.details[0].message,
        400
      );
    }

    const { title, content, published } = value;
    let { slug } = value;

    // Generate slug if not provided
    if (!slug) {
      slug = generateSlug(title);
    }

    const author = req.user.id;

    // Check if slug already exists
    const sb = req.supabase;

    const { data: existingMaterial } = await sb
      .from("materials")
      .select("id")
      .eq("slug", slug)
      .single();

    if (existingMaterial) {
      return failure(
        res,
        "MATERIAL_SLUG_EXISTS",
        "Material with this slug already exists",
        400
      );
    }

    const { data, error: insertError } = await sb
      .from("materials")
      .insert({
        title,
        slug,
        content,
        published,
        author,
      })
      .select(
        `
        id,
        title,
        slug,
        content,
        published,
        created_at,
        updated_at,
        profiles:author (
          full_name
        )
      `
      )
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return failure(
          res,
          "MATERIAL_SLUG_EXISTS",
          "Material with this slug already exists",
          400
        );
      }
      console.error("Create material error:", insertError);
      return failure(
        res,
        "MATERIAL_CREATE_ERROR",
        "Failed to create material",
        500
      );
    }

    return success(
      res,
      "MATERIAL_CREATE_SUCCESS",
      "Material created successfully",
      data,
      201
    );
  } catch (error) {
    console.error("Material controller error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500);
  }
};

// PUT /api/admin/materials/:id - Update material (admin only)
const updateMaterial = async (req, res) => {
  try {
    const { id } = req.params;

    const { error, value } = materialUpdateSchema.validate(req.body);
    if (error) {
      return failure(
        res,
        "MATERIAL_VALIDATION_ERROR",
        error.details[0].message,
        400
      );
    }

    // Check if material exists
    const sb = req.supabase;
    const { data: existingMaterial, error: fetchError } = await sb
      .from("materials")
      .select("id, slug")
      .eq("id", id)
      .single();

    if (fetchError || !existingMaterial) {
      return failure(res, "MATERIAL_NOT_FOUND", "Material not found", 404);
    }

    // Check slug uniqueness if changing slug
    if (value.slug && value.slug !== existingMaterial.slug) {
      const { data: slugExists } = await sb
        .from("materials")
        .select("id")
        .eq("slug", value.slug)
        .neq("id", id)
        .single();

      if (slugExists) {
        return failure(
          res,
          "MATERIAL_SLUG_EXISTS",
          "Material with this slug already exists",
          400
        );
      }
    }

    // Update updated_at timestamp
    const updateData = {
      ...value,
      updated_at: new Date().toISOString(),
    };

    const { data, error: updateError } = await sb
      .from("materials")
      .update(updateData)
      .eq("id", id)
      .select(
        `
        id,
        title,
        slug,
        content,
        published,
        created_at,
        updated_at,
        profiles:author (
          full_name
        )
      `
      )
      .single();

    if (updateError) {
      if (updateError.code === "23505") {
        return failure(
          res,
          "MATERIAL_SLUG_EXISTS",
          "Material with this slug already exists",
          400
        );
      }
      console.error("Update material error:", updateError);
      return failure(
        res,
        "MATERIAL_UPDATE_ERROR",
        "Failed to update material",
        500
      );
    }

    return success(
      res,
      "MATERIAL_UPDATE_SUCCESS",
      "Material updated successfully",
      data
    );
  } catch (error) {
    console.error("Material controller error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500);
  }
};

// DELETE /api/admin/materials/:id - Delete material (admin only)
const deleteMaterial = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if material exists
    const sb = req.supabase || supabaseAnon;
    const { data: existingMaterial, error: fetchError } = await sb
      .from("materials")
      .select("id")
      .eq("id", id)
      .single();

    if (fetchError || !existingMaterial) {
      return failure(res, "MATERIAL_NOT_FOUND", "Material not found", 404);
    }

    const { error: deleteError } = await sb
      .from("materials")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete material error:", deleteError);
      return failure(
        res,
        "MATERIAL_DELETE_ERROR",
        "Failed to delete material",
        500
      );
    }

    return success(
      res,
      "MATERIAL_DELETE_SUCCESS",
      "Material deleted successfully"
    );
  } catch (error) {
    console.error("Material controller error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500);
  }
};

module.exports = {
  getAllMaterials,
  getMaterialBySlug,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  getPublicMaterials,
};
