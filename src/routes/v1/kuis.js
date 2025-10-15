const express = require("express");
const authMiddleware = require("../../middlewares/auth-middleware");
const { success, failure } = require("../../utils/respond");

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/v1/kuis/module/:moduleId - Get quizzes by module ID
const getQuizzesByModule = async (req, res) => {
  try {
    const { moduleId } = req.params;
    const userId = req.user.id;
    const client = req.supabase;

    // Get quizzes from sub-materials in the specified module
    const { data: quizzes, error: quizzesError } = await client
      .from("materis_quizzes")
      .select(
        `
        id,
        title,
        description,
        time_limit_seconds,
        passing_score,
        published,
        sub_materis!inner(
          id,
          title,
          module_id
        )
      `
      )
      .eq("sub_materis.module_id", moduleId)
      .eq("published", true)
      .order("created_at", { ascending: true });

    if (quizzesError) {
      console.error("Get quizzes by module error:", quizzesError);
      return failure(res, "QUIZZES_FETCH_ERROR", "Gagal mengambil quiz", 500, {
        details: quizzesError.message,
      });
    }

    // Get user's quiz attempts to check completion status
    const quizIds = quizzes?.map((q) => q.id) || [];
    let userAttempts = [];

    if (quizIds.length > 0) {
      const { data: attempts } = await client
        .from("user_quiz_attempts")
        .select("quiz_id, score, is_passed, completed_at")
        .eq("user_id", userId)
        .in("quiz_id", quizIds)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false });

      userAttempts = attempts || [];
    }

    // Format response with completion status
    const quizzesWithStatus = (quizzes || []).map((quiz) => {
      const latestAttempt = userAttempts.find(
        (attempt) => attempt.quiz_id === quiz.id
      );

      return {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        time_limit_seconds: quiz.time_limit_seconds,
        passing_score: quiz.passing_score,
        sub_materi: {
          id: quiz.sub_materis.id,
          title: quiz.sub_materis.title,
          module_id: quiz.sub_materis.module_id,
        },
        user_status: {
          is_completed: !!latestAttempt,
          score: latestAttempt?.score || null,
          is_passed: latestAttempt?.is_passed || false,
          completed_at: latestAttempt?.completed_at || null,
        },
      };
    });

    return success(res, "QUIZZES_FETCH_SUCCESS", "Quiz berhasil diambil", {
      module_id: moduleId,
      quizzes: quizzesWithStatus,
      total: quizzesWithStatus.length,
    });
  } catch (error) {
    console.error("Get quizzes by module error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// GET /api/v1/kuis/:id - Get specific quiz details
const getQuizById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const client = req.supabase;

    // Get quiz details
    const { data: quiz, error: quizError } = await client
      .from("materis_quizzes")
      .select(
        `
        id,
        title,
        description,
        time_limit_seconds,
        passing_score,
        published,
        created_at,
        sub_materis!inner(
          id,
          title,
          module_id,
          modules!inner(
            id,
            title
          )
        )
      `
      )
      .eq("id", id)
      .eq("published", true)
      .single();

    if (quizError || !quiz) {
      return failure(
        res,
        "QUIZ_NOT_FOUND",
        "Quiz tidak ditemukan atau belum dipublikasi",
        404
      );
    }

    // Get user's attempts for this quiz
    const { data: userAttempts } = await client
      .from("user_quiz_attempts")
      .select("id, score, is_passed, started_at, completed_at")
      .eq("user_id", userId)
      .eq("quiz_id", id)
      .order("started_at", { ascending: false });

    // Get question count
    const { count: questionCount } = await client
      .from("materis_quiz_questions")
      .select("*", { count: "exact", head: true })
      .eq("quiz_id", id);

    // Check if user has ongoing attempt
    const ongoingAttempt = userAttempts?.find(
      (attempt) => !attempt.completed_at
    );
    const latestCompletedAttempt = userAttempts?.find(
      (attempt) => attempt.completed_at
    );

    return success(res, "QUIZ_FETCH_SUCCESS", "Detail quiz berhasil diambil", {
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        time_limit_seconds: quiz.time_limit_seconds,
        passing_score: quiz.passing_score,
        question_count: questionCount || 0,
        sub_materi: {
          id: quiz.sub_materis.id,
          title: quiz.sub_materis.title,
          module_id: quiz.sub_materis.module_id,
        },
        module: {
          id: quiz.sub_materis.modules.id,
          title: quiz.sub_materis.modules.title,
        },
      },
      user_status: {
        has_ongoing_attempt: !!ongoingAttempt,
        ongoing_attempt_id: ongoingAttempt?.id || null,
        is_completed: !!latestCompletedAttempt,
        latest_score: latestCompletedAttempt?.score || null,
        is_passed: latestCompletedAttempt?.is_passed || false,
        attempt_count: userAttempts?.length || 0,
        last_completed_at: latestCompletedAttempt?.completed_at || null,
      },
      attempts: userAttempts || [],
    });
  } catch (error) {
    console.error("Get quiz by ID error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// GET /api/v1/kuis - Get all available quizzes for user
const getAllQuizzes = async (req, res) => {
  try {
    const userId = req.user.id;
    const client = req.supabase;
    const { page = 1, limit = 10, module_id } = req.query;
    const offset = (page - 1) * limit;

    let query = client
      .from("materis_quizzes")
      .select(
        `
        id,
        title,
        description,
        time_limit_seconds,
        passing_score,
        published,
        created_at,
        sub_materis!inner(
          id,
          title,
          module_id,
          modules!inner(
            id,
            title
          )
        )
      `
      )
      .eq("published", true);

    // Filter by module if specified
    if (module_id) {
      query = query.eq("sub_materis.module_id", module_id);
    }

    // Get total count for pagination
    let countQuery = client
      .from("materis_quizzes")
      .select("*", { count: "exact", head: true })
      .eq("published", true);

    if (module_id) {
      countQuery = countQuery.eq("sub_materis.module_id", module_id);
    }

    const { count } = await countQuery;

    // Get paginated quizzes
    const { data: quizzes, error: quizzesError } = await query
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (quizzesError) {
      console.error("Get all quizzes error:", quizzesError);
      return failure(res, "QUIZZES_FETCH_ERROR", "Gagal mengambil quiz", 500, {
        details: quizzesError.message,
      });
    }

    // Get user's quiz attempts to check completion status
    const quizIds = quizzes?.map((q) => q.id) || [];
    let userAttempts = [];

    if (quizIds.length > 0) {
      const { data: attempts } = await client
        .from("user_quiz_attempts")
        .select("quiz_id, score, is_passed, completed_at")
        .eq("user_id", userId)
        .in("quiz_id", quizIds)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false });

      userAttempts = attempts || [];
    }

    // Format response with completion status
    const quizzesWithStatus = (quizzes || []).map((quiz) => {
      const latestAttempt = userAttempts.find(
        (attempt) => attempt.quiz_id === quiz.id
      );

      return {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        time_limit_seconds: quiz.time_limit_seconds,
        passing_score: quiz.passing_score,
        sub_materi: {
          id: quiz.sub_materis.id,
          title: quiz.sub_materis.title,
          module_id: quiz.sub_materis.module_id,
        },
        module: {
          id: quiz.sub_materis.modules.id,
          title: quiz.sub_materis.modules.title,
        },
        user_status: {
          is_completed: !!latestAttempt,
          score: latestAttempt?.score || null,
          is_passed: latestAttempt?.is_passed || false,
          completed_at: latestAttempt?.completed_at || null,
        },
      };
    });

    return success(
      res,
      "QUIZZES_FETCH_SUCCESS",
      "Daftar quiz berhasil diambil",
      {
        quizzes: quizzesWithStatus,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      }
    );
  } catch (error) {
    console.error("Get all quizzes error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// Route definitions
router.get("/module/:moduleId", getQuizzesByModule);
router.get("/:id", getQuizById);
router.get("/", getAllQuizzes);

module.exports = router;
