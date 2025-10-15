const { success, failure } = require("../utils/respond");

// Menandai poin sebagai selesai
// POST /api/v1/materials/:materi_id/points/:poin_id/complete
async function completePoin(req, res) {
  try {
    const { materi_id, poin_id } = req.params;
    const userId = req.user.id;

    // Validasi poin exists dan belongs to materi
    const { data: poin, error: poinError } = await req.supabase
      .from("poin_details")
      .select("id, sub_materi_id, order_index")
      .eq("id", poin_id)
      .eq("sub_materi_id", materi_id)
      .single();

    if (poinError || !poin) {
      return failure(res, "POIN_NOT_FOUND", "Poin tidak ditemukan", 404);
    }

    // Cek apakah sudah completed sebelumnya
    const { data: existingProgress } = await req.supabase
      .from("user_poin_progress")
      .select("id, completed")
      .eq("user_id", userId)
      .eq("poin_id", poin_id)
      .maybeSingle();

    if (existingProgress?.completed) {
      return success(
        res,
        "POIN_ALREADY_COMPLETED",
        "Poin sudah diselesaikan sebelumnya",
        existingProgress
      );
    }

    // Tandai poin sebagai selesai
    const { data: progress, error: progressError } = await req.supabase
      .from("user_poin_progress")
      .upsert({
        user_id: userId,
        poin_id,
        completed: true,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (progressError) {
      return failure(
        res,
        "POIN_PROGRESS_ERROR",
        "Gagal menyimpan progress poin",
        500,
        {
          details: progressError.message,
        }
      );
    }

    // Update progress sub_materi jika semua poin sudah selesai
    await updateSubMateriProgress(req.supabase, userId, materi_id);

    return success(
      res,
      "POIN_COMPLETED",
      "Poin berhasil diselesaikan",
      progress
    );
  } catch (error) {
    console.error("Complete poin error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
}

// Helper function untuk update progress sub_materi
async function updateSubMateriProgress(supabase, userId, subMateriId) {
  try {
    // Hitung total poin dan poin yang sudah selesai
    const { data: allPoin } = await supabase
      .from("poin_details")
      .select("id")
      .eq("sub_materi_id", subMateriId);

    const { data: completedPoin } = await supabase
      .from("user_poin_progress")
      .select("poin_id")
      .eq("user_id", userId)
      .eq("completed", true)
      .in("poin_id", allPoin?.map((p) => p.id) || []);

    const totalPoin = allPoin?.length || 0;
    const completedCount = completedPoin?.length || 0;
    const allPoinsCompleted = totalPoin > 0 && completedCount === totalPoin;

    // Update progress sub_materi
    await supabase.from("user_sub_materi_progress").upsert({
      user_id: userId,
      sub_materi_id: subMateriId,
      completed: allPoinsCompleted,
      completed_at: allPoinsCompleted ? new Date().toISOString() : null,
      progress_percentage:
        totalPoin > 0 ? Math.round((completedCount / totalPoin) * 100) : 0,
    });

    // Jika sub_materi selesai, update progress module
    if (allPoinsCompleted) {
      const { data: subMateri } = await supabase
        .from("sub_materis")
        .select("module_id")
        .eq("id", subMateriId)
        .single();

      if (subMateri) {
        await updateModuleProgress(supabase, userId, subMateri.module_id);
      }
    }
  } catch (error) {
    console.error("Update sub materi progress error:", error);
  }
}

// Helper function untuk update progress module
async function updateModuleProgress(supabase, userId, moduleId) {
  try {
    // Hitung total sub_materi dan yang sudah selesai
    const { data: allSubMateris } = await supabase
      .from("sub_materis")
      .select("id")
      .eq("module_id", moduleId)
      .eq("published", true);

    const { data: completedSubMateris } = await supabase
      .from("user_sub_materi_progress")
      .select("sub_materi_id")
      .eq("user_id", userId)
      .eq("completed", true)
      .in("sub_materi_id", allSubMateris?.map((s) => s.id) || []);

    const totalSubMateris = allSubMateris?.length || 0;
    const completedCount = completedSubMateris?.length || 0;
    const allSubMaterisCompleted =
      totalSubMateris > 0 && completedCount === totalSubMateris;

    // Update progress module
    await supabase.from("user_module_progress").upsert({
      user_id: userId,
      module_id: moduleId,
      completed: allSubMaterisCompleted,
      completed_at: allSubMaterisCompleted ? new Date().toISOString() : null,
      progress_percentage:
        totalSubMateris > 0
          ? Math.round((completedCount / totalSubMateris) * 100)
          : 0,
    });
  } catch (error) {
    console.error("Update module progress error:", error);
  }
}

// Mendapatkan progress user untuk sebuah module
// GET /api/v1/progress/modules/:module_id
async function getModuleProgress(req, res) {
  try {
    const { module_id } = req.params;
    const userId = req.user.id;

    // Get module progress
    const { data: moduleProgress, error: moduleError } = await req.supabase
      .from("user_module_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("module_id", module_id)
      .maybeSingle();

    if (moduleError) {
      return failure(
        res,
        "MODULE_PROGRESS_ERROR",
        "Gagal mengambil progress module",
        500,
        {
          details: moduleError.message,
        }
      );
    }

    // Get sub_materi progress
    const { data: subMateris } = await req.supabase
      .from("sub_materis")
      .select("id, judul, order_index")
      .eq("module_id", module_id)
      .eq("published", true)
      .order("order_index", { ascending: true });

    const subMateriIds = subMateris?.map((s) => s.id) || [];

    const { data: subMateriProgress } = await req.supabase
      .from("user_sub_materi_progress")
      .select("*")
      .eq("user_id", userId)
      .in("sub_materi_id", subMateriIds);

    // Get poin progress untuk setiap sub_materi
    const progressDetails = await Promise.all(
      (subMateris || []).map(async (subMateri) => {
        const { data: poinDetails } = await req.supabase
          .from("poin_details")
          .select("id, judul_poin, order_index")
          .eq("sub_materi_id", subMateri.id)
          .order("order_index", { ascending: true });

        const poinIds = poinDetails?.map((p) => p.id) || [];

        const { data: poinProgress } = await req.supabase
          .from("user_poin_progress")
          .select("*")
          .eq("user_id", userId)
          .in("poin_id", poinIds);

        const subMateriProgressData = subMateriProgress?.find(
          (sp) => sp.sub_materi_id === subMateri.id
        );

        return {
          sub_materi: subMateri,
          progress: subMateriProgressData || {
            completed: false,
            progress_percentage: 0,
          },
          poin_details:
            poinDetails?.map((poin) => ({
              ...poin,
              progress: poinProgress?.find((pp) => pp.poin_id === poin.id) || {
                completed: false,
              },
            })) || [],
        };
      })
    );

    return success(
      res,
      "MODULE_PROGRESS_SUCCESS",
      "Progress module berhasil diambil",
      {
        module_progress: moduleProgress || {
          completed: false,
          progress_percentage: 0,
        },
        sub_materi_progress: progressDetails,
      }
    );
  } catch (error) {
    console.error("Get module progress error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
}

// Mendapatkan daftar progress semua module untuk user
// GET /api/v1/progress/modules
async function getUserModulesProgress(req, res) {
  try {
    const userId = req.user.id;

    // Get all published modules
    console.log("DEBUG: Querying modules for user:", userId);
    const { data: modules, error: modulesError } = await req.supabase
      .from("modules")
      .select("id, title, slug, description, category")
      .eq("published", true)
      .order("created_at", { ascending: true });

    console.log("DEBUG: Modules query result:", {
      modules: modules?.length,
      error: modulesError?.message,
    });

    if (modulesError) {
      return failure(
        res,
        "MODULES_FETCH_ERROR",
        "Gagal mengambil daftar modules",
        500,
        {
          details: modulesError.message,
        }
      );
    }

    // Get user progress for all modules
    const moduleIds = modules?.map((m) => m.id) || [];
    const { data: moduleProgress } = await req.supabase
      .from("user_module_progress")
      .select("*")
      .eq("user_id", userId)
      .in("module_id", moduleIds);

    // Combine modules with progress
    const modulesWithProgress =
      modules?.map((module) => {
        const progress = moduleProgress?.find(
          (mp) => mp.module_id === module.id
        );
        return {
          ...module,
          progress: progress || { completed: false, progress_percentage: 0 },
        };
      }) || [];

    // Set no-cache headers for fresh progress data
    res.set({
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });

    return success(
      res,
      "USER_MODULES_PROGRESS_SUCCESS",
      "Progress modules berhasil diambil",
      {
        modules: modulesWithProgress,
      }
    );
  } catch (error) {
    console.error("Get user modules progress error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
}

// Cek apakah user dapat akses sub_materi tertentu berdasarkan progress
// GET /api/v1/progress/materials/:sub_materi_id/access
async function checkSubMateriAccess(req, res) {
  try {
    const { sub_materi_id } = req.params;
    const userId = req.user.id;

    // Get sub_materi info
    const { data: subMateri, error: subMateriError } = await req.supabase
      .from("sub_materis")
      .select("id, module_id, order_index")
      .eq("id", sub_materi_id)
      .eq("published", true)
      .single();

    if (subMateriError || !subMateri) {
      return failure(
        res,
        "SUB_MATERI_NOT_FOUND",
        "Sub materi tidak ditemukan",
        404
      );
    }

    // Get previous sub_materi in the same module
    const { data: previousSubMateris } = await req.supabase
      .from("sub_materis")
      .select("id")
      .eq("module_id", subMateri.module_id)
      .eq("published", true)
      .lt("order_index", subMateri.order_index);

    let canAccess = true;
    let reason = "";

    // Jika ada sub_materi sebelumnya, cek apakah sudah selesai semua
    if (previousSubMateris && previousSubMateris.length > 0) {
      const { data: completedPrevious } = await req.supabase
        .from("user_sub_materi_progress")
        .select("sub_materi_id")
        .eq("user_id", userId)
        .eq("completed", true)
        .in(
          "sub_materi_id",
          previousSubMateris.map((s) => s.id)
        );

      const completedCount = completedPrevious?.length || 0;
      const requiredCount = previousSubMateris.length;

      if (completedCount < requiredCount) {
        canAccess = false;
        reason = `Selesaikan ${
          requiredCount - completedCount
        } materi sebelumnya terlebih dahulu`;
      }
    }

    return success(
      res,
      "SUB_MATERI_ACCESS_CHECK",
      "Pengecekan akses berhasil",
      {
        can_access: canAccess,
        reason: reason,
        sub_materi_id: sub_materi_id,
      }
    );
  } catch (error) {
    console.error("Check sub materi access error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
}

// GET /api/v1/progress/sub-materis/:id - Mendapatkan progress user untuk sub materi tertentu
const getSubMateriProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(
      `[Progress API] Fetching progress for user ${userId}, sub_materi ${id}`
    );

    // Get sub_materi info first
    const { data: subMateri, error: subMateriError } = await req.supabase
      .from("sub_materis")
      .select("id, title, module_id, published")
      .eq("id", id)
      .single();

    if (subMateriError || !subMateri) {
      console.error("[Progress API] Sub materi not found:", subMateriError);
      return failure(
        res,
        "SUB_MATERI_NOT_FOUND",
        "Sub materi tidak ditemukan",
        404
      );
    }

    // Check if sub materi is published (non-admin users)
    const isAdmin =
      req.profile && ["admin", "superadmin"].includes(req.profile.role);
    if (!subMateri.published && !isAdmin) {
      return failure(
        res,
        "SUB_MATERI_NOT_PUBLISHED",
        "Sub materi belum dipublikasi",
        403
      );
    }

    // Get or create user progress for this sub_materi
    let { data: progressRecord, error: progressError } = await req.supabase
      .from("user_sub_materi_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("sub_materi_id", id)
      .maybeSingle();

    if (progressError) {
      console.error("[Progress API] Error fetching progress:", progressError);
      return failure(
        res,
        "PROGRESS_FETCH_ERROR",
        "Gagal mengambil progress",
        500,
        { details: progressError.message }
      );
    }

    // Create initial progress record if not exists
    if (!progressRecord) {
      console.log(
        `[Progress API] Creating initial progress record for user ${userId}, sub_materi ${id}`
      );

      const { data: newProgress, error: createError } = await req.supabase
        .from("user_sub_materi_progress")
        .insert({
          user_id: userId,
          sub_materi_id: id,
          is_unlocked: true,
          is_completed: false,
          current_poin_index: 0,
          progress_percent: 0,
          last_accessed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) {
        console.error("[Progress API] Error creating progress:", createError);
        // Return default progress if creation fails
        progressRecord = {
          id: null,
          user_id: userId,
          sub_materi_id: id,
          is_unlocked: true,
          is_completed: false,
          current_poin_index: 0,
          progress_percent: 0,
          last_accessed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      } else {
        progressRecord = newProgress;
      }
    } else {
      // Update last accessed time
      const { error: updateError } = await req.supabase
        .from("user_sub_materi_progress")
        .update({ last_accessed_at: new Date().toISOString() })
        .eq("id", progressRecord.id);

      if (updateError) {
        console.warn(
          "[Progress API] Failed to update last_accessed_at:",
          updateError
        );
      }
    }

    // Format response to match frontend requirements exactly
    const responseData = {
      id: progressRecord.id || `temp_${userId}_${id}`,
      user_id: userId,
      sub_materi_id: id,
      is_unlocked: progressRecord.is_unlocked ?? true,
      is_completed: progressRecord.is_completed ?? false,
      current_poin_index: progressRecord.current_poin_index ?? 0,
      progress_percent: progressRecord.progress_percent ?? 0,
      last_accessed_at:
        progressRecord.last_accessed_at || new Date().toISOString(),
      created_at: progressRecord.created_at || new Date().toISOString(),
      updated_at: progressRecord.updated_at || new Date().toISOString(),
    };

    console.log("[Progress API] Success, returning progress:", responseData.id);

    return success(
      res,
      "SUB_MATERI_PROGRESS_SUCCESS",
      "Progress berhasil diambil",
      responseData
    );
  } catch (error) {
    console.error("[Progress API] Unexpected error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// POST /api/v1/progress/sub-materis/:id/complete - Menandai sub materi sebagai selesai
const completeSubMateri = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if sub_materi exists
    const { data: subMateri, error: subMateriError } = await req.supabase
      .from("sub_materis")
      .select("id, title, module_id")
      .eq("id", id)
      .eq("published", true)
      .single();

    if (subMateriError || !subMateri) {
      return failure(
        res,
        "SUB_MATERI_NOT_FOUND",
        "Sub materi tidak ditemukan atau belum dipublikasi",
        404
      );
    }

    // Check if all poin are completed
    const { data: allPoin } = await req.supabase
      .from("poin_details")
      .select("id")
      .eq("sub_materi_id", id);

    const { data: completedPoin } = await req.supabase
      .from("user_poin_progress")
      .select("poin_id")
      .eq("user_id", userId)
      .eq("is_completed", true)
      .in("poin_id", allPoin?.map((p) => p.id) || []);

    const totalPoin = allPoin?.length || 0;
    const completedCount = completedPoin?.length || 0;

    if (totalPoin > 0 && completedCount < totalPoin) {
      return failure(
        res,
        "INCOMPLETE_POIN",
        `Selesaikan semua poin terlebih dahulu. Progress: ${completedCount}/${totalPoin}`,
        400
      );
    }

    // Mark sub_materi as completed
    const { data: progress, error: progressError } = await req.supabase
      .from("user_sub_materi_progress")
      .upsert({
        user_id: userId,
        sub_materi_id: id,
        is_completed: true,
        completed_at: new Date().toISOString(),
        progress_percentage: 100,
        is_unlocked: true,
        current_poin_index: totalPoin,
        last_accessed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (progressError) {
      return failure(
        res,
        "PROGRESS_UPDATE_ERROR",
        "Gagal memperbarui progress",
        500,
        { details: progressError.message }
      );
    }

    // Update module progress
    await updateModuleProgress(req.supabase, userId, subMateri.module_id);

    return success(
      res,
      "SUB_MATERI_COMPLETED",
      "Sub materi berhasil diselesaikan",
      progress
    );
  } catch (error) {
    console.error("Complete sub materi error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

module.exports = {
  completePoin,
  getModuleProgress,
  getUserModulesProgress,
  checkSubMateriAccess,
  updateSubMateriProgress,
  updateModuleProgress,
  getSubMateriProgress,
  completeSubMateri,
};
