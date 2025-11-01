const { supabase, supabaseAdmin } = require("../lib/SupabaseClient");
const { success, failure } = require("../utils/respond");

// Helper function to get relative time
function getRelativeTime(timestamp) {
  if (!timestamp) return "Unknown";
  
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now - time;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return "Baru saja";
  if (diffMins < 60) return `${diffMins} menit lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays < 7) return `${diffDays} hari lalu`;
  return time.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

/**
 * GET /api/v1/admin/dashboard/stats - Get comprehensive dashboard statistics
 * Returns real data from database for admin dashboard
 */
const getComprehensiveDashboardStats = async (req, res) => {
  try {
    const client = supabaseAdmin || req.authenticatedClient || supabase;
    
    console.log("Fetching comprehensive dashboard stats...");
    
    // Use Promise.all for parallel queries for better performance
    const [
      usersResult,
      modulesResult,
      materialsResult,
      quizzesResult,
      quizAttemptsResult,
      moduleProgressResult,
      recentActivitiesResult
    ] = await Promise.all([
      // 1. Total users with created_at
      client.from("profiles").select("id, role, created_at"),
      
      // 2. Total modules
      client.from("modules").select("*", { count: "exact", head: true }),
      
      // 3. Total materials
      client.from("sub_materis").select("*", { count: "exact", head: true }),
      
      // 4. Total quizzes
      client.from("materis_quizzes").select("*", { count: "exact", head: true }),
      
      // 5. Quiz attempts and completions
      client.from("user_quiz_attempts")
        .select("id, user_id, completed_at, passed, created_at"),
      
      // 6. Module progress stats
      client.from("user_module_progress")
        .select(`
          id, user_id, module_id, is_completed, progress_percentage,
          modules!inner(id, title)
        `),
      
      // 7. Recent quiz attempts for activities
      client.from("user_quiz_attempts")
        .select(`
          id, score, passed, completed_at,
          profiles!inner(id, full_name),
          materis_quizzes!inner(id, title)
        `)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(15)
    ]);

    console.log("Database queries completed successfully");

    // Process users data
    const users = usersResult.data || [];
    const totalUsers = users.length;
    const regularUsers = users.filter(u => u.role === "pengguna").length;
    const adminUsers = users.filter(u => u.role === "admin").length;
    
    // Active users today (users who have quiz attempts or module progress today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activeUsersToday = new Set(
      (quizAttemptsResult.data || [])
        .filter(attempt => {
          if (!attempt.created_at) return false;
          const attemptDate = new Date(attempt.created_at);
          return attemptDate >= today;
        })
        .map(attempt => attempt.user_id)
    ).size;

    // New users this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const newUsersThisWeek = users.filter(u => {
      if (!u.created_at) return false;
      const createdDate = new Date(u.created_at);
      return createdDate >= oneWeekAgo;
    }).length;

    // Process modules data
    const totalModules = modulesResult.count || 0;
    
    // Process materials data
    const totalMaterials = materialsResult.count || 0;
    
    // Process quizzes data
    const totalQuizzes = quizzesResult.count || 0;
    
    // Process quiz attempts
    const quizAttempts = quizAttemptsResult.data || [];
    const completedQuizzes = quizAttempts.filter(a => a.completed_at).length;
    const passedQuizzes = quizAttempts.filter(a => a.passed).length;
    
    // Calculate average completion rate
    const averageCompletionRate = completedQuizzes > 0 
      ? Math.round((passedQuizzes / completedQuizzes) * 100)
      : 0;

    // Process module completion stats
    const moduleProgress = moduleProgressResult.data || [];
    const moduleStats = {};
    
    moduleProgress.forEach(progress => {
      const moduleId = progress.module_id;
      const moduleTitle = progress.modules?.title || `Module ${moduleId}`;
      
      if (!moduleStats[moduleId]) {
        moduleStats[moduleId] = {
          module_id: moduleId,
          module_title: moduleTitle,
          total_users_started: new Set(),
          total_users_completed: 0,
          total_progress: 0,
          count: 0
        };
      }
      
      moduleStats[moduleId].total_users_started.add(progress.user_id);
      if (progress.is_completed) {
        moduleStats[moduleId].total_users_completed++;
      }
      moduleStats[moduleId].total_progress += progress.progress_percentage || 0;
      moduleStats[moduleId].count++;
    });

    const moduleCompletionStats = Object.values(moduleStats).map(stat => ({
      module_id: stat.module_id,
      module_title: stat.module_title,
      total_users_started: stat.total_users_started.size,
      total_users_completed: stat.total_users_completed,
      completion_rate: stat.total_users_started.size > 0
        ? Math.round((stat.total_users_completed / stat.total_users_started.size) * 100)
        : 0,
      average_progress: stat.count > 0
        ? Math.round(stat.total_progress / stat.count)
        : 0
    })).sort((a, b) => b.total_users_started - a.total_users_started);

    // Process recent activities
    const recentActivities = (recentActivitiesResult.data || []).slice(0, 10).map(activity => ({
      id: activity.id,
      user: activity.profiles?.full_name || "Pengguna",
      action: activity.passed ? "Menyelesaikan Kuis" : "Mengikuti Kuis",
      category: activity.materis_quizzes?.title || "Kuis",
      score: activity.score,
      passed: activity.passed,
      time: activity.completed_at,
      relative_time: getRelativeTime(activity.completed_at)
    }));

    // Compile final stats
    const stats = {
      total_users: totalUsers,
      regular_users: regularUsers,
      admin_users: adminUsers,
      active_users_today: activeUsersToday,
      new_users_this_week: newUsersThisWeek,
      total_modules: totalModules,
      total_materials: totalMaterials,
      total_quizzes: totalQuizzes,
      completed_quizzes_total: completedQuizzes,
      passed_quizzes_total: passedQuizzes,
      average_completion_rate: averageCompletionRate,
      module_completion_stats: moduleCompletionStats,
      recent_activities: recentActivities,
      last_updated: new Date().toISOString()
    };

    console.log("Dashboard stats compiled successfully:", {
      totalUsers,
      totalModules,
      totalQuizzes,
      activeUsersToday,
      moduleStatsCount: moduleCompletionStats.length
    });

    return success(
      res,
      "DASHBOARD_STATS_SUCCESS",
      "Dashboard statistics retrieved successfully",
      stats
    );
  } catch (e) {
    console.error("Dashboard stats error:", e);
    return failure(
      res,
      "DASHBOARD_STATS_ERROR",
      "Failed to retrieve dashboard statistics",
      500,
      { details: e.message }
    );
  }
};

module.exports = {
  getComprehensiveDashboardStats
};

