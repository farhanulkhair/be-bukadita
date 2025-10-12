const express = require("express");
const authMiddleware = require("../../middlewares/auth-middleware");
const { success, failure } = require("../../utils/respond");
const { submitQuizAnswersSchema } = require("../../validators/quiz-validator");

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/v1/user-quizzes/:quizId/start - Start quiz attempt
const startQuizAttempt = async (req, res) => {
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
};

// GET /api/v1/user-quizzes/:quizId/questions - Get quiz questions for user
const getQuizQuestions = async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user.id;
    const client = req.supabase;

    // Check if user has started the quiz
    const { data: attempt } = await client
      .from("user_quiz_attempts")
      .select("id, started_at, completed_at")
      .eq("user_id", userId)
      .eq("quiz_id", quizId)
      .is("completed_at", null)
      .maybeSingle();

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

    // Get existing answers if any
    const { data: userAnswers } = await client
      .from("user_quiz_answers")
      .select("question_id, selected_option_index")
      .eq("attempt_id", attempt.id);

    // Format questions with user answers
    const questionsWithAnswers = questions.map((question) => {
      const userAnswer = userAnswers?.find(
        (ua) => ua.question_id === question.id
      );
      return {
        id: question.id,
        question_text: question.question_text,
        options: question.options,
        order_index: question.order_index,
        selected_answer: userAnswer ? userAnswer.selected_option_index : null,
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
};

// POST /api/v1/user-quizzes/:quizId/submit - Submit quiz answers
const submitQuizAnswers = async (req, res) => {
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

    // Get user's ongoing attempt
    const { data: attempt, error: attemptError } = await client
      .from("user_quiz_attempts")
      .select("id, started_at, completed_at")
      .eq("user_id", userId)
      .eq("quiz_id", quizId)
      .is("completed_at", null)
      .single();

    if (attemptError || !attempt) {
      return failure(
        res,
        "ATTEMPT_NOT_FOUND",
        "Quiz attempt tidak ditemukan atau sudah selesai",
        404
      );
    }

    // Get quiz details and questions
    const { data: quiz, error: quizError } = await client
      .from("materis_quizzes")
      .select("id, title, passing_score, time_limit_seconds")
      .eq("id", quizId)
      .single();

    const { data: questions, error: questionsError } = await client
      .from("materis_quiz_questions")
      .select("id, correct_answer_index")
      .eq("quiz_id", quizId);

    if (quizError || questionsError || !quiz || !questions) {
      return failure(res, "QUIZ_FETCH_ERROR", "Gagal mengambil data quiz", 500);
    }

    // Calculate score
    let correctAnswers = 0;
    const answerDetails = [];

    for (const answer of value.answers) {
      const question = questions.find((q) => q.id === answer.question_id);
      if (question) {
        const isCorrect =
          question.correct_answer_index === answer.selected_option_index;
        if (isCorrect) correctAnswers++;

        answerDetails.push({
          attempt_id: attempt.id,
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

    // Save answers
    const { error: answersError } = await client
      .from("user_quiz_answers")
      .upsert(answerDetails, {
        onConflict: "attempt_id,question_id",
        ignoreDuplicates: false,
      });

    if (answersError) {
      console.error("Save answers error:", answersError);
      return failure(
        res,
        "ANSWERS_SAVE_ERROR",
        "Gagal menyimpan jawaban",
        500,
        {
          details: answersError.message,
        }
      );
    }

    // Update attempt as completed
    const { data: completedAttempt, error: updateError } = await client
      .from("user_quiz_attempts")
      .update({
        completed_at: new Date().toISOString(),
        score: scorePercentage,
        is_passed: isPassed,
      })
      .eq("id", attempt.id)
      .select("id, score, is_passed, completed_at, started_at")
      .single();

    if (updateError) {
      console.error("Update attempt error:", updateError);
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

    return success(res, "QUIZ_SUBMITTED", "Quiz berhasil diselesaikan", {
      attempt: completedAttempt,
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
};

// GET /api/v1/user-quizzes/:quizId/results - Get quiz results
const getQuizResults = async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user.id;
    const client = req.supabase;

    // Get latest completed attempt
    const { data: attempt, error: attemptError } = await client
      .from("user_quiz_attempts")
      .select("id, score, is_passed, completed_at, started_at")
      .eq("user_id", userId)
      .eq("quiz_id", quizId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (attemptError) {
      return failure(res, "ATTEMPT_FETCH_ERROR", "Gagal mengambil hasil", 500, {
        details: attemptError.message,
      });
    }

    if (!attempt) {
      return failure(
        res,
        "NO_RESULTS_FOUND",
        "Belum ada hasil quiz untuk ditampilkan",
        404
      );
    }

    // Get quiz details
    const { data: quiz } = await client
      .from("materis_quizzes")
      .select("id, title, passing_score")
      .eq("id", quizId)
      .single();

    // Get detailed answers if requested
    const { includeAnswers } = req.query;
    let answerDetails = null;

    if (includeAnswers === "true") {
      const { data: answers } = await client
        .from("user_quiz_answers")
        .select(
          `
          question_id, selected_option_index, is_correct,
          materis_quiz_questions!inner(
            question_text, options, correct_answer_index, explanation
          )
        `
        )
        .eq("attempt_id", attempt.id)
        .order("materis_quiz_questions.order_index");

      answerDetails = answers || [];
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
          id: attempt.id,
          score: attempt.score,
          is_passed: attempt.is_passed,
          started_at: attempt.started_at,
          completed_at: attempt.completed_at,
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
};

// GET /api/v1/user-quizzes/my-attempts - Get all user's quiz attempts
const getMyQuizAttempts = async (req, res) => {
  try {
    const userId = req.user.id;
    const client = req.supabase;
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    let query = client
      .from("user_quiz_attempts")
      .select(
        `
        id, score, is_passed, started_at, completed_at,
        materis_quizzes!inner(
          id, title, passing_score,
          sub_materis!inner(id, title, module_id)
        )
      `
      )
      .eq("user_id", userId);

    // Filter by status
    if (status === "completed") {
      query = query.not("completed_at", "is", null);
    } else if (status === "ongoing") {
      query = query.is("completed_at", null);
    }

    // Get total count
    const { count } = await client
      .from("user_quiz_attempts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    // Get paginated results
    const { data: attempts, error } = await query
      .order("started_at", { ascending: false })
      .range(offset, offset + limit - 1);

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
};

// Route definitions
router.post("/:quizId/start", startQuizAttempt);
router.get("/:quizId/questions", getQuizQuestions);
router.post("/:quizId/submit", submitQuizAnswers);
router.get("/:quizId/results", getQuizResults);
router.get("/my-attempts", getMyQuizAttempts);

module.exports = router;
