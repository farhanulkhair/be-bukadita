const express = require("express");
const authMiddleware = require("../../middlewares/auth-middleware");
const { requireAdmin } = require("../../middlewares/role-middleware");
const { success, failure } = require("../../utils/respond");
const { submitQuizAnswersSchema } = require("../../validators/quiz-validator");
const {
  getAllQuizzes,
  getQuizById,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  addQuestionToQuiz,
  updateQuestion,
  deleteQuestion,
  getSubMaterisForDropdown,
} = require("../../controllers/quiz-controller");
const {
  recalculateModuleProgress,
} = require("../../controllers/progress-controller");

const router = express.Router();

// ============================================================================
// USER ROUTES (FE - authenticated users)
// ============================================================================

// GET /api/v1/quizzes - Get all published quizzes for user
router.get("/", authMiddleware, async (req, res) => {
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
      // For count query with join, we need different approach
      countQuery = countQuery.eq(
        "sub_materi_id",
        req.query.sub_materi_id || null
      );
    }

    const { count } = await countQuery;

    // Get paginated quizzes
    const { data: quizzes, error: quizzesError } = await query
      .order("created_at", { ascending: true })
      .range(offset, offset + parseInt(limit) - 1);

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
        .select("quiz_id, score, passed, completed_at")
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
          passed: latestAttempt?.passed || false,
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
});

// GET /api/v1/quizzes/module/:moduleId - Get quizzes by module ID
router.get("/module/:moduleId", authMiddleware, async (req, res) => {
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
        .select("quiz_id, score, passed, completed_at")
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
          passed: latestAttempt?.passed || false,
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
});

// GET /api/v1/quizzes/:id - Get specific quiz details
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const client = req.supabase;
    const profile = req.profile || req.user?.profile;
    const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";

    // Build query - admin can see unpublished quizzes
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
      .eq("id", id);

    // Only filter by published if not admin
    if (!isAdmin) {
      query = query.eq("published", true);
    }

    const { data: quiz, error: quizError } = await query.single();

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
      .select("id, score, passed, started_at, completed_at")
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
        published: quiz.published,
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
        passed: latestCompletedAttempt?.passed || false,
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
});

// POST /api/v1/quizzes/:quizId/start - Start quiz attempt
router.post("/:quizId/start", authMiddleware, async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user.id;
    const client = req.supabase;

    // Check if quiz exists and is published
    const { data: quiz, error: quizError } = await client
      .from("materis_quizzes")
      .select(
        "id, title, description, time_limit_seconds, passing_score, published"
      )
      .eq("id", quizId)
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

    // Check if user has ongoing attempt
    const { data: ongoingAttempt } = await client
      .from("user_quiz_attempts")
      .select("id, started_at, completed_at")
      .eq("user_id", userId)
      .eq("quiz_id", quizId)
      .is("completed_at", null)
      .maybeSingle();

    if (ongoingAttempt) {
      return failure(
        res,
        "QUIZ_ALREADY_STARTED",
        "Anda sudah memulai quiz ini. Selesaikan terlebih dahulu.",
        409,
        { attemptId: ongoingAttempt.id }
      );
    }

    // Create new attempt
    const attemptData = {
      user_id: userId,
      quiz_id: quizId,
      started_at: new Date().toISOString(),
    };

    const { data: newAttempt, error: attemptError } = await client
      .from("user_quiz_attempts")
      .insert([attemptData])
      .select("id, started_at")
      .single();

    if (attemptError) {
      console.error("Create attempt error:", attemptError);
      return failure(res, "ATTEMPT_CREATE_ERROR", "Gagal memulai quiz", 500, {
        details: attemptError.message,
      });
    }

    return success(res, "QUIZ_STARTED", "Quiz berhasil dimulai", {
      attempt_id: newAttempt.id,
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        time_limit_seconds: quiz.time_limit_seconds,
        passing_score: quiz.passing_score,
      },
      started_at: newAttempt.started_at,
    });
  } catch (error) {
    console.error("Start quiz error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
});

// GET /api/v1/quizzes/:quizId/questions - Get quiz questions for user
router.get("/:quizId/questions", authMiddleware, async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user.id;
    const client = req.supabase;

    // Check if user has started the quiz (get most recent active attempt)
    const { data: attempts } = await client
      .from("user_quiz_attempts")
      .select("id, started_at, completed_at, answers")
      .eq("user_id", userId)
      .eq("quiz_id", quizId)
      .is("completed_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    const attempt = attempts?.[0] || null;

    if (!attempt) {
      return failure(
        res,
        "QUIZ_NOT_STARTED",
        "Anda belum memulai quiz ini. Mulai quiz terlebih dahulu.",
        400
      );
    }

    // Get quiz questions (hide correct answers)
    const { data: questions, error: questionsError } = await client
      .from("materis_quiz_questions")
      .select("id, question_text, options, explanation, order_index")
      .eq("quiz_id", quizId)
      .order("order_index", { ascending: true });

    if (questionsError) {
      console.error("Get questions error:", questionsError);
      return failure(
        res,
        "QUESTIONS_FETCH_ERROR",
        "Gagal mengambil soal",
        500,
        {
          details: questionsError.message,
        }
      );
    }

    // Get existing answers from attempt record
    let existingAnswersMap = {};
    if (attempt.answers && Array.isArray(attempt.answers)) {
      // Create a map for quick lookup
      existingAnswersMap = {};
      attempt.answers.forEach((ans) => {
        existingAnswersMap[ans.question_id] = ans.selected_option_index;
      });
    }

    // Format questions with user answers
    const questionsWithAnswers = questions.map((question) => {
      const selectedAnswer = existingAnswersMap[question.id];

      // Convert options from array of strings to array of objects
      const formattedOptions = Array.isArray(question.options)
        ? question.options.map((option, index) => ({
            text: option,
            index: index,
          }))
        : question.options;

      return {
        id: question.id,
        question_text: question.question_text,
        options: formattedOptions,
        order_index: question.order_index,
        selected_answer: selectedAnswer !== undefined ? selectedAnswer : null,
      };
    });

    return success(res, "QUESTIONS_FETCH_SUCCESS", "Soal berhasil diambil", {
      attempt_id: attempt.id,
      questions: questionsWithAnswers,
      started_at: attempt.started_at,
    });
  } catch (error) {
    console.error("Get quiz questions error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
});

// POST /api/v1/quizzes/:quizId/submit - Submit quiz answers
router.post("/:quizId/submit", authMiddleware, async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user.id;
    const client = req.supabase;

    // Validate input
    const { error: validationError, value } = submitQuizAnswersSchema.validate(
      req.body
    );
    if (validationError) {
      return failure(
        res,
        "VALIDATION_ERROR",
        validationError.details[0].message,
        422
      );
    }

    // Get user's ongoing attempt (most recent one)
    const { data: attempts, error: attemptError } = await client
      .from("user_quiz_attempts")
      .select("id, started_at, completed_at")
      .eq("user_id", userId)
      .eq("quiz_id", quizId)
      .is("completed_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (attemptError) {
      console.error("Attempt fetch error:", attemptError);
      return failure(
        res,
        "ATTEMPT_FETCH_ERROR",
        "Gagal mengambil data attempt",
        500,
        { details: attemptError.message }
      );
    }

    const attempt = attempts?.[0] || null;

    if (!attempt) {
      console.error("No attempt found for user:", { userId, quizId });
      return failure(
        res,
        "ATTEMPT_NOT_FOUND",
        "Quiz attempt tidak ditemukan atau sudah selesai",
        404
      );
    }

    console.log("Attempt found:", { attemptId: attempt.id, userId, quizId });

    // Get quiz details and questions
    const { data: quiz, error: quizError } = await client
      .from("materis_quizzes")
      .select(
        "id, title, passing_score, time_limit_seconds, sub_materi_id, module_id"
      )
      .eq("id", quizId)
      .single();

    const { data: questions, error: questionsError } = await client
      .from("materis_quiz_questions")
      .select("id, correct_answer_index")
      .eq("quiz_id", quizId);

    if (quizError || questionsError || !quiz || !questions) {
      return failure(res, "QUIZ_FETCH_ERROR", "Gagal mengambil data quiz", 500);
    }

    // Calculate score and prepare answer details
    let correctAnswers = 0;
    const answerDetails = [];

    for (const answer of value.answers) {
      const question = questions.find((q) => q.id === answer.question_id);
      if (question) {
        const isCorrect =
          question.correct_answer_index === answer.selected_option_index;
        if (isCorrect) correctAnswers++;

        answerDetails.push({
          question_id: answer.question_id,
          selected_option_index: answer.selected_option_index,
          is_correct: isCorrect,
        });
      }
    }

    const totalQuestions = questions.length;
    const scorePercentage =
      totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
    const isPassed = scorePercentage >= quiz.passing_score;

    // Calculate time taken
    const startedAt = new Date(attempt.started_at);
    const completedAt = new Date();
    const timeTakenSeconds = Math.round((completedAt - startedAt) / 1000);

    console.log("Submitting quiz answers:", {
      attemptId: attempt.id,
      userId,
      quizId,
      correctAnswers,
      totalQuestions,
      scorePercentage,
      isPassed,
      answerCount: value.answers.length,
    });

    // Verify attempt exists before update
    const { data: verifyAttempt, error: verifyError } = await client
      .from("user_quiz_attempts")
      .select("id, user_id, quiz_id, completed_at")
      .eq("id", attempt.id)
      .single();

    if (verifyError || !verifyAttempt) {
      console.error("Attempt verification failed:", {
        verifyError,
        attemptId: attempt.id,
      });
      return failure(
        res,
        "ATTEMPT_VERIFICATION_ERROR",
        "Attempt record tidak ditemukan sebelum update",
        500
      );
    }

    console.log("Attempt verified:", verifyAttempt);

    // Update attempt as completed (save answers in jsonb field and update score)
    const { error: updateError } = await client
      .from("user_quiz_attempts")
      .update({
        completed_at: completedAt.toISOString(),
        score: scorePercentage,
        passed: isPassed,
        correct_answers: correctAnswers,
        total_questions: totalQuestions,
        answers: answerDetails, // Save answer details in jsonb field
      })
      .eq("id", attempt.id);

    if (updateError) {
      console.error("Update attempt error:", updateError);
      console.error("Update details:", {
        attemptId: attempt.id,
        userId,
        quizId,
      });
      return failure(
        res,
        "ATTEMPT_UPDATE_ERROR",
        "Gagal menyelesaikan quiz",
        500,
        {
          details: updateError.message,
        }
      );
    }

    // Now fetch the updated attempt
    const { data: rawAttempt, error: fetchError } = await client
      .from("user_quiz_attempts")
      .select(
        "id, score, passed, completed_at, started_at, correct_answers, total_questions, answers"
      )
      .eq("id", attempt.id)
      .single();

    if (fetchError) {
      console.error("Fetch updated attempt error:", fetchError);
      console.error("Fetch details:", {
        attemptId: attempt.id,
        userId,
        quizId,
      });
      return failure(
        res,
        "ATTEMPT_FETCH_ERROR",
        "Gagal mengambil data attempt yang telah diselesaikan",
        500,
        {
          details: fetchError.message,
        }
      );
    }

    // Return success with completed attempt data
    if (!rawAttempt) {
      return failure(
        res,
        "ATTEMPT_DATA_ERROR",
        "Gagal mengambil data attempt yang telah diselesaikan",
        500
      );
    }

    // Update sub-materi progress after quiz completion
    if (quiz.sub_materi_id && quiz.module_id) {
      console.log("Updating sub-materi progress after quiz:", {
        userId,
        sub_materi_id: quiz.sub_materi_id,
        module_id: quiz.module_id,
        score: scorePercentage,
        isPassed,
      });

      try {
        // Update sub-materi progress
        await client.from("user_sub_materi_progress").upsert(
          {
            user_id: userId,
            module_id: quiz.module_id,
            sub_materi_id: quiz.sub_materi_id,
            is_completed: isPassed,
            progress_percentage: isPassed ? 100 : scorePercentage,
            last_accessed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,sub_materi_id",
            ignoreDuplicates: false,
          }
        );

        // Recalculate module progress based on quiz completion
        console.log("Recalculating module progress after quiz submission...");
        await recalculateModuleProgress(client, userId, quiz.module_id);
      } catch (progressUpdateError) {
        console.error(
          "Error updating sub-materi progress:",
          progressUpdateError
        );
      }
    }

    return success(res, "QUIZ_SUBMITTED", "Quiz berhasil diselesaikan", {
      attempt: rawAttempt,
      results: {
        score: scorePercentage,
        correct_answers: correctAnswers,
        total_questions: totalQuestions,
        is_passed: isPassed,
        passing_score: quiz.passing_score,
      },
    });
  } catch (error) {
    console.error("Submit quiz error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
});

// GET /api/v1/quizzes/:quizId/results - Get quiz results
router.get("/:quizId/results", authMiddleware, async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user.id;
    const client = req.supabase;

    // Get latest completed attempt with all details
    const { data: rawAttempt, error: attemptError } = await client
      .from("user_quiz_attempts")
      .select(
        "id, score, passed, completed_at, started_at, correct_answers, total_questions, answers"
      )
      .eq("user_id", userId)
      .eq("quiz_id", quizId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (attemptError) {
      console.error("GET /results - Attempt fetch error:", attemptError);
      return failure(res, "ATTEMPT_FETCH_ERROR", "Gagal mengambil hasil", 500, {
        details: attemptError.message,
      });
    }

    if (!rawAttempt) {
      return failure(
        res,
        "NO_RESULTS_FOUND",
        "Belum ada hasil quiz untuk ditampilkan",
        404
      );
    }

    // Get quiz details
    const { data: quiz, error: quizError } = await client
      .from("materis_quizzes")
      .select("id, title, passing_score")
      .eq("id", quizId)
      .single();

    if (quizError) {
      console.error("GET /results - Quiz fetch error:", quizError);
      return failure(res, "QUIZ_FETCH_ERROR", "Gagal mengambil data quiz", 500);
    }

    // Get detailed answers if requested
    const { includeAnswers } = req.query;
    let answerDetails = [];

    if (includeAnswers === "true" && rawAttempt.answers) {
      // Get question details for enriching answer data
      const { data: questions, error: questionsError } = await client
        .from("materis_quiz_questions")
        .select(
          "id, question_text, options, correct_answer_index, explanation, order_index"
        )
        .eq("quiz_id", quizId)
        .order("order_index");

      if (!questionsError && questions) {
        // Create a map for quick lookup
        const questionsMap = {};
        questions.forEach((q) => {
          questionsMap[q.id] = q;
        });

        // Enrich answer details with question information
        answerDetails = rawAttempt.answers.map((ans) => {
          const question = questionsMap[ans.question_id];
          return {
            question_id: ans.question_id,
            question_text: question?.question_text || "",
            options: question?.options || [],
            selected_option_index: ans.selected_option_index,
            is_correct: ans.is_correct,
            correct_answer_index: question?.correct_answer_index,
            explanation: question?.explanation || "",
          };
        });
      }
    }

    return success(
      res,
      "RESULTS_FETCH_SUCCESS",
      "Hasil quiz berhasil diambil",
      {
        quiz: {
          id: quiz?.id,
          title: quiz?.title,
          passing_score: quiz?.passing_score,
        },
        attempt: {
          id: rawAttempt.id,
          score: rawAttempt.score,
          passed: rawAttempt.passed,
          correct_answers: rawAttempt.correct_answers,
          total_questions: rawAttempt.total_questions,
          started_at: rawAttempt.started_at,
          completed_at: rawAttempt.completed_at,
        },
        answer_details: answerDetails,
      }
    );
  } catch (error) {
    console.error("Get quiz results error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
});

// GET /api/v1/quizzes/attempts/my - Get all user's quiz attempts
router.get("/attempts/my", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const client = req.supabase;
    const { page = 1, limit = 10, status, module_id } = req.query;
    const offset = (page - 1) * limit;

    let query = client
      .from("user_quiz_attempts")
      .select(
        `
        id, score, passed, started_at, completed_at,
        materis_quizzes!inner(
          id, title, passing_score,
          sub_materis!inner(id, title, module_id)
        )
      `
      )
      .eq("user_id", userId);

    // Filter by module if specified
    if (module_id) {
      query = query.eq("materis_quizzes.sub_materis.module_id", module_id);
    }

    // Filter by status
    if (status === "completed") {
      query = query.not("completed_at", "is", null);
    } else if (status === "ongoing") {
      query = query.is("completed_at", null);
    }

    // Get total count
    let countQuery = client
      .from("user_quiz_attempts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (module_id) {
      // For count query with filter
      countQuery = countQuery.in(
        "quiz_id",
        await client
          .from("materis_quizzes")
          .select("id")
          .eq("module_id", module_id)
          .then((r) => r.data?.map((q) => q.id) || [])
      );
    }

    // Get paginated results
    const { data: attempts, error } = await query
      .order("started_at", { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    const { count } = await countQuery;

    if (error) {
      console.error("Get attempts error:", error);
      return failure(
        res,
        "ATTEMPTS_FETCH_ERROR",
        "Gagal mengambil riwayat quiz",
        500,
        {
          details: error.message,
        }
      );
    }

    return success(
      res,
      "ATTEMPTS_FETCH_SUCCESS",
      "Riwayat quiz berhasil diambil",
      {
        attempts: attempts || [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      }
    );
  } catch (error) {
    console.error("Get my quiz attempts error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
});

// ============================================================================
// ADMIN ONLY ROUTES (Backoffice only)
// ============================================================================

// GET /api/v1/quizzes/admin/all - Get all quizzes for admin (including unpublished)
router.get("/admin/all", authMiddleware, requireAdmin, getAllQuizzes);

// GET /api/v1/quizzes/admin/:id - Get quiz detail with questions (admin only)
router.get("/admin/:id", authMiddleware, requireAdmin, getQuizById);

// POST /api/v1/quizzes/admin - Create new quiz (Admin only)
router.post("/admin", authMiddleware, requireAdmin, createQuiz);

// PUT /api/v1/quizzes/admin/:id - Update quiz (Admin only)
router.put("/admin/:id", authMiddleware, requireAdmin, updateQuiz);

// DELETE /api/v1/quizzes/admin/:id - Delete quiz (Admin only)
router.delete("/admin/:id", authMiddleware, requireAdmin, deleteQuiz);

// POST /api/v1/quizzes/admin/:quizId/questions - Add question to quiz (Admin only)
router.post(
  "/admin/:quizId/questions",
  authMiddleware,
  requireAdmin,
  addQuestionToQuiz
);

// PUT /api/v1/quizzes/admin/questions/:id - Update question (Admin only)
router.put(
  "/admin/questions/:id",
  authMiddleware,
  requireAdmin,
  updateQuestion
);

// DELETE /api/v1/quizzes/admin/questions/:id - Delete question (Admin only)
router.delete(
  "/admin/questions/:id",
  authMiddleware,
  requireAdmin,
  deleteQuestion
);

// GET /api/v1/quizzes/admin/sub-materis - Get sub-materis for dropdown (Admin only)
router.get(
  "/admin/sub-materis",
  authMiddleware,
  requireAdmin,
  getSubMaterisForDropdown
);

module.exports = router;
