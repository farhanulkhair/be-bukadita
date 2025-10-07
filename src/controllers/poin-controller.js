const { success, failure } = require("../utils/respond");
const {
  createPoinDetailSchema,
  updatePoinDetailSchema,
} = require("../validators/poin-validator");
const multer = require("multer");
const path = require("path");

// Helper function to format media response sesuai requirement frontend
const formatMediaResponse = (mediaItem) => {
  return {
    id: mediaItem.id,
    poin_detail_id: mediaItem.poin_id, // Frontend expects poin_detail_id
    original_filename: mediaItem.original_filename || "unknown.jpg",
    mime_type: mediaItem.mime_type || "image/jpeg",
    file_url: mediaItem.url, // Frontend expects file_url
    file_size: mediaItem.file_size || 0,
    caption: mediaItem.caption || "",
    type: mediaItem.type,
    order_index: mediaItem.order_index,
    storage_path: mediaItem.url, // Optional: same as file_url
    created_at: mediaItem.created_at,
    updated_at: mediaItem.updated_at,
  };
};

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images, videos, audio, and PDF
    const allowedTypes = [
      // Images
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
      // Videos
      "video/mp4",
      "video/webm",
      "video/ogg",
      "video/avi",
      "video/mov",
      "video/quicktime",
      // Audio
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/ogg",
      "audio/aac",
      "audio/m4a",
      // Documents
      "application/pdf",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "File type not supported. Allowed: Images (JPEG, PNG, GIF, WebP, SVG), Videos (MP4, WebM, OGG, AVI, MOV), Audio (MP3, WAV, OGG, AAC), and PDF documents."
        )
      );
    }
  },
});

// GET /api/v1/materials/:subMateriId/poins - Get all poin details for a sub_materi
const getPoinsBySubMateri = async (req, res) => {
  try {
    const { subMateriId } = req.params;
    const user = req.user;
    const sb = req.supabaseAdmin || req.supabase;

    // Verify sub_materi exists
    const isAdmin =
      req.profile && ["admin", "superadmin"].includes(req.profile.role);
    // Use admin client for admin users to bypass RLS
    const clientToUse = isAdmin
      ? req.supabaseAdmin || req.supabase
      : req.supabase;

    const { data: subMateri, error: subMateriError } = await clientToUse
      .from("sub_materis")
      .select("id, title, module_id, published")
      .eq("id", subMateriId)
      .single();

    if (subMateriError || !subMateri) {
      return failure(
        res,
        "SUB_MATERI_NOT_FOUND",
        "Sub materi tidak ditemukan",
        404
      );
    }

    // Check access for non-admin users
    if (!subMateri.published && !isAdmin) {
      return failure(
        res,
        "SUB_MATERI_NOT_PUBLISHED",
        "Sub materi belum dipublikasi",
        403
      );
    }

    // Get all poin details for this sub_materi
    const { data: poinDetails, error: poinError } = await clientToUse
      .from("poin_details")
      .select(
        `
        id,
        title,
        content_html,
        duration_label,
        duration_minutes,
        order_index,
        sub_materi_id,
        created_at,
        updated_at
      `
      )
      .eq("sub_materi_id", subMateriId)
      .order("order_index", { ascending: true });

    if (poinError) {
      console.error("Get poin details error:", poinError);
      return failure(
        res,
        "POIN_FETCH_ERROR",
        "Gagal mengambil poin details",
        500,
        { details: poinError.message }
      );
    }

    // Get media for all poins
    const poinIds = poinDetails.map((p) => p.id);
    let poinMediaMap = {};

    if (poinIds.length > 0) {
      const { data: allPoinMedia } = await clientToUse
        .from("poin_media_materis")
        .select("id, poin_id, type, url, caption, order_index")
        .in("poin_id", poinIds)
        .order("order_index", { ascending: true });

      // Group media by poin_id
      allPoinMedia?.forEach((media) => {
        if (!poinMediaMap[media.poin_id]) {
          poinMediaMap[media.poin_id] = [];
        }
        poinMediaMap[media.poin_id].push(media);
      });
    }

    // If user is not admin, add progress information
    let enrichedPoinDetails = poinDetails;
    if (user && !["admin", "superadmin"].includes(user.role)) {
      if (poinIds.length > 0) {
        const { data: progressData } = await clientToUse
          .from("user_poin_progress")
          .select("poin_id, completed_at, is_completed")
          .eq("user_id", user.id)
          .in("poin_id", poinIds);

        const progressMap = {};
        progressData?.forEach((progress) => {
          progressMap[progress.poin_id] = {
            is_completed: progress.is_completed,
            completed_at: progress.completed_at,
          };
        });

        enrichedPoinDetails = poinDetails.map((poin) => ({
          ...poin,
          media: poinMediaMap[poin.id] || [],
          user_progress: progressMap[poin.id] || {
            is_completed: false,
            completed_at: null,
          },
        }));
      }
    } else {
      // For admin, just add media without user progress
      enrichedPoinDetails = poinDetails.map((poin) => ({
        ...poin,
        media: poinMediaMap[poin.id] || [],
      }));
    }

    return success(res, "POIN_FETCH_SUCCESS", "Poin details berhasil diambil", {
      sub_materi: subMateri,
      poin_details: enrichedPoinDetails,
      total: enrichedPoinDetails.length,
    });
  } catch (error) {
    console.error("Poin controller error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// GET /api/v1/poins/:id - Get specific poin detail
const getPoinById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const isAdmin =
      req.profile && ["admin", "superadmin"].includes(req.profile.role);
    // Use admin client for admin users to bypass RLS
    const clientToUse = isAdmin
      ? req.supabaseAdmin || req.supabase
      : req.supabase;

    const { data: poinDetail, error: poinError } = await clientToUse
      .from("poin_details")
      .select(
        `
        id,
        title,
        content_html,
        duration_label,
        duration_minutes,
        order_index,
        sub_materi_id,
        created_at,
        updated_at,
        sub_materis!inner(
          id,
          title,
          module_id,
          published,
          modules!inner(
            id,
            title
          )
        )
      `
      )
      .eq("id", id)
      .single();

    if (poinError || !poinDetail) {
      return failure(res, "POIN_NOT_FOUND", "Poin detail tidak ditemukan", 404);
    }

    // Check access to unpublished sub_materi for non-admin
    if (!poinDetail.sub_materis.published && !isAdmin) {
      return failure(
        res,
        "SUB_MATERI_NOT_PUBLISHED",
        "Sub materi belum dipublikasi",
        403
      );
    }

    // Get media for this poin
    const { data: poinMedia } = await clientToUse
      .from("poin_media_materis")
      .select(
        "id, poin_id, type, url, caption, order_index, original_filename, mime_type, file_size, created_at"
      )
      .eq("poin_id", id)
      .order("order_index", { ascending: true });

    // Add user progress if not admin
    let enrichedPoinDetail = poinDetail;
    if (user && !isAdmin) {
      const { data: progress } = await clientToUse
        .from("user_poin_progress")
        .select("completed_at, is_completed")
        .eq("user_id", user.id)
        .eq("poin_id", id)
        .single();

      enrichedPoinDetail = {
        ...poinDetail,
        poin_media: (poinMedia || []).map(formatMediaResponse), // Frontend expects poin_media
        media: (poinMedia || []).map(formatMediaResponse), // Keep both for compatibility
        user_progress: progress || {
          is_completed: false,
          completed_at: null,
        },
      };
    } else {
      // For admin, just add media without user progress
      enrichedPoinDetail = {
        ...poinDetail,
        poin_media: (poinMedia || []).map(formatMediaResponse), // Frontend expects poin_media
        media: (poinMedia || []).map(formatMediaResponse), // Keep both for compatibility
      };
    }

    return success(
      res,
      "POIN_FETCH_SUCCESS",
      "Poin detail berhasil diambil",
      enrichedPoinDetail
    );
  } catch (error) {
    console.error("Poin controller error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// POST /api/v1/materials/:subMateriId/poins - Create new poin detail (admin only)
const createPoin = async (req, res) => {
  try {
    const { subMateriId } = req.params;

    // Debug logging
    console.log("🔍 Raw request body:", req.body);

    const { error, value } = createPoinDetailSchema.validate(req.body);
    if (error) {
      console.log("❌ Validation error:", error.details[0]);
      return failure(
        res,
        "POIN_VALIDATION_ERROR",
        error.details[0].message,
        422
      );
    }

    console.log("✅ Validated value:", value);

    const sb = req.supabaseAdmin || req.supabase;

    // Verify sub_materi exists (admin can add poins to any material, including drafts)
    const isAdmin =
      req.profile && ["admin", "superadmin"].includes(req.profile.role);
    const { data: subMateri, error: subMateriError } = await sb
      .from("sub_materis")
      .select("id, published")
      .eq("id", subMateriId)
      .single();

    if (subMateriError || !subMateri) {
      return failure(
        res,
        "SUB_MATERI_NOT_FOUND",
        "Sub materi tidak ditemukan",
        404
      );
    }

    // Allow admin to add poins to draft materials
    if (!subMateri.published && !isAdmin) {
      return failure(
        res,
        "SUB_MATERI_NOT_PUBLISHED",
        "Tidak dapat menambahkan poin ke materi yang belum dipublikasi",
        403
      );
    }

    // Auto-set order_index if not provided
    if (value.order_index === undefined || value.order_index === 0) {
      const { data: lastPoin } = await sb
        .from("poin_details")
        .select("order_index")
        .eq("sub_materi_id", subMateriId)
        .order("order_index", { ascending: false })
        .limit(1)
        .maybeSingle();

      value.order_index = (lastPoin?.order_index || 0) + 1;
    }

    // Prepare insert data with explicit field mapping
    const insertData = {
      title: value.title,
      content_html: value.content_html || "",
      duration_label: value.duration_label || null,
      duration_minutes: value.duration_minutes || null,
      order_index: value.order_index,
      sub_materi_id: subMateriId,
    };

    console.log("🔍 Insert data to database:", insertData);

    // Try insert with explicit column specification to avoid schema cache issues
    const { data, error: insertError } = await sb
      .from("poin_details")
      .insert([insertData]) // Use array format for better compatibility
      .select(
        `id, title, content_html, duration_label, duration_minutes, order_index, sub_materi_id, created_at, updated_at`
      )
      .single();

    if (insertError) {
      console.error("Create poin error:", insertError);
      if (insertError.code === "23503") {
        return failure(
          res,
          "SUB_MATERI_NOT_FOUND",
          "Sub materi tidak valid",
          400,
          { details: insertError.message }
        );
      }
      return failure(
        res,
        "POIN_CREATE_ERROR",
        "Gagal membuat poin detail",
        500,
        { details: insertError.message }
      );
    }

    return success(
      res,
      "POIN_CREATE_SUCCESS",
      "Poin detail berhasil dibuat",
      data,
      201
    );
  } catch (error) {
    console.error("Poin controller error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// POST /api/v1/admin/sub-materis/:subMateriId/poins-with-media - Create poin with media upload
const createPoinWithMedia = [
  upload.array("media", 10), // Accept multiple files (max 10)
  async (req, res) => {
    try {
      const { subMateriId } = req.params;
      const {
        title,
        content_html,
        duration_label,
        duration_minutes,
        order_index,
      } = req.body;

      // Parse captions array from form data (JSON string)
      let captions = [];
      try {
        if (req.body.captions) {
          captions = JSON.parse(req.body.captions);
        }
      } catch (e) {
        console.log("Caption parse error, using empty array");
        captions = [];
      }

      console.log("🔍 Create poin with media - body:", req.body);
      console.log("🔍 Files count:", req.files?.length || 0);
      console.log("🔍 Captions:", captions);

      // Validate required fields
      if (!title || !content_html) {
        return failure(
          res,
          "REQUIRED_FIELDS",
          "Title dan content_html wajib diisi",
          400
        );
      }

      const sb = req.supabaseAdmin || req.supabase;

      // Verify sub_materi exists
      const isAdmin =
        req.profile && ["admin", "superadmin"].includes(req.profile.role);
      const { data: subMateri, error: subMateriError } = await sb
        .from("sub_materis")
        .select("id, published")
        .eq("id", subMateriId)
        .single();

      if (subMateriError || !subMateri) {
        return failure(
          res,
          "SUB_MATERI_NOT_FOUND",
          "Sub materi tidak ditemukan",
          404
        );
      }

      if (!subMateri.published && !isAdmin) {
        return failure(
          res,
          "SUB_MATERI_NOT_PUBLISHED",
          "Tidak dapat menambahkan poin ke materi yang belum dipublikasi",
          403
        );
      }

      // Auto-set order_index if not provided
      let finalOrderIndex = parseInt(order_index) || 0;
      if (finalOrderIndex === 0) {
        const { data: lastPoin } = await sb
          .from("poin_details")
          .select("order_index")
          .eq("sub_materi_id", subMateriId)
          .order("order_index", { ascending: false })
          .limit(1)
          .maybeSingle();

        finalOrderIndex = (lastPoin?.order_index || 0) + 1;
      }

      // Create poin first
      const insertData = {
        title: title.trim(),
        content_html: content_html.trim(),
        duration_label: duration_label || null,
        duration_minutes: duration_minutes ? parseInt(duration_minutes) : null,
        order_index: finalOrderIndex,
        sub_materi_id: subMateriId,
      };

      const { data: poinData, error: insertError } = await sb
        .from("poin_details")
        .insert([insertData])
        .select(
          "id, title, content_html, duration_label, duration_minutes, order_index, sub_materi_id, created_at"
        )
        .single();

      if (insertError) {
        console.error("Create poin error:", insertError);
        return failure(
          res,
          "POIN_CREATE_ERROR",
          "Gagal membuat poin detail",
          500,
          {
            details: insertError.message,
          }
        );
      }

      const poinId = poinData.id;
      console.log("✅ Poin created with ID:", poinId);

      // Upload media files if provided
      const uploadedMedia = [];
      if (req.files && req.files.length > 0) {
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          const caption = captions[i] || `Media ${i + 1}`; // Default caption if not provided

          try {
            // Generate unique filename
            const fileExt = path.extname(file.originalname);
            const timestamp = Date.now();
            const userId = req.user?.id || "unknown";
            const filename = `${timestamp}_${userId}_${Math.random()
              .toString(36)
              .substring(2)}${fileExt}`;

            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await sb.storage
              .from("poin_media")
              .upload(filename, file.buffer, {
                contentType: file.mimetype,
                cacheControl: "3600",
                upsert: false,
              });

            if (uploadError) {
              console.error(`Upload error for file ${i}:`, uploadError);
              continue; // Skip this file but continue with others
            }

            // Get public URL
            const { data: urlData } = sb.storage
              .from("poin_media")
              .getPublicUrl(filename);

            // Determine media type
            let mediaType = "other";
            if (file.mimetype.startsWith("image/")) mediaType = "image";
            else if (file.mimetype.startsWith("video/")) mediaType = "video";
            else if (file.mimetype.startsWith("audio/")) mediaType = "audio";
            else if (file.mimetype === "application/pdf") mediaType = "pdf";

            // Save media record
            const { data: mediaRecord, error: mediaError } = await sb
              .from("poin_media_materis")
              .insert({
                poin_id: poinId,
                type: mediaType,
                url: urlData.publicUrl,
                caption: caption,
                order_index: i + 1,
                original_filename: file.originalname,
                mime_type: file.mimetype,
                file_size: file.buffer.length,
              })
              .select(
                "id, poin_id, type, url, caption, order_index, original_filename, mime_type, file_size, created_at"
              )
              .single();

            if (!mediaError && mediaRecord) {
              uploadedMedia.push({
                ...mediaRecord,
                filename,
                originalName: file.originalname,
                size: file.buffer.length,
              });
            }
          } catch (fileError) {
            console.error(`Error processing file ${i}:`, fileError);
            // Continue with other files
          }
        }
      }

      return success(
        res,
        "POIN_WITH_MEDIA_CREATE_SUCCESS",
        "Poin dan media berhasil dibuat",
        {
          poin: poinData,
          media: uploadedMedia,
          totalMedia: uploadedMedia.length,
        },
        201
      );
    } catch (error) {
      console.error("Create poin with media error:", error);
      return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
        details: error.message,
      });
    }
  },
];

// PUT /api/v1/poins/:id - Update poin detail (admin only)
const updatePoin = async (req, res) => {
  try {
    const { id } = req.params;

    const { error, value } = updatePoinDetailSchema.validate(req.body);
    if (error) {
      return failure(
        res,
        "POIN_VALIDATION_ERROR",
        error.details[0].message,
        422
      );
    }

    const sb = req.supabaseAdmin || req.supabase;

    // Check if poin exists
    const { data: existingPoin, error: fetchError } = await sb
      .from("poin_details")
      .select("id, sub_materi_id, order_index")
      .eq("id", id)
      .single();

    if (fetchError || !existingPoin) {
      return failure(res, "POIN_NOT_FOUND", "Poin detail tidak ditemukan", 404);
    }

    // Handle order_index changes if provided
    if (
      value.order_index !== undefined &&
      value.order_index !== existingPoin.order_index
    ) {
      const { data: conflictCheck } = await sb
        .from("poin_details")
        .select("id")
        .eq("sub_materi_id", existingPoin.sub_materi_id)
        .eq("order_index", value.order_index)
        .neq("id", id)
        .maybeSingle();

      if (conflictCheck) {
        return failure(
          res,
          "ORDER_INDEX_CONFLICT",
          "Order index sudah digunakan dalam sub materi ini",
          409
        );
      }
    }

    const { data, error: updateError } = await sb
      .from("poin_details")
      .update(value)
      .eq("id", id)
      .select(
        `
        id, title, content_html, duration_label, duration_minutes, order_index, sub_materi_id, created_at, updated_at
      `
      )
      .single();

    if (updateError) {
      console.error("Update poin error:", updateError);
      return failure(
        res,
        "POIN_UPDATE_ERROR",
        "Gagal memperbarui poin detail",
        500,
        { details: updateError.message }
      );
    }

    return success(
      res,
      "POIN_UPDATE_SUCCESS",
      "Poin detail berhasil diperbarui",
      data
    );
  } catch (error) {
    console.error("Poin controller error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// DELETE /api/v1/poins/:id - Delete poin detail (admin only)
const deletePoin = async (req, res) => {
  try {
    const { id } = req.params;
    const sb = req.supabaseAdmin || req.supabase;

    // Check if poin exists and has user progress
    const { data: existingPoin, error: fetchError } = await sb
      .from("poin_details")
      .select(
        `
        id,
        title,
        sub_materi_id
      `
      )
      .eq("id", id)
      .single();

    if (fetchError || !existingPoin) {
      return failure(res, "POIN_NOT_FOUND", "Poin detail tidak ditemukan", 404);
    }

    // Check if users have progress on this poin
    const { data: progressExists } = await sb
      .from("user_poin_progress")
      .select("id")
      .eq("poin_id", id)
      .limit(1)
      .maybeSingle();

    if (progressExists) {
      return failure(
        res,
        "POIN_HAS_PROGRESS",
        "Tidak dapat menghapus poin yang sudah memiliki progress pengguna",
        409
      );
    }

    const { error: deleteError } = await sb
      .from("poin_details")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete poin error:", deleteError);
      return failure(
        res,
        "POIN_DELETE_ERROR",
        "Gagal menghapus poin detail",
        500,
        { details: deleteError.message }
      );
    }

    return success(res, "POIN_DELETE_SUCCESS", "Poin detail berhasil dihapus", {
      deletedId: id,
      title: existingPoin.title,
    });
  } catch (error) {
    console.error("Poin controller error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// POST /api/v1/admin/poins/:poinId/media - Upload media for specific poin
const uploadPoinMedia = [
  upload.single("media"), // Handle single file upload with field name 'media'
  async (req, res) => {
    try {
      const { poinId } = req.params;
      const { caption } = req.body; // Optional caption from form

      if (!req.file) {
        return failure(res, "NO_FILE", "No file uploaded", 400);
      }

      if (!poinId) {
        return failure(res, "POIN_ID_REQUIRED", "Poin ID is required", 400);
      }

      const { buffer, originalname, mimetype } = req.file;
      const fileExt = path.extname(originalname);
      const timestamp = Date.now();
      const userId = req.user?.id || "unknown";

      // Generate unique filename
      const filename = `${timestamp}_${userId}_${Math.random()
        .toString(36)
        .substring(2)}${fileExt}`;

      const sb = req.supabaseAdmin || req.supabase;

      // Verify poin exists
      const { data: poin, error: poinError } = await sb
        .from("poin_details")
        .select("id")
        .eq("id", poinId)
        .single();

      if (poinError || !poin) {
        return failure(res, "POIN_NOT_FOUND", "Poin tidak ditemukan", 404);
      }

      // Upload to Supabase Storage bucket 'poin_media'
      const { data: uploadData, error: uploadError } = await sb.storage
        .from("poin_media")
        .upload(filename, buffer, {
          contentType: mimetype,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        return failure(res, "UPLOAD_ERROR", "Failed to upload media", 500, {
          details: uploadError.message,
        });
      }

      // Get public URL
      const { data: urlData } = sb.storage
        .from("poin_media")
        .getPublicUrl(filename);

      const mediaUrl = urlData.publicUrl;

      // Determine media type
      let mediaType = "other";
      if (mimetype.startsWith("image/")) mediaType = "image";
      else if (mimetype.startsWith("video/")) mediaType = "video";
      else if (mimetype.startsWith("audio/")) mediaType = "audio";
      else if (mimetype === "application/pdf") mediaType = "pdf";

      // Get next order_index for this poin
      const { data: lastMedia } = await sb
        .from("poin_media_materis")
        .select("order_index")
        .eq("poin_id", poinId)
        .order("order_index", { ascending: false })
        .limit(1)
        .maybeSingle();

      const orderIndex = (lastMedia?.order_index || 0) + 1;

      // Save media record to poin_media_materis table
      const { data: mediaRecord, error: mediaError } = await sb
        .from("poin_media_materis")
        .insert({
          poin_id: poinId,
          type: mediaType,
          url: mediaUrl,
          caption: caption || null,
          order_index: orderIndex,
          original_filename: originalname,
          mime_type: mimetype,
          file_size: buffer.length,
        })
        .select(
          "id, poin_id, type, url, caption, order_index, original_filename, mime_type, file_size, created_at"
        )
        .single();

      if (mediaError) {
        console.error("Media record error:", mediaError);
        // Try to cleanup uploaded file
        await sb.storage.from("poin_media").remove([filename]);
        return failure(
          res,
          "MEDIA_RECORD_ERROR",
          "Failed to save media record",
          500,
          {
            details: mediaError.message,
          }
        );
      }

      return success(
        res,
        "MEDIA_UPLOAD_SUCCESS",
        "Media uploaded successfully",
        {
          ...mediaRecord,
          filename,
          originalName: originalname,
          size: buffer.length,
        },
        201
      );
    } catch (error) {
      console.error("Upload media error:", error);
      return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
        details: error.message,
      });
    }
  },
];

// DELETE /api/v1/admin/poins/media/:mediaId - Delete media record and file
const deletePoinMedia = async (req, res) => {
  try {
    const { mediaId } = req.params;

    if (!mediaId) {
      return failure(res, "MEDIA_ID_REQUIRED", "Media ID is required", 400);
    }

    const sb = req.supabaseAdmin || req.supabase;

    // Get media record first to extract filename from URL
    const { data: mediaRecord, error: fetchError } = await sb
      .from("poin_media_materis")
      .select("id, url, poin_id, type")
      .eq("id", mediaId)
      .single();

    if (fetchError || !mediaRecord) {
      return failure(res, "MEDIA_NOT_FOUND", "Media record not found", 404);
    }

    // Extract filename from URL
    const urlParts = mediaRecord.url.split("/");
    const filename = urlParts[urlParts.length - 1];

    // Delete from database first
    const { error: dbDeleteError } = await sb
      .from("poin_media_materis")
      .delete()
      .eq("id", mediaId);

    if (dbDeleteError) {
      console.error("Delete media record error:", dbDeleteError);
      return failure(
        res,
        "DELETE_RECORD_ERROR",
        "Failed to delete media record",
        500,
        {
          details: dbDeleteError.message,
        }
      );
    }

    // Delete from Supabase Storage
    const { error: storageDeleteError } = await sb.storage
      .from("poin_media")
      .remove([filename]);

    if (storageDeleteError) {
      console.error("Delete storage file error:", storageDeleteError);
      // Don't fail the request if storage delete fails, record is already deleted
      console.warn(
        "Storage file delete failed but media record was deleted successfully"
      );
    }

    return success(res, "MEDIA_DELETE_SUCCESS", "Media deleted successfully", {
      mediaId,
      filename,
      poinId: mediaRecord.poin_id,
    });
  } catch (error) {
    console.error("Delete media error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// GET /api/v1/admin/poins/:poinId/media - Get all media for a poin
const getPoinMedia = async (req, res) => {
  try {
    const { poinId } = req.params;

    if (!poinId) {
      return failure(res, "POIN_ID_REQUIRED", "Poin ID is required", 400);
    }

    const sb = req.supabaseAdmin || req.supabase;

    // Get all media for this poin
    const { data: mediaList, error: mediaError } = await sb
      .from("poin_media_materis")
      .select(
        "id, poin_id, type, url, caption, order_index, original_filename, mime_type, file_size, created_at, updated_at"
      )
      .eq("poin_id", poinId)
      .order("order_index", { ascending: true });

    if (mediaError) {
      console.error("Get poin media error:", mediaError);
      return failure(
        res,
        "MEDIA_FETCH_ERROR",
        "Failed to fetch poin media",
        500,
        {
          details: mediaError.message,
        }
      );
    }

    // Format response sesuai requirement frontend
    const formattedMedia = (mediaList || []).map(formatMediaResponse);

    return success(
      res,
      "MEDIA_FETCH_SUCCESS",
      "Poin media retrieved successfully",
      formattedMedia // Return array langsung, bukan object wrapper
    );
  } catch (error) {
    console.error("Get poin media error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// PUT /api/v1/admin/poins/media/:mediaId - Update media caption and order
const updatePoinMedia = async (req, res) => {
  try {
    const { mediaId } = req.params;
    const { caption, order_index } = req.body;

    if (!mediaId) {
      return failure(res, "MEDIA_ID_REQUIRED", "Media ID is required", 400);
    }

    const sb = req.supabaseAdmin || req.supabase;

    // Check if media exists
    const { data: existingMedia, error: fetchError } = await sb
      .from("poin_media_materis")
      .select("id, poin_id, caption, order_index")
      .eq("id", mediaId)
      .single();

    if (fetchError || !existingMedia) {
      return failure(res, "MEDIA_NOT_FOUND", "Media not found", 404);
    }

    // Prepare update data
    const updateData = {};
    if (caption !== undefined) updateData.caption = caption;
    if (order_index !== undefined) updateData.order_index = order_index;
    updateData.updated_at = new Date().toISOString();

    if (Object.keys(updateData).length === 1) {
      // Only updated_at
      return failure(res, "NO_CHANGES", "No changes provided", 400);
    }

    // Update media record
    const { data: updatedMedia, error: updateError } = await sb
      .from("poin_media_materis")
      .update(updateData)
      .eq("id", mediaId)
      .select(
        "id, poin_id, type, url, caption, order_index, created_at, updated_at"
      )
      .single();

    if (updateError) {
      console.error("Update media error:", updateError);
      return failure(res, "UPDATE_ERROR", "Failed to update media", 500, {
        details: updateError.message,
      });
    }

    return success(
      res,
      "MEDIA_UPDATE_SUCCESS",
      "Media updated successfully",
      updatedMedia
    );
  } catch (error) {
    console.error("Update media error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

module.exports = {
  getPoinsBySubMateri,
  getPoinById,
  createPoin,
  createPoinWithMedia,
  updatePoin,
  deletePoin,
  uploadPoinMedia,
  deletePoinMedia,
  getPoinMedia,
  updatePoinMedia,
};
