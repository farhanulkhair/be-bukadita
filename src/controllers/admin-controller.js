const { supabase } = require("../lib/SupabaseClient");
const { paginate } = require("../utils/paginate");

// GET /api/admin/users - Get all user profiles (admin only)
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search } = req.query;

    let query = supabase
      .from("profiles")
      .select("id, full_name, phone, role, created_at", { count: "exact" });

    // Filter by role if specified
    if (role && ["pengguna", "admin"].includes(role)) {
      query = query.eq("role", role);
    }

    // Search by name or phone
    if (search) {
      query = query.or(`full_name.ilike.%${search}%, phone.ilike.%${search}%`);
    }

    // Apply pagination
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      console.error("Get users error:", error);
      return res.status(500).json({
        error: {
          message: "Failed to fetch users",
          code: "FETCH_ERROR",
        },
      });
    }

    const pagination = paginate(count, parseInt(page), parseInt(limit));

    res.status(200).json({
      message: "Users retrieved successfully",
      data,
      pagination,
    });
  } catch (error) {
    console.error("Admin controller error:", error);
    res.status(500).json({
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
    });
  }
};

// GET /api/admin/dashboard/stats - Get dashboard statistics (admin only)
const getDashboardStats = async (req, res) => {
  try {
    // Get user counts
    const { data: userStats, error: userError } = await supabase
      .from("profiles")
      .select("role", { count: "exact" });

    if (userError) {
      console.error("Get user stats error:", userError);
    }

    const totalUsers = userStats?.length || 0;
    const adminUsers = userStats?.filter((u) => u.role === "admin").length || 0;
    const regularUsers =
      userStats?.filter((u) => u.role === "pengguna").length || 0;

    // Get materials count
    const { count: materialsCount, error: materialsError } = await supabase
      .from("materials")
      .select("*", { count: "exact", head: true });

    if (materialsError) {
      console.error("Get materials count error:", materialsError);
    }

    // Get published materials count
    const { count: publishedMaterialsCount, error: publishedError } =
      await supabase
        .from("materials")
        .select("*", { count: "exact", head: true })
        .eq("published", true);

    if (publishedError) {
      console.error("Get published materials count error:", publishedError);
    }

    // Get quizzes count
    const { count: quizzesCount, error: quizzesError } = await supabase
      .from("quizzes")
      .select("*", { count: "exact", head: true });

    if (quizzesError) {
      console.error("Get quizzes count error:", quizzesError);
    }

    // Get schedules count
    const { count: schedulesCount, error: schedulesError } = await supabase
      .from("posyandu_schedules")
      .select("*", { count: "exact", head: true });

    if (schedulesError) {
      console.error("Get schedules count error:", schedulesError);
    }

    // Get quiz results count (total submissions)
    const { count: quizSubmissionsCount, error: submissionsError } =
      await supabase
        .from("quiz_results")
        .select("*", { count: "exact", head: true });

    if (submissionsError) {
      console.error("Get quiz submissions count error:", submissionsError);
    }

    res.status(200).json({
      message: "Dashboard statistics retrieved successfully",
      data: {
        users: {
          total: totalUsers,
          admin: adminUsers,
          regular: regularUsers,
        },
        materials: {
          total: materialsCount || 0,
          published: publishedMaterialsCount || 0,
          draft: (materialsCount || 0) - (publishedMaterialsCount || 0),
        },
        quizzes: {
          total: quizzesCount || 0,
          submissions: quizSubmissionsCount || 0,
        },
        schedules: {
          total: schedulesCount || 0,
        },
      },
    });
  } catch (error) {
    console.error("Admin controller error:", error);
    res.status(500).json({
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
    });
  }
};

// GET /api/admin/quiz-results - Get all quiz results (admin only)
const getAllQuizResults = async (req, res) => {
  try {
    const { page = 1, limit = 10, quiz_id, user_id } = req.query;

    let query = supabase.from("quiz_results").select(
      `
        id,
        score,
        taken_at,
        profiles:user_id (
          id,
          full_name
        ),
        quizzes:quiz_id (
          id,
          title
        )
      `,
      { count: "exact" }
    );

    // Filter by quiz if specified
    if (quiz_id) {
      query = query.eq("quiz_id", quiz_id);
    }

    // Filter by user if specified
    if (user_id) {
      query = query.eq("user_id", user_id);
    }

    // Apply pagination
    const { data, error, count } = await query
      .order("taken_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      console.error("Get quiz results error:", error);
      return res.status(500).json({
        error: {
          message: "Failed to fetch quiz results",
          code: "FETCH_ERROR",
        },
      });
    }

    const pagination = paginate(count, parseInt(page), parseInt(limit));

    res.status(200).json({
      message: "Quiz results retrieved successfully",
      data,
      pagination,
    });
  } catch (error) {
    console.error("Admin controller error:", error);
    res.status(500).json({
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
    });
  }
};

// PUT /api/admin/users/:id/role - Update user role (admin only)
const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    // Validate role
    if (!role || !["pengguna", "admin"].includes(role)) {
      return res.status(400).json({
        error: {
          message: 'Invalid role. Must be "pengguna" or "admin"',
          code: "VALIDATION_ERROR",
        },
      });
    }

    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", id)
      .single();

    if (fetchError || !existingUser) {
      return res.status(404).json({
        error: {
          message: "User not found",
          code: "NOT_FOUND",
        },
      });
    }

    // Prevent changing own role
    if (id === req.user.id) {
      return res.status(400).json({
        error: {
          message: "Cannot change your own role",
          code: "INVALID_OPERATION",
        },
      });
    }

    // Update role
    const { data, error: updateError } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Update user role error:", updateError);
      return res.status(500).json({
        error: {
          message: "Failed to update user role",
          code: "UPDATE_ERROR",
        },
      });
    }

    res.status(200).json({
      message: "User role updated successfully",
      data,
    });
  } catch (error) {
    console.error("Admin controller error:", error);
    res.status(500).json({
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
    });
  }
};

module.exports = {
  getAllUsers,
  getDashboardStats,
  getAllQuizResults,
  updateUserRole,
};
