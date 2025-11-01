const { success, failure } = require("../utils/respond");

// ============================================================================
// Helper Function: Recalculate Module Progress (Based on Quiz Completion)
// Progress dihitung otomatis berdasarkan jumlah sub-materi dan quiz completion
// Formula: (jumlah quiz passed / total sub-materi) * 100
// ============================================================================
async function recalculateModuleProgress(supabase, userId, moduleId) {
  try {
    console.log("📊 Recalculating module progress based on quiz completion:", {
      userId,
      moduleId,
    });

    // Step 1: Get TOTAL sub-materi count for this module from database
    const { data: allSubMateris, error: subMateriError } = await supabase
      .from("sub_materis")
      .select("id")
      .eq("module_id", moduleId)
      .eq("published", true);

    if (subMateriError) {
      console.error("Error fetching sub-materis:", subMateriError);
      return { success: false, error: subMateriError };
    }

    const totalSubMateris = allSubMateris?.length || 0;

    if (totalSubMateris === 0) {
      console.log("No sub-materis found in module, setting to not-started");

      const { error: initError } = await supabase
        .from("user_module_progress")
        .upsert(
          {
            user_id: userId,
            module_id: moduleId,
            status: "not-started",
            progress_percent: 0,
            last_accessed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,module_id" }
        );

      if (initError) {
        console.error("Error initializing module progress:", initError);
        return { success: false, error: initError };
      }

      return { success: true, progress: 0, status: "not-started" };
    }

    // Step 2: Get user's progress for sub-materis (quiz completion)
    const { data: userProgress, error: progressError } = await supabase
      .from("user_sub_materi_progress")
      .select("sub_materi_id, is_completed")
      .eq("user_id", userId)
      .eq("module_id", moduleId)
      .eq("is_completed", true); // Only count completed (quiz passed)

    if (progressError) {
      console.error("Error fetching user progress:", progressError);
      return { success: false, error: progressError };
    }

    const completedSubMateris = userProgress?.length || 0;

    // Step 3: Calculate progress percentage (AUTOMATIC based on sub-materi count)
    // If 1 sub-materi = 100%, if 2 = 50% each, if 3 = 33% each, etc.
    const progressPercent = Math.round((completedSubMateris / totalSubMateris) * 100);

    // Step 4: Determine status
    let status = "not-started";
    if (completedSubMateris === totalSubMateris && totalSubMateris > 0) {
      status = "completed";
    } else if (completedSubMateris > 0) {
      status = "in-progress";
    }

    console.log("📈 Module progress calculated (quiz-based):", {
      totalSubMateris,
      completedSubMateris,
      progressPercent,
      status,
    });

    // Step 5: Update module progress
    const { data: moduleProgressData, error: updateError } = await supabase
      .from("user_module_progress")
      .upsert(
        {
          user_id: userId,
          module_id: moduleId,
          status: status,
          progress_percent: progressPercent,
          last_accessed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,module_id" }
      )
      .select()
      .single();

    if (updateError) {
      console.error("Error updating module progress:", updateError);
      return { success: false, error: updateError };
    }

    console.log("✅ Module progress updated:", {
      progress: progressPercent,
      status,
    });

    return {
      success: true,
      progress: progressPercent,
      status: status,
      data: moduleProgressData,
    };
  } catch (error) {
    console.error("Exception in recalculateModuleProgress:", error);
    return { success: false, error };
  }
}

// ============================================================================
// POST /api/v1/progress/materials/:materi_id/poins/:poin_id/complete
// Mark poin as completed
// ============================================================================
async function completePoin(req, res) {
  try {
    const { materi_id, poin_id } = req.params;
    const userId = req.user.id;
    const supabase = req.supabase;

    console.log("Completing poin:", {
      userId,
      poin_id,
      materi_id,
    });

    // Verify poin exists in database
    const { data: poinData, error: poinError } = await supabase
      .from("poin_details")
      .select("id, sub_materi_id")
      .eq("id", poin_id)
      .single();

    if (poinError || !poinData) {
      return failure(res, "POIN_NOT_FOUND", "Poin tidak ditemukan", 404);
    }

    // Upsert poin progress
    const { data: progressData, error: progressError } = await supabase
      .from("user_poin_progress")
      .upsert(
        {
          user_id: userId,
          poin_id: poin_id,
          is_completed: true,
          completed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,poin_id" }
      )
      .select()
      .single();

    if (progressError) {
      console.error("Error updating poin progress:", progressError);
      return failure(
        res,
        "PROGRESS_UPDATE_ERROR",
        "Gagal update progress poin",
        500
      );
    }

    // Get sub_materi info to update its progress
    const { data: subMateri, error: subMateriError } = await supabase
      .from("sub_materis")
      .select("id, module_id")
      .eq("id", poinData.sub_materi_id)
      .single();

    if (!subMateriError && subMateri) {
      // Count total poins and completed poins for this sub_materi
      const { count: totalPoins } = await supabase
        .from("poin_details")
        .select("*", { count: "exact", head: true })
        .eq("sub_materi_id", subMateri.id);

      const { count: completedPoins } = await supabase
        .from("user_poin_progress")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_completed", true)
        .in(
          "poin_id",
          (
            await supabase
              .from("poin_details")
              .select("id")
              .eq("sub_materi_id", subMateri.id)
          ).data?.map((p) => p.id) || []
        );

      const subMateriProgress =
        totalPoins > 0 ? (completedPoins / totalPoins) * 100 : 0;
      const isSubMateriCompleted = completedPoins === totalPoins && totalPoins > 0;

      // Update sub-materi progress
      await supabase.from("user_sub_materi_progress").upsert(
        {
          user_id: userId,
          sub_materi_id: subMateri.id,
          // module_id: subMateri.module_id, // Removed - column is integer but we have UUID
          progress_percentage: subMateriProgress,
          is_completed: isSubMateriCompleted,
          last_accessed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,sub_materi_id" }
      );

      // Recalculate module progress
      await recalculateModuleProgress(supabase, userId, subMateri.module_id);
    }

    return success(res, "POIN_COMPLETED", "Poin berhasil ditandai selesai", {
      progress: progressData,
    });
  } catch (error) {
    console.error("completePoin error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
}

// ============================================================================
// POST /api/v1/progress/sub-materis/:id/complete
// Mark sub-materi as completed
// ============================================================================
async function completeSubMateri(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const supabase = req.supabase;

    console.log("Completing sub-materi:", { userId, sub_materi_id: id });

    // Verify sub-materi exists
    const { data: subMateri, error: subMateriError } = await supabase
      .from("sub_materis")
      .select("id, module_id, title")
      .eq("id", id)
      .single();

    if (subMateriError || !subMateri) {
      return failure(
        res,
        "SUB_MATERI_NOT_FOUND",
        "Sub materi tidak ditemukan",
        404
      );
    }

    // Update sub-materi progress to completed
    const { data: progressData, error: progressError } = await supabase
      .from("user_sub_materi_progress")
      .upsert(
        {
          user_id: userId,
          sub_materi_id: id,
          module_id: subMateri.module_id,
          is_completed: true,
          progress_percentage: 100,
          last_accessed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,sub_materi_id" }
      )
      .select()
      .single();

    if (progressError) {
      console.error("Error updating sub-materi progress:", progressError);
      return failure(
        res,
        "PROGRESS_UPDATE_ERROR",
        "Gagal update progress sub materi",
        500
      );
    }

    // Recalculate module progress
    await recalculateModuleProgress(supabase, userId, subMateri.module_id);

    return success(
      res,
      "SUB_MATERI_COMPLETED",
      "Sub materi berhasil ditandai selesai",
      {
        progress: progressData,
      }
    );
  } catch (error) {
    console.error("completeSubMateri error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
}

// ============================================================================
// GET /api/v1/progress/modules/:module_id
// Get progress for specific module
// ============================================================================
async function getModuleProgress(req, res) {
  try {
    const { module_id } = req.params;
    const userId = req.user.id;
    const supabase = req.supabase;

    console.log("Getting module progress:", { userId, module_id });

    // Get module info
    const { data: module, error: moduleError } = await supabase
      .from("modules")
      .select("*")
      .eq("id", module_id)
      .single();

    if (moduleError || !module) {
      return failure(res, "MODULE_NOT_FOUND", "Modul tidak ditemukan", 404);
    }

    // Get module progress
    const { data: moduleProgress, error: progressError } = await supabase
      .from("user_module_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("module_id", module_id)
      .maybeSingle();

    // Get all sub-materis progress for this module
    // First get sub-materis for this module, then get their progress
    const { data: subMateris, error: subMaterisError } = await supabase
      .from("sub_materis")
      .select("id")
      .eq("module_id", module_id)
      .eq("published", true);

    let subMaterisProgress = [];
    let subProgressError = null;

    if (subMaterisError) {
      subProgressError = subMaterisError;
    } else if (subMateris && subMateris.length > 0) {
      const subMateriIds = subMateris.map(sm => sm.id);
      const { data: progressData, error: progressError } = await supabase
        .from("user_sub_materi_progress")
        .select("*")
        .eq("user_id", userId)
        .in("sub_materi_id", subMateriIds);
      
      subMaterisProgress = progressData || [];
      subProgressError = progressError;
    }

    if (progressError || subProgressError) {
      console.error("Error fetching progress:", {
        progressError,
        subProgressError,
      });
    }

    // If no progress yet, create initial record
    if (!moduleProgress) {
      await recalculateModuleProgress(supabase, userId, module_id);

      // Re-fetch after calculation
      const { data: newProgress } = await supabase
        .from("user_module_progress")
        .select("*")
        .eq("user_id", userId)
        .eq("module_id", module_id)
        .single();

      return success(res, "PROGRESS_FETCH_SUCCESS", "Progress berhasil diambil", {
        module: {
          ...module,
          progress: newProgress || {
            status: "not-started",
            progress_percent: 0,
          },
        },
        sub_materis_progress: subMaterisProgress || [],
      });
    }

    return success(res, "PROGRESS_FETCH_SUCCESS", "Progress berhasil diambil", {
      module: {
        ...module,
        progress: moduleProgress,
      },
      sub_materis_progress: subMaterisProgress || [],
    });
  } catch (error) {
    console.error("getModuleProgress error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
}

// ============================================================================
// GET /api/v1/progress/modules
// Get progress for all modules
// ============================================================================
async function getUserModulesProgress(req, res) {
  try {
    const userId = req.user.id;
    const supabase = req.supabase;

    console.log("Getting all modules progress for user:", userId);

    // Get all modules
    const { data: modules, error: modulesError } = await supabase
      .from("modules")
      .select("*")
      .eq("published", true)
      .order("created_at", { ascending: true });

    if (modulesError) {
      console.error("Error fetching modules:", modulesError);
      return failure(
        res,
        "MODULES_FETCH_ERROR",
        "Gagal mengambil data modul",
        500
      );
    }

    // Get all module progress for this user
    const { data: allProgress, error: progressError } = await supabase
      .from("user_module_progress")
      .select("*")
      .eq("user_id", userId);

    if (progressError) {
      console.error("Error fetching progress:", progressError);
    }

    // Map modules with their progress
    const modulesWithProgress = modules.map((module) => {
      const progress = allProgress?.find((p) => p.module_id === module.id);
      return {
        ...module,
        progress: progress || {
          status: "not-started",
          progress_percent: 0,
        },
      };
    });

    return success(
      res,
      "PROGRESS_FETCH_SUCCESS",
      "Progress berhasil diambil",
      {
        modules: modulesWithProgress,
        total: modulesWithProgress.length,
        completed: modulesWithProgress.filter(
          (m) => m.progress.status === "completed"
        ).length,
      }
    );
  } catch (error) {
    console.error("getUserModulesProgress error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
}

// ============================================================================
// GET /api/v1/progress/sub-materis/:id
// Get progress for specific sub-materi
// ============================================================================
async function getSubMateriProgress(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const supabase = req.supabase;

    console.log("Getting sub-materi progress:", { userId, sub_materi_id: id });

    // Get sub-materi info
    const { data: subMateri, error: subMateriError } = await supabase
      .from("sub_materis")
      .select("*, modules(*)")
      .eq("id", id)
      .single();

    if (subMateriError || !subMateri) {
      return failure(
        res,
        "SUB_MATERI_NOT_FOUND",
        "Sub materi tidak ditemukan",
        404
      );
    }

    // Get sub-materi progress
    const { data: progress, error: progressError } = await supabase
      .from("user_sub_materi_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("sub_materi_id", id)
      .maybeSingle();

    // Get poins progress
    const { data: poins, error: poinsError } = await supabase
      .from("poin_details")
      .select("id, title, order_index")
      .eq("sub_materi_id", id)
      .order("order_index", { ascending: true });

    if (!poinsError && poins) {
      const poinIds = poins.map((p) => p.id);
      const { data: poinsProgress } = await supabase
        .from("user_poin_progress")
        .select("*")
        .eq("user_id", userId)
        .in("poin_id", poinIds);

      // Map poins with progress
      const poinsWithProgress = poins.map((poin) => {
        const poinProgress = poinsProgress?.find((p) => p.poin_id === poin.id);
        return {
          ...poin,
          is_completed: poinProgress?.is_completed || false,
          completed_at: poinProgress?.completed_at || null,
        };
      });

      return success(
        res,
        "PROGRESS_FETCH_SUCCESS",
        "Progress berhasil diambil",
        {
          sub_materi: subMateri,
          progress: progress || {
            is_completed: false,
            progress_percentage: 0,
          },
          poins: poinsWithProgress,
        }
      );
    }

    return success(res, "PROGRESS_FETCH_SUCCESS", "Progress berhasil diambil", {
      sub_materi: subMateri,
      progress: progress || {
        is_completed: false,
        progress_percentage: 0,
      },
      poins: [],
    });
  } catch (error) {
    console.error("getSubMateriProgress error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
}

// ============================================================================
// GET /api/v1/progress/materials/:sub_materi_id/access
// Check if user can access a sub-materi (for sequential access control)
// ============================================================================
async function checkSubMateriAccess(req, res) {
  try {
    const { sub_materi_id } = req.params;
    const userId = req.user.id;
    const supabase = req.supabase;

    console.log("Checking sub-materi access:", {
      userId,
      sub_materi_id,
    });

    // Get sub-materi info
    const { data: subMateri, error: subMateriError } = await supabase
      .from("sub_materis")
      .select("id, module_id, order_index")
      .eq("id", sub_materi_id)
      .single();

    if (subMateriError || !subMateri) {
      return failure(
        res,
        "SUB_MATERI_NOT_FOUND",
        "Sub materi tidak ditemukan",
        404
      );
    }

    // Get sub-materi progress
    const { data: progress } = await supabase
      .from("user_sub_materi_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("sub_materi_id", sub_materi_id)
      .maybeSingle();

    // Always allow access (remove sequential restriction if not needed)
    // Or implement your own access control logic here

    return success(res, "ACCESS_CHECK_SUCCESS", "Akses berhasil dicek", {
      has_access: true,
      is_unlocked: true, // Always unlocked for now
      progress: progress || {
        is_completed: false,
        progress_percentage: 0,
      },
    });
  } catch (error) {
    console.error("checkSubMateriAccess error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
}

module.exports = {
  completePoin,
  completeSubMateri,
  getModuleProgress,
  getUserModulesProgress,
  getSubMateriProgress,
  checkSubMateriAccess,
  recalculateModuleProgress, // Export untuk digunakan di quiz submission
};
