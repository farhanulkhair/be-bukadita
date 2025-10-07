// Supabase clients are provided via middleware on req (req.supabase, req.supabaseAdmin)
const Joi = require("joi");
const { success, failure } = require("../utils/respond");

// Validation schemas
const quizSchema = Joi.object({
  title: Joi.string().trim().min(3).max(200).required(),
  description: Joi.string().trim().max(1000).optional(),
  material_id: Joi.string().uuid().optional(),
  module_id: Joi.string().uuid().optional(),
});

const questionSchema = Joi.object({
  question: Joi.string().trim().min(5).required(),
  choices: Joi.array()
    .items(
      Joi.object({
        choice_text: Joi.string().trim().min(1).required(),
        is_correct: Joi.boolean().required(),
      })
    )
    .min(2)
    .required(),
});

const quizWithQuestionsSchema = Joi.object({
  title: Joi.string().trim().min(3).max(200).required(),
  description: Joi.string().trim().max(1000).optional(),
  material_id: Joi.string().uuid().optional(),
  module_id: Joi.string().uuid().optional(),
  questions: Joi.array().items(questionSchema).min(1).required(),
});

const submitAnswerSchema = Joi.object({
  answers: Joi.array()
    .items(
      Joi.object({
        question_id: Joi.string().uuid().required(),
        choice_id: Joi.string().uuid().required(),
      })
    )
    .min(1)
    .required(),
});

// New schema for quiz attempts (supports choice or text answer)
const attemptAnswersSchema = Joi.object({
  answers: Joi.array()
    .items(
      Joi.object({
        question_id: Joi.string().uuid().required(),
        choice_id: Joi.string().uuid().optional(),
        text_answer: Joi.string().trim().max(2000).optional(),
      })
        .or("choice_id", "text_answer")
        .messages({
          "object.missing":
            "Each answer must include either choice_id or text_answer",
        })
    )
    .min(1)
    .required(),
});

// GET /api/pengguna/quizzes - Get all quizzes
const getAllQuizzes = async (req, res) => {
  try {
    const sb = req.supabase;
    const moduleFilter = (req.query.module_id || "").trim();
    const { data, error } = await sb
      .from("materis_quizzes")
      .select(
        `
        id,
        title,
        description,
        time_limit_seconds,
        passing_score,
        created_at,
        module_id,
        sub_materis (
          id,
          title
        )
      `
      )
      .order("created_at", { ascending: false });
    let finalData = data;
    let finalError = error;
    if (!finalError && moduleFilter) {
      // refetch with filter (cannot combine dynamically above due to builder ergonomics)
      const filtered = await sb
        .from("materis_quizzes")
        .select(
          `
          id,
          title,
          description,
          time_limit_seconds,
          passing_score,
          created_at,
          module_id,
          sub_materis (
            id,
            title
          )
        `
        )
        .eq("module_id", moduleFilter)
        .order("created_at", { ascending: false });
      finalData = filtered.data;
      finalError = filtered.error;
    }

    if (finalError) {
      console.error("Get quizzes error:", error);
      return failure(res, "QUIZ_FETCH_ERROR", "Failed to fetch quizzes", 500);
    }
    return success(
      res,
      "QUIZ_FETCH_SUCCESS",
      "Quizzes retrieved successfully",
      { items: finalData }
    );
  } catch (error) {
    console.error("Quiz controller error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500);
  }
};

// GET /api/v1/modules/:module_id/quizzes - list quizzes under a module (public)
async function getQuizzesByModule(req, res) {
  try {
    const moduleId = req.params.module_id || req.params.id;
    const sb = req.supabase;
    const { data, error } = await sb
      .from("materis_quizzes")
      .select(
        `
        id,
        title,
        description,
        time_limit_seconds,
        passing_score,
        created_at,
        module_id,
        sub_materis (
          id,
          title
        )
      `
      )
      .eq("module_id", moduleId)
      .order("created_at", { ascending: false });
    if (error) {
      return failure(res, "QUIZ_FETCH_ERROR", "Failed to fetch quizzes", 500, {
        details: error.message,
      });
    }
    return success(
      res,
      "QUIZ_FETCH_SUCCESS",
      "Quizzes retrieved successfully",
      { items: data }
    );
  } catch (e) {
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: e.message,
    });
  }
}

// GET /api/pengguna/quizzes/:id - Get quiz with questions and choices
const getQuizById = async (req, res) => {
  try {
    const { id } = req.params;

    const sb = req.supabase;
    const { data: quiz, error: quizError } = await sb
      .from("materis_quizzes")
      .select(
        `
        id,
        title,
        description,
        time_limit_seconds,
        passing_score,
        created_at,
        module_id,
        sub_materis (
          id,
          title
        )
      `
      )
      .eq("id", id)
      .single();

    if (quizError || !quiz) {
      return failure(res, "QUIZ_NOT_FOUND", "Quiz not found", 404);
    }

    // Get questions with choices
    const { data: questions, error: questionsError } = await sb
      .from("materis_quiz_questions")
      .select(
        `
        id,
        question_text,
        options,
        correct_answer_index,
        materis_quiz_choices (
          id,
          choice_text,
          is_correct
        )
      `
      )
      .eq("quiz_id", id)
      .order("created_at");

    if (questionsError) {
      console.error("Get questions error:", questionsError);
      return failure(
        res,
        "QUIZ_QUESTION_FETCH_ERROR",
        "Failed to fetch quiz questions",
        500
      );
    }

    // Don't expose correct answers to non-admin users
    const isAdmin = req.profile && req.profile.role === "admin";
    if (!isAdmin) {
      questions.forEach((question) => {
        question.quiz_choices.forEach((choice) => {
          delete choice.is_correct;
        });
      });
    }

    return success(res, "QUIZ_DETAIL_SUCCESS", "Quiz retrieved successfully", {
      ...quiz,
      questions,
    });
  } catch (error) {
    console.error("Quiz controller error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500);
  }
};

// POST /api/pengguna/quizzes/:quizId/submit - Submit quiz answers
const submitQuizAnswers = async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user.id;

    const { error, value } = submitAnswerSchema.validate(req.body);
    if (error) {
      return failure(
        res,
        "QUIZ_SUBMIT_VALIDATION_ERROR",
        error.details[0].message,
        400
      );
    }

    const { answers } = value;

    // Check if quiz exists
    const sb = req.supabase;
    const { data: quiz, error: quizError } = await sb
      .from("materis_quizzes")
      .select("id, title")
      .eq("id", quizId)
      .single();

    if (quizError || !quiz) {
      return failure(res, "QUIZ_NOT_FOUND", "Quiz not found", 404);
    }

    // Get all questions for this quiz with correct answers
    const { data: questions, error: questionsError } = await sb
      .from("materis_quiz_questions")
      .select(
        `
        id,
        question_text,
        options,
        correct_answer_index,
        materis_quiz_choices (
          id,
          is_correct
        )
      `
      )
      .eq("quiz_id", quizId);

    if (questionsError) {
      console.error("Get questions error:", questionsError);
      return failure(
        res,
        "QUIZ_QUESTION_FETCH_ERROR",
        "Failed to fetch quiz questions",
        500
      );
    }

    // Calculate score
    let correctAnswers = 0;
    const totalQuestions = questions.length;

    answers.forEach((answer) => {
      const question = questions.find((q) => q.id === answer.question_id);
      if (question) {
        const choice = question.quiz_choices.find(
          (c) => c.id === answer.choice_id
        );
        if (choice && choice.is_correct) {
          correctAnswers++;
        }
      }
    });

    const score =
      totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

    // Save result
    const { data: result, error: resultError } = await sb
      .from("user_quiz_attempts")
      .insert({
        quiz_id: quizId,
        user_id: userId,
        score: score,
      })
      .select(
        `
        id,
        score,
        taken_at,
        quizzes (
          title
        )
      `
      )
      .single();

    if (resultError) {
      console.error("Save result error:", resultError);
      return failure(
        res,
        "QUIZ_RESULT_SAVE_ERROR",
        "Failed to save quiz result",
        500
      );
    }
    return success(res, "QUIZ_SUBMIT_SUCCESS", "Quiz submitted successfully", {
      ...result,
      total_questions: totalQuestions,
      correct_answers: correctAnswers,
      percentage: Math.round(score),
    });
  } catch (error) {
    console.error("Quiz controller error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500);
  }
};

// POST /api/admin/quizzes - Create quiz with questions (admin only)
const createQuizWithQuestions = async (req, res) => {
  try {
    const { error, value } = quizWithQuestionsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          message: error.details[0].message,
          code: "VALIDATION_ERROR",
        },
      });
    }

    const { title, description, material_id, module_id, questions } = value;
    const createdBy = req.user.id;

    // Validate that at least one choice is correct for each question
    for (const question of questions) {
      const hasCorrectAnswer = question.choices.some(
        (choice) => choice.is_correct
      );
      if (!hasCorrectAnswer) {
        return res.status(400).json({
          error: {
            message: "Each question must have at least one correct answer",
            code: "VALIDATION_ERROR",
          },
        });
      }
    }

    // Create quiz
    const sb = req.supabase;
    const { data: quiz, error: quizError } = await sb
      .from("materis_quizzes")
      .insert({
        title,
        description,
        time_limit_seconds: null,
        passing_score: 70,
        material_id,
        module_id,
        created_by: createdBy,
      })
      .select()
      .single();

    if (quizError) {
      console.error("Create quiz error:", quizError);
      return res.status(500).json({
        error: {
          message: "Failed to create quiz",
          code: "CREATION_ERROR",
        },
      });
    }

    // Create questions and choices
    const createdQuestions = [];

    for (const questionData of questions) {
      // Create question
      const { data: question, error: questionError } = await sb
        .from("materis_quiz_questions")
        .insert({
          quiz_id: quiz.id,
          question_text: questionData.question,
          opotions: questionData.choices.map((c) => c.choice_text),
          correct_answer_index: questionData.choices.findIndex((c) => c.is_correct),
        })
        .select()
        .single();

      if (questionError) {
        console.error("Create question error:", questionError);
        continue;
      }

      // Create choices
      const choicesData = questionData.choices.map((choice) => ({
        question_id: question.id,
        choice_text: choice.choice_text,
        is_correct: choice.is_correct,
      }));

      const { data: choices, error: choicesError } = await sb
        .from("materis_quiz_choices")
        .insert(choicesData)
        .select();

      if (choicesError) {
        console.error("Create choices error:", choicesError);
        continue;
      }

      createdQuestions.push({
        ...question,
        choices,
      });
    }

    res.status(201).json({
      message: "Quiz created successfully",
      data: {
        ...quiz,
        questions: createdQuestions,
      },
    });
  } catch (error) {
    console.error("Quiz controller error:", error);
    res.status(500).json({
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
    });
  }
};

// DELETE /api/admin/quizzes/:id - Delete quiz (admin only)
const deleteQuiz = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if quiz exists
    const sb = req.supabase;
    const { data: existingQuiz, error: fetchError } = await sb
      .from("materis_quizzes")
      .select("id")
      .eq("id", id)
      .single();

    if (fetchError || !existingQuiz) {
      return res.status(404).json({
        error: {
          message: "Quiz not found",
          code: "NOT_FOUND",
        },
      });
    }

    const { error: deleteError } = await sb
      .from("materis_quizzes")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete quiz error:", deleteError);
      return res.status(500).json({
        error: {
          message: "Failed to delete quiz",
          code: "DELETE_ERROR",
        },
      });
    }

    res.status(200).json({
      message: "Quiz deleted successfully",
    });
  } catch (error) {
    console.error("Quiz controller error:", error);
    res.status(500).json({
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
    });
  }
};

module.exports = {
  getAllQuizzes,
  getQuizById,
  submitQuizAnswers,
  createQuizWithQuestions,
  deleteQuiz,
  createQuizAttempt, // new export
  updateQuiz,
  getQuizzesByModule,
};

/**
 * POST /api/v1/quizzes/:quizId/attempts
 * Creates a quiz attempt with provided answers, computes score, persists attempt & answers.
 * Flow:
 * 1. Auth required (user id from req.user.id)
 * 2. Validate body: answers array [{question_id, choice_id? | text_answer?}]
 * 3. Fetch questions & correct choices server-side (service role preferred)
 * 4. Compute score = correct_count / total_questions * 100 (rounded)
 * 5. Insert quiz_attempts then quiz_answers (best-effort rollback if answers insert fails)
 * 6. Return { attempt_id, score, passed, total_questions, correct_answers }
 * 7. Never return is_correct flags to caller
 */
async function createQuizAttempt(req, res) {
  try {
    const quizId = req.params.quizId || req.params.id; // support both param names
    const userId = req.user?.id;
    if (!userId) {
      return failure(res, "UNAUTHORIZED", "Authentication required", 401);
    }

    const { error: valErr, value } = attemptAnswersSchema.validate(req.body);
    if (valErr) {
      return failure(
        res,
        "QUIZ_ATTEMPT_VALIDATION_ERROR",
        valErr.details[0].message,
        400
      );
    }

    const answersInput = value.answers;
    // Use admin client to access correctness flags (RLS hides is_correct for normal users)
    const adminClient = req.supabaseAdmin || req.supabase; // service role (req.supabaseAdmin) or user/anon

    // Fetch quiz including passing_score
    const { data: quiz, error: quizErr } = await adminClient
      .from("materis_quizzes")
      .select("id, passing_score")
      .eq("id", quizId)
      .single();
    if (quizErr || !quiz) {
      return failure(res, "QUIZ_NOT_FOUND", "Quiz not found", 404);
    }

    // Fetch questions (ids only) for denominator
    const { data: questions, error: qErr } = await adminClient
      .from("materis_quiz_questions")
      .select("id")
      .eq("quiz_id", quizId);
    if (qErr) {
      return failure(
        res,
        "QUIZ_QUESTION_FETCH_ERROR",
        "Failed to fetch questions",
        500
      );
    }
    const totalQuestions = questions.length;
    if (totalQuestions === 0) {
      return failure(res, "QUIZ_NO_QUESTIONS", "Quiz has no questions", 400);
    }

    const questionIdSet = new Set(questions.map((q) => q.id));

    // Validate all provided answers belong to quiz
    for (const ans of answersInput) {
      if (!questionIdSet.has(ans.question_id)) {
        return failure(
          res,
          "QUIZ_INVALID_QUESTION",
          `Question ${ans.question_id} does not belong to this quiz`,
          400
        );
      }
    }

    // Fetch correct choices (only those marked is_correct) for scoring
    let correctChoiceMap = new Map(); // question_id -> Set(correct choice ids)
    if (req.supabaseAdmin) {
      const { data: correctChoices, error: ccErr } = await adminClient
        .from("materis_quiz_choices")
        .select("id, question_id, is_correct")
        .in("question_id", [...questionIdSet]);
      if (ccErr) {
        return failure(
          res,
          "QUIZ_CHOICE_FETCH_ERROR",
          "Failed to fetch choices for scoring",
          500
        );
      }
      correctChoices.forEach((c) => {
        if (c.is_correct) {
          if (!correctChoiceMap.has(c.question_id)) {
            correctChoiceMap.set(c.question_id, new Set());
          }
          correctChoiceMap.get(c.question_id).add(c.id);
        }
      });
    }

    // Deduplicate answers by question (first answer wins)
    const uniqueAnswers = [];
    const seen = new Set();
    for (const ans of answersInput) {
      if (!seen.has(ans.question_id)) {
        uniqueAnswers.push(ans);
        seen.add(ans.question_id);
      }
    }

    // Compute correctness
    let correctCount = 0;
    const preparedAnswers = uniqueAnswers.map((ans) => {
      let isCorrect = null;
      if (ans.choice_id && correctChoiceMap.size > 0) {
        const set = correctChoiceMap.get(ans.question_id);
        if (set && set.has(ans.choice_id)) {
          isCorrect = true;
          correctCount++;
        } else if (set) {
          isCorrect = false;
        }
      }
      return {
        question_id: ans.question_id,
        choice_id: ans.choice_id || null,
        text_answer: ans.text_answer || null,
        is_correct: isCorrect,
      };
    });

    const rawScore = (correctCount / totalQuestions) * 100;
    const score = Math.round(rawScore);
    const passing =
      typeof quiz.passing_score === "number" ? quiz.passing_score : 0;
    const passed = score >= passing;

    // Insert attempt
    const { data: attempt, error: attemptErr } = await req.supabase
      .from("user_quiz_attempts")
      .insert({
        quiz_id: quizId,
        user_id: userId,
        score,
        status: "completed",
        finished_at: new Date().toISOString(),
      })
      .select("id, score")
      .single();
    if (attemptErr) {
      return failure(
        res,
        "QUIZ_ATTEMPT_CREATE_ERROR",
        "Failed to create attempt",
        500
      );
    }

    // Insert answers referencing attempt
    const answersPayload = preparedAnswers.map((a) => ({
      attempt_id: attempt.id,
      question_id: a.question_id,
      choice_id: a.choice_id,
      text_answer: a.text_answer,
      is_correct: a.is_correct,
    }));

    if (answersPayload.length > 0) {
      const { error: ansErr } = await req.supabase
        .from("quiz_answers")
        .insert(answersPayload);
      if (ansErr) {
        // best-effort rollback: delete attempt
        await req.supabase.from("user_quiz_attempts").delete().eq("id", attempt.id);
        return failure(
          res,
          "QUIZ_ANSWERS_INSERT_ERROR",
          "Failed to record answers",
          500
        );
      }
    }

    return success(
      res,
      "QUIZ_ATTEMPT_SUCCESS",
      "Quiz attempt recorded",
      {
        attempt_id: attempt.id,
        score,
        passed,
        passing_score: passing,
        total_questions: totalQuestions,
        correct_answers: correctCount,
        answers_count: answersPayload.length,
      },
      201
    );
  } catch (error) {
    console.error("createQuizAttempt error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500);
  }
}

// PUT /api/v1/quizzes/:id - Update quiz metadata (admin only)
async function updateQuiz(req, res) {
  try {
    const { id } = req.params;
    const { error: valErr, value } = quizSchema
      .fork(["title"], (s) => s.optional())
      .validate(req.body || {});
    if (valErr) {
      return failure(
        res,
        "QUIZ_UPDATE_VALIDATION_ERROR",
        valErr.details[0].message,
        400
      );
    }
    const sb = req.supabase;
    const { data: existing, error: fetchErr } = await sb
      .from("materis_quizzes")
      .select("id")
      .eq("id", id)
      .single();
    if (fetchErr || !existing) {
      return failure(res, "QUIZ_NOT_FOUND", "Quiz not found", 404);
    }
    const updatePayload = { ...value, updated_at: new Date().toISOString() };
    const { data: updated, error: updErr } = await sb
      .from("materis_quizzes")
      .update(updatePayload)
      .eq("id", id)
      .select("id, title, description, material_id, created_at, updated_at")
      .single();
    if (updErr) {
      return failure(res, "QUIZ_UPDATE_ERROR", "Failed to update quiz", 500);
    }
    return success(res, "QUIZ_UPDATE_SUCCESS", "Quiz updated", updated);
  } catch (e) {
    console.error("Update quiz error:", e);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500);
  }
}
