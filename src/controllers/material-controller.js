const { supabase } = require("../lib/SupabaseClient");
const Joi = require("joi");

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

// GET /api/pengguna/materials - Get materials (published only for users)
const getAllMaterials = async (req, res) => {
  try {
    const { published } = req.query;
    const isAdmin = req.profile && req.profile.role === "admin";

    let query = supabase
      .from("materials")
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
      .order("created_at", { ascending: false });

    // If not admin, only show published materials
    if (!isAdmin) {
      query = query.eq("published", true);
    } else if (published !== undefined) {
      // Admin can filter by published status
      query = query.eq("published", published === "true");
    }

    const { data, error } = await query;

    if (error) {
      console.error("Get materials error:", error);
      return res.status(500).json({
        error: {
          message: "Failed to fetch materials",
          code: "FETCH_ERROR",
        },
      });
    }

    res.status(200).json({
      message: "Materials retrieved successfully",
      data,
    });
  } catch (error) {
    console.error("Material controller error:", error);
    res.status(500).json({
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
    });
  }
};

// GET /api/pengguna/materials/:id - Get material by ID
const getMaterialById = async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.profile && req.profile.role === "admin";

    let query = supabase
      .from("materials")
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
      .eq("id", id);

    // If not admin, only show if published
    if (!isAdmin) {
      query = query.eq("published", true);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return res.status(404).json({
        error: {
          message: "Material not found",
          code: "NOT_FOUND",
        },
      });
    }

    res.status(200).json({
      message: "Material retrieved successfully",
      data,
    });
  } catch (error) {
    console.error("Material controller error:", error);
    res.status(500).json({
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
    });
  }
};

// POST /api/admin/materials - Create material (admin only)
const createMaterial = async (req, res) => {
  try {
    const { error, value } = materialSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          message: error.details[0].message,
          code: "VALIDATION_ERROR",
        },
      });
    }

    const { title, content, published } = value;
    let { slug } = value;

    // Generate slug if not provided
    if (!slug) {
      slug = generateSlug(title);
    }

    const author = req.user.id;

    // Check if slug already exists
    const { data: existingMaterial } = await supabase
      .from("materials")
      .select("id")
      .eq("slug", slug)
      .single();

    if (existingMaterial) {
      return res.status(400).json({
        error: {
          message: "Material with this slug already exists",
          code: "SLUG_EXISTS",
        },
      });
    }

    const { data, error: insertError } = await supabase
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
      console.error("Create material error:", insertError);
      return res.status(500).json({
        error: {
          message: "Failed to create material",
          code: "CREATION_ERROR",
        },
      });
    }

    res.status(201).json({
      message: "Material created successfully",
      data,
    });
  } catch (error) {
    console.error("Material controller error:", error);
    res.status(500).json({
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
    });
  }
};

// PUT /api/admin/materials/:id - Update material (admin only)
const updateMaterial = async (req, res) => {
  try {
    const { id } = req.params;

    const { error, value } = materialUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          message: error.details[0].message,
          code: "VALIDATION_ERROR",
        },
      });
    }

    // Check if material exists
    const { data: existingMaterial, error: fetchError } = await supabase
      .from("materials")
      .select("id, slug")
      .eq("id", id)
      .single();

    if (fetchError || !existingMaterial) {
      return res.status(404).json({
        error: {
          message: "Material not found",
          code: "NOT_FOUND",
        },
      });
    }

    // Check slug uniqueness if changing slug
    if (value.slug && value.slug !== existingMaterial.slug) {
      const { data: slugExists } = await supabase
        .from("materials")
        .select("id")
        .eq("slug", value.slug)
        .neq("id", id)
        .single();

      if (slugExists) {
        return res.status(400).json({
          error: {
            message: "Material with this slug already exists",
            code: "SLUG_EXISTS",
          },
        });
      }
    }

    // Update updated_at timestamp
    const updateData = {
      ...value,
      updated_at: new Date().toISOString(),
    };

    const { data, error: updateError } = await supabase
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
      console.error("Update material error:", updateError);
      return res.status(500).json({
        error: {
          message: "Failed to update material",
          code: "UPDATE_ERROR",
        },
      });
    }

    res.status(200).json({
      message: "Material updated successfully",
      data,
    });
  } catch (error) {
    console.error("Material controller error:", error);
    res.status(500).json({
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
    });
  }
};

// DELETE /api/admin/materials/:id - Delete material (admin only)
const deleteMaterial = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if material exists
    const { data: existingMaterial, error: fetchError } = await supabase
      .from("materials")
      .select("id")
      .eq("id", id)
      .single();

    if (fetchError || !existingMaterial) {
      return res.status(404).json({
        error: {
          message: "Material not found",
          code: "NOT_FOUND",
        },
      });
    }

    const { error: deleteError } = await supabase
      .from("materials")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete material error:", deleteError);
      return res.status(500).json({
        error: {
          message: "Failed to delete material",
          code: "DELETE_ERROR",
        },
      });
    }

    res.status(200).json({
      message: "Material deleted successfully",
    });
  } catch (error) {
    console.error("Material controller error:", error);
    res.status(500).json({
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
    });
  }
};

module.exports = {
  getAllMaterials,
  getMaterialById,
  createMaterial,
  updateMaterial,
  deleteMaterial,
};
