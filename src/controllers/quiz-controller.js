const { supabase } = require("../lib/SupabaseClient");
const Joi = require("joi");

// Validation schemas
const quizSchema = Joi.object({
  title: Joi.string().trim().min(3).max(200).required(),
  description: Joi.string().trim().max(1000).optional(),
  material_id: Joi.string().uuid().optional(),
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

// GET /api/pengguna/quizzes - Get all quizzes
const getAllQuizzes = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("quizzes")
      .select(
        `
        id,
        title,
        description,
        created_at,
        materials (
          id,
          title
        ),
        profiles:created_by (
          full_name
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Get quizzes error:", error);
      return res.status(500).json({
        error: {
          message: "Failed to fetch quizzes",
          code: "FETCH_ERROR",
        },
      });
    }

    res.status(200).json({
      message: "Quizzes retrieved successfully",
      data,
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

// GET /api/pengguna/quizzes/:id - Get quiz with questions and choices
const getQuizById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .select(
        `
        id,
        title,
        description,
        created_at,
        materials (
          id,
          title
        ),
        profiles:created_by (
          full_name
        )
      `
      )
      .eq("id", id)
      .single();

    if (quizError || !quiz) {
      return res.status(404).json({
        error: {
          message: "Quiz not found",
          code: "NOT_FOUND",
        },
      });
    }

    // Get questions with choices
    const { data: questions, error: questionsError } = await supabase
      .from("quiz_questions")
      .select(
        `
        id,
        question,
        quiz_choices (
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
      return res.status(500).json({
        error: {
          message: "Failed to fetch quiz questions",
          code: "FETCH_ERROR",
        },
      });
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

    res.status(200).json({
      message: "Quiz retrieved successfully",
      data: {
        ...quiz,
        questions,
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

// POST /api/pengguna/quizzes/:quizId/submit - Submit quiz answers
const submitQuizAnswers = async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user.id;

    const { error, value } = submitAnswerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          message: error.details[0].message,
          code: "VALIDATION_ERROR",
        },
      });
    }

    const { answers } = value;

    // Check if quiz exists
    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .select("id, title")
      .eq("id", quizId)
      .single();

    if (quizError || !quiz) {
      return res.status(404).json({
        error: {
          message: "Quiz not found",
          code: "NOT_FOUND",
        },
      });
    }

    // Get all questions for this quiz with correct answers
    const { data: questions, error: questionsError } = await supabase
      .from("quiz_questions")
      .select(
        `
        id,
        quiz_choices (
          id,
          is_correct
        )
      `
      )
      .eq("quiz_id", quizId);

    if (questionsError) {
      console.error("Get questions error:", questionsError);
      return res.status(500).json({
        error: {
          message: "Failed to fetch quiz questions",
          code: "FETCH_ERROR",
        },
      });
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
    const { data: result, error: resultError } = await supabase
      .from("quiz_results")
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
      return res.status(500).json({
        error: {
          message: "Failed to save quiz result",
          code: "SAVE_ERROR",
        },
      });
    }

    res.status(200).json({
      message: "Quiz submitted successfully",
      data: {
        ...result,
        total_questions: totalQuestions,
        correct_answers: correctAnswers,
        percentage: Math.round(score),
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

    const { title, description, material_id, questions } = value;
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
    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .insert({
        title,
        description,
        material_id,
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
      const { data: question, error: questionError } = await supabase
        .from("quiz_questions")
        .insert({
          quiz_id: quiz.id,
          question: questionData.question,
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

      const { data: choices, error: choicesError } = await supabase
        .from("quiz_choices")
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
    const { data: existingQuiz, error: fetchError } = await supabase
      .from("quizzes")
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

    const { error: deleteError } = await supabase
      .from("quizzes")
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
};
