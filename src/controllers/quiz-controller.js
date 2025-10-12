const { success, failure } = require("../utils/respond");
const {
  createQuizSchema,
  updateQuizSchema,
  createQuestionSchema,
  updateQuestionSchema,
  submitQuizAnswersSchema,
} = require("../validators/quiz-validator");

// Helper function to format quiz response
const formatQuizResponse = (quiz, includeQuestions = false) => {
  const formattedQuiz = {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    time_limit_seconds: quiz.time_limit_seconds,
    passing_score: quiz.passing_score,
    published: quiz.published,
    quiz_type: quiz.quiz_type,
    sub_materi_id: quiz.sub_materi_id,
    module_id: quiz.module_id,
    created_at: quiz.created_at,
    updated_at: quiz.updated_at,
    created_by: quiz.created_by,
    updated_by: quiz.updated_by,
  };

  // Add sub_materi info if available
  if (quiz.sub_materis) {
    formattedQuiz.sub_materi = {
      id: quiz.sub_materis.id,
      title: quiz.sub_materis.title,
      published: quiz.sub_materis.published,
    };
  }

  // Add module info if available
  if (quiz.modules) {
    formattedQuiz.module = {
      id: quiz.modules.id,
      title: quiz.modules.title,
    };
  }

  // Add questions if requested and available
  if (includeQuestions && quiz.questions) {
    formattedQuiz.questions = quiz.questions.map((q) => ({
      id: q.id,
      question_text: q.question_text,
      options: q.options,
      correct_answer_index: q.correct_answer_index,
      explanation: q.explanation,
      order_index: q.order_index,
      created_at: q.created_at,
    }));
    formattedQuiz.total_questions = quiz.questions.length;
  }

  return formattedQuiz;
};

// Helper function to format question response (hide correct answer for users)
const formatQuestionResponse = (question, hideAnswer = false) => {
  const formattedQuestion = {
    id: question.id,
    question_text: question.question_text,
    options: question.options,
    explanation: question.explanation,
    order_index: question.order_index,
    created_at: question.created_at,
    quiz_id: question.quiz_id,
  };

  // Only include correct answer for admin users
  if (!hideAnswer) {
    formattedQuestion.correct_answer_index = question.correct_answer_index;
  }

  return formattedQuestion;
};

// GET /api/v1/admin/quizzes - Get all quizzes (admin only)
const getAllQuizzes = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      published,
      sub_materi_id,
    } = req.query;
    const offset = (page - 1) * limit;

    const sb = req.supabaseAdmin || req.supabase;

    // Build query
    let query = sb
      .from("materis_quizzes")
      .select(
        `
        id, title, description, time_limit_seconds, passing_score, published, 
        quiz_type, sub_materi_id, module_id, created_at, updated_at,
        sub_materis!inner(id, title, published),
        modules!inner(id, title)
      `
      )
      .order("created_at", { ascending: false });

    // Apply filters
    if (search) {
      query = query.ilike("title", `%${search}%`);
    }

    if (published !== undefined) {
      query = query.eq("published", published === "true");
    }

    if (sub_materi_id) {
      query = query.eq("sub_materi_id", sub_materi_id);
    }

    // Get total count for pagination
    const { count } = await sb
      .from("materis_quizzes")
      .select("*", { count: "exact", head: true });

    // Get paginated results
    const { data: quizzes, error } = await query.range(
      offset,
      offset + limit - 1
    );

    if (error) {
      console.error("Get quizzes error:", error);
      return failure(
        res,
        "QUIZ_FETCH_ERROR",
        "Gagal mengambil data quiz",
        500,
        {
          details: error.message,
        }
      );
    }

    const formattedQuizzes = quizzes.map((quiz) => formatQuizResponse(quiz));

    return success(res, "QUIZ_FETCH_SUCCESS", "Data quiz berhasil diambil", {
      quizzes: formattedQuizzes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Quiz controller error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// GET /api/v1/admin/quizzes/:id - Get quiz detail with questions (admin only)
const getQuizById = async (req, res) => {
  try {
    const { id } = req.params;
    const sb = req.supabaseAdmin || req.supabase;

    // Get quiz with sub_materi and module info
    const { data: quiz, error: quizError } = await sb
      .from("materis_quizzes")
      .select(
        `
        id, title, description, time_limit_seconds, passing_score, published,
        quiz_type, sub_materi_id, module_id, created_at, updated_at,
        created_by, updated_by,
        sub_materis!inner(id, title, published),
        modules!inner(id, title)
      `
      )
      .eq("id", id)
      .single();

    if (quizError || !quiz) {
      return failure(res, "QUIZ_NOT_FOUND", "Quiz tidak ditemukan", 404);
    }

    // Get questions for this quiz
    const { data: questions, error: questionsError } = await sb
      .from("materis_quiz_questions")
      .select(
        "id, question_text, options, correct_answer_index, explanation, order_index, created_at, quiz_id"
      )
      .eq("quiz_id", id)
      .order("order_index", { ascending: true });

    if (questionsError) {
      console.error("Get questions error:", questionsError);
    }

    const quizWithQuestions = {
      ...quiz,
      questions: questions || [],
    };

    return success(
      res,
      "QUIZ_FETCH_SUCCESS",
      "Quiz berhasil diambil",
      formatQuizResponse(quizWithQuestions, true)
    );
  } catch (error) {
    console.error("Quiz controller error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// POST /api/v1/admin/quizzes - Create new quiz (admin only)
const createQuiz = async (req, res) => {
  try {
    // Validate input
    const { error, value } = createQuizSchema.validate(req.body);
    if (error) {
      return failure(
        res,
        "QUIZ_VALIDATION_ERROR",
        error.details[0].message,
        422
      );
    }

    const sb = req.supabaseAdmin || req.supabase;
    const userId = req.user?.id;

    // Verify sub_materi exists and get module_id
    const { data: subMateri, error: subMateriError } = await sb
      .from("sub_materis")
      .select("id, title, module_id, published")
      .eq("id", value.sub_materi_id)
      .single();

    if (subMateriError || !subMateri) {
      return failure(
        res,
        "SUB_MATERI_NOT_FOUND",
        "Sub materi tidak ditemukan",
        404
      );
    }

    // Prepare quiz data
    const quizData = {
      title: value.title,
      description: value.description || null,
      sub_materi_id: value.sub_materi_id,
      module_id: subMateri.module_id,
      time_limit_seconds: value.time_limit_seconds,
      passing_score: value.passing_score,
      published: value.published,
      quiz_type: value.quiz_type,
      created_by: userId,
      updated_by: userId,
    };

    // Insert quiz
    const { data: newQuiz, error: insertError } = await sb
      .from("materis_quizzes")
      .insert([quizData])
      .select(
        `
        id, title, description, time_limit_seconds, passing_score, published,
        quiz_type, sub_materi_id, module_id, created_at, updated_at,
        created_by, updated_by
      `
      )
      .single();

    if (insertError) {
      console.error("Create quiz error:", insertError);
      return failure(res, "QUIZ_CREATE_ERROR", "Gagal membuat quiz", 500, {
        details: insertError.message,
      });
    }

    return success(
      res,
      "QUIZ_CREATE_SUCCESS",
      "Quiz berhasil dibuat",
      formatQuizResponse(newQuiz),
      201
    );
  } catch (error) {
    console.error("Quiz controller error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// PUT /api/v1/admin/quizzes/:id - Update quiz (admin only)
const updateQuiz = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate input
    const { error, value } = updateQuizSchema.validate(req.body);
    if (error) {
      return failure(
        res,
        "QUIZ_VALIDATION_ERROR",
        error.details[0].message,
        422
      );
    }

    const sb = req.supabaseAdmin || req.supabase;
    const userId = req.user?.id;

    // Check if quiz exists
    const { data: existingQuiz, error: fetchError } = await sb
      .from("materis_quizzes")
      .select("id, sub_materi_id, module_id")
      .eq("id", id)
      .single();

    if (fetchError || !existingQuiz) {
      return failure(res, "QUIZ_NOT_FOUND", "Quiz tidak ditemukan", 404);
    }

    // If sub_materi_id is being updated, verify it exists and get new module_id
    let updateData = { ...value, updated_by: userId };

    if (
      value.sub_materi_id &&
      value.sub_materi_id !== existingQuiz.sub_materi_id
    ) {
      const { data: subMateri, error: subMateriError } = await sb
        .from("sub_materis")
        .select("id, module_id")
        .eq("id", value.sub_materi_id)
        .single();

      if (subMateriError || !subMateri) {
        return failure(
          res,
          "SUB_MATERI_NOT_FOUND",
          "Sub materi tidak ditemukan",
          404
        );
      }

      updateData.module_id = subMateri.module_id;
    }

    // Update quiz
    const { data: updatedQuiz, error: updateError } = await sb
      .from("materis_quizzes")
      .update(updateData)
      .eq("id", id)
      .select(
        `
        id, title, description, time_limit_seconds, passing_score, published,
        quiz_type, sub_materi_id, module_id, created_at, updated_at,
        created_by, updated_by
      `
      )
      .single();

    if (updateError) {
      console.error("Update quiz error:", updateError);
      return failure(res, "QUIZ_UPDATE_ERROR", "Gagal memperbarui quiz", 500, {
        details: updateError.message,
      });
    }

    return success(
      res,
      "QUIZ_UPDATE_SUCCESS",
      "Quiz berhasil diperbarui",
      formatQuizResponse(updatedQuiz)
    );
  } catch (error) {
    console.error("Quiz controller error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// DELETE /api/v1/admin/quizzes/:id - Hard delete quiz (admin only)
const deleteQuiz = async (req, res) => {
  try {
    const { id } = req.params;
    const sb = req.supabaseAdmin || req.supabase;

    // Check if quiz exists
    const { data: existingQuiz, error: fetchError } = await sb
      .from("materis_quizzes")
      .select("id, title")
      .eq("id", id)
      .single();

    if (fetchError || !existingQuiz) {
      return failure(res, "QUIZ_NOT_FOUND", "Quiz tidak ditemukan", 404);
    }

    // Check if quiz has user attempts
    const { data: attempts } = await sb
      .from("user_quiz_attempts")
      .select("id")
      .eq("quiz_id", id)
      .limit(1);

    if (attempts && attempts.length > 0) {
      return failure(
        res,
        "QUIZ_HAS_ATTEMPTS",
        "Tidak dapat menghapus quiz yang sudah dikerjakan oleh user",
        409
      );
    }

    // Hard delete quiz (CASCADE will delete questions automatically)
    const { error: deleteError } = await sb
      .from("materis_quizzes")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete quiz error:", deleteError);
      return failure(res, "QUIZ_DELETE_ERROR", "Gagal menghapus quiz", 500, {
        details: deleteError.message,
      });
    }

    return success(res, "QUIZ_DELETE_SUCCESS", "Quiz berhasil dihapus", {
      deletedId: id,
      title: existingQuiz.title,
    });
  } catch (error) {
    console.error("Quiz controller error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// POST /api/v1/admin/quizzes/:quizId/questions - Add question to quiz (admin only)
const addQuestionToQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;

    // Validate input
    const { error, value } = createQuestionSchema.validate(req.body);
    if (error) {
      return failure(
        res,
        "QUESTION_VALIDATION_ERROR",
        error.details[0].message,
        422
      );
    }

    const sb = req.supabaseAdmin || req.supabase;

    // Verify quiz exists
    const { data: quiz, error: quizError } = await sb
      .from("materis_quizzes")
      .select("id, title")
      .eq("id", quizId)
      .single();

    if (quizError || !quiz) {
      return failure(res, "QUIZ_NOT_FOUND", "Quiz tidak ditemukan", 404);
    }

    // Auto-set order_index if not provided
    if (value.order_index === undefined || value.order_index === 0) {
      const { data: lastQuestion } = await sb
        .from("materis_quiz_questions")
        .select("order_index")
        .eq("quiz_id", quizId)
        .order("order_index", { ascending: false })
        .limit(1)
        .maybeSingle();

      value.order_index = (lastQuestion?.order_index || 0) + 1;
    }

    // Prepare question data
    const questionData = {
      quiz_id: quizId,
      question_text: value.question_text,
      options: value.options,
      correct_answer_index: value.correct_answer_index,
      explanation: value.explanation || null,
      order_index: value.order_index,
    };

    // Insert question
    const { data: newQuestion, error: insertError } = await sb
      .from("materis_quiz_questions")
      .insert([questionData])
      .select(
        "id, question_text, options, correct_answer_index, explanation, order_index, created_at, quiz_id"
      )
      .single();

    if (insertError) {
      console.error("Create question error:", insertError);
      return failure(
        res,
        "QUESTION_CREATE_ERROR",
        "Gagal membuat pertanyaan",
        500,
        {
          details: insertError.message,
        }
      );
    }

    return success(
      res,
      "QUESTION_CREATE_SUCCESS",
      "Pertanyaan berhasil ditambahkan",
      formatQuestionResponse(newQuestion),
      201
    );
  } catch (error) {
    console.error("Quiz controller error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// PUT /api/v1/admin/questions/:id - Update question (admin only)
const updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate input
    const { error, value } = updateQuestionSchema.validate(req.body);
    if (error) {
      return failure(
        res,
        "QUESTION_VALIDATION_ERROR",
        error.details[0].message,
        422
      );
    }

    const sb = req.supabaseAdmin || req.supabase;

    // Check if question exists
    const { data: existingQuestion, error: fetchError } = await sb
      .from("materis_quiz_questions")
      .select("id, quiz_id")
      .eq("id", id)
      .single();

    if (fetchError || !existingQuestion) {
      return failure(
        res,
        "QUESTION_NOT_FOUND",
        "Pertanyaan tidak ditemukan",
        404
      );
    }

    // Update question
    const { data: updatedQuestion, error: updateError } = await sb
      .from("materis_quiz_questions")
      .update(value)
      .eq("id", id)
      .select(
        "id, question_text, options, correct_answer_index, explanation, order_index, created_at, quiz_id"
      )
      .single();

    if (updateError) {
      console.error("Update question error:", updateError);
      return failure(
        res,
        "QUESTION_UPDATE_ERROR",
        "Gagal memperbarui pertanyaan",
        500,
        {
          details: updateError.message,
        }
      );
    }

    return success(
      res,
      "QUESTION_UPDATE_SUCCESS",
      "Pertanyaan berhasil diperbarui",
      formatQuestionResponse(updatedQuestion)
    );
  } catch (error) {
    console.error("Quiz controller error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// DELETE /api/v1/admin/questions/:id - Delete question (admin only)
const deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const sb = req.supabaseAdmin || req.supabase;

    // Check if question exists
    const { data: existingQuestion, error: fetchError } = await sb
      .from("materis_quiz_questions")
      .select("id, quiz_id, question_text")
      .eq("id", id)
      .single();

    if (fetchError || !existingQuestion) {
      return failure(
        res,
        "QUESTION_NOT_FOUND",
        "Pertanyaan tidak ditemukan",
        404
      );
    }

    // Delete question
    const { error: deleteError } = await sb
      .from("materis_quiz_questions")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete question error:", deleteError);
      return failure(
        res,
        "QUESTION_DELETE_ERROR",
        "Gagal menghapus pertanyaan",
        500,
        {
          details: deleteError.message,
        }
      );
    }

    return success(
      res,
      "QUESTION_DELETE_SUCCESS",
      "Pertanyaan berhasil dihapus",
      {
        deletedId: id,
        quizId: existingQuestion.quiz_id,
      }
    );
  } catch (error) {
    console.error("Quiz controller error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// GET /api/v1/materials/:subMateriId/quiz - Get quiz for sub_materi (for users)
const getQuizForSubMateri = async (req, res) => {
  try {
    const { subMateriId } = req.params;
    const user = req.user;

    const isAdmin =
      req.profile && ["admin", "superadmin"].includes(req.profile.role);
    const clientToUse = isAdmin
      ? req.supabaseAdmin || req.supabase
      : req.supabase;

    // Get published quiz for this sub_materi
    const { data: quizzes, error: quizError } = await clientToUse
      .from("materis_quizzes")
      .select(
        `
        id, title, description, time_limit_seconds, passing_score,
        sub_materis!inner(id, title, published)
      `
      )
      .eq("sub_materi_id", subMateriId)
      .eq("published", true);

    if (quizError) {
      console.error("Get quiz error:", quizError);
      return failure(res, "QUIZ_FETCH_ERROR", "Gagal mengambil quiz", 500, {
        details: quizError.message,
      });
    }

    if (!quizzes || quizzes.length === 0) {
      return success(
        res,
        "NO_QUIZ_FOUND",
        "Tidak ada quiz untuk sub materi ini",
        {
          quiz: null,
        }
      );
    }

    const quiz = quizzes[0];

    // Check if user has attempted this quiz
    let userAttempt = null;
    if (user && !isAdmin) {
      const { data: attempt } = await clientToUse
        .from("user_quiz_attempts")
        .select("id, score, is_passed, completed_at, started_at")
        .eq("user_id", user.id)
        .eq("quiz_id", quiz.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      userAttempt = attempt;
    }

    return success(res, "QUIZ_FETCH_SUCCESS", "Quiz ditemukan", {
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        time_limit_seconds: quiz.time_limit_seconds,
        passing_score: quiz.passing_score,
        user_attempt: userAttempt,
      },
    });
  } catch (error) {
    console.error("Quiz controller error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// GET /api/v1/admin/sub-materis - Get sub materis for dropdown (admin only)
const getSubMaterisForDropdown = async (req, res) => {
  try {
    const sb = req.supabaseAdmin || req.supabase;

    const { data: subMateris, error } = await sb
      .from("sub_materis")
      .select(
        `
        id, title, published,
        modules!inner(id, title)
      `
      )
      .order("title", { ascending: true });

    if (error) {
      console.error("Get sub materis error:", error);
      return failure(
        res,
        "SUB_MATERI_FETCH_ERROR",
        "Gagal mengambil data sub materi",
        500,
        {
          details: error.message,
        }
      );
    }

    const formattedData = subMateris.map((sm) => ({
      id: sm.id,
      title: sm.title,
      published: sm.published,
      module: {
        id: sm.modules.id,
        title: sm.modules.title,
      },
      display_name: `${sm.modules.title} - ${sm.title}`,
    }));

    return success(
      res,
      "SUB_MATERI_FETCH_SUCCESS",
      "Data sub materi berhasil diambil",
      {
        sub_materis: formattedData,
      }
    );
  } catch (error) {
    console.error("Quiz controller error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

module.exports = {
  getAllQuizzes,
  getQuizById,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  addQuestionToQuiz,
  updateQuestion,
  deleteQuestion,
  getQuizForSubMateri,
  getSubMaterisForDropdown,
};
