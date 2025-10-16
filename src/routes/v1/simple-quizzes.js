const express = require("express");
const authMiddleware = require("../../middlewares/auth-middleware");
const { success, failure } = require("../../utils/respond");

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// ============================================================================
// Helper Function: Recalculate Module Progress
// ============================================================================
async function recalculateModuleProgress(client, userId, moduleId) {
  try {
    console.log("📊 Recalculating module progress:", { userId, moduleId });

    // Get all sub-materi progress for this module
    const { data: allSubMateriProgress, error: fetchError } = await client
      .from("user_sub_materi_progress_simple")
      .select("*")
      .eq("user_id", userId)
      .eq("module_id", moduleId);

    if (fetchError) {
      console.error("Error fetching sub-materi progress:", fetchError);
      return { success: false, error: fetchError };
    }

    if (!allSubMateriProgress || allSubMateriProgress.length === 0) {
      console.log("No sub-materi progress found, setting module to 0%");

      // Create initial module progress record
      const { error: initError } = await client
        .from("user_module_progress_simple")
        .upsert(
          {
            user_id: userId,
            module_id: moduleId,
            progress_percentage: 0,
            is_completed: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,module_id" }
        );

      if (initError) {
        console.error("Error initializing module progress:", initError);
        return { success: false, error: initError };
      }

      return { success: true, progress: 0, completed: false };
    }

    // Calculate average progress
    const totalProgress = allSubMateriProgress.reduce(
      (sum, sub) => sum + (sub.progress_percentage || 0),
      0
    );
    const averageProgress = totalProgress / allSubMateriProgress.length;

    // Check if all sub-materis are completed
    const allCompleted = allSubMateriProgress.every(
      (sub) => sub.is_completed === true
    );

    const moduleProgressPercentage = Math.round(averageProgress * 100) / 100;

    console.log("📈 Module progress calculated:", {
      totalSubMateris: allSubMateriProgress.length,
      completedCount: allSubMateriProgress.filter((s) => s.is_completed).length,
      averageProgress: moduleProgressPercentage,
      allCompleted,
    });

    // Update module progress
    const { data: moduleProgressData, error: updateError } = await client
      .from("user_module_progress_simple")
      .upsert(
        {
          user_id: userId,
          module_id: moduleId,
          progress_percentage: moduleProgressPercentage,
          is_completed: allCompleted,
          completed_at: allCompleted ? new Date().toISOString() : null,
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
      progress: moduleProgressPercentage,
      completed: allCompleted,
    });

    return {
      success: true,
      progress: moduleProgressPercentage,
      completed: allCompleted,
      data: moduleProgressData,
    };
  } catch (error) {
    console.error("Exception in recalculateModuleProgress:", error);
    return { success: false, error };
  }
}

// POST /api/v1/simple-quizzes/submit - Submit quiz (simple system)
const submitSimpleQuiz = async (req, res) => {
  try {
    const { module_id, sub_materi_id, quiz_data, answers, time_taken_seconds } =
      req.body;

    const userId = req.user.id;
    const client = req.supabase;

    // Validate required fields
    if (!module_id || !sub_materi_id || !quiz_data || !answers) {
      return failure(
        res,
        "VALIDATION_ERROR",
        "Missing required fields: module_id, sub_materi_id, quiz_data, answers",
        422
      );
    }

    console.log("DEBUG: Submitting simple quiz:", {
      userId,
      module_id,
      sub_materi_id,
      answersCount: answers.length,
    });

    // Calculate score
    const totalQuestions = answers.length;
    const correctAnswers = answers.filter((a) => a.is_correct).length;
    const score =
      totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
    const isPassed = score >= 70; // Default passing score

    // Check if there's an ongoing attempt
    const { data: existingAttempt } = await client
      .from("user_quiz_attempts_simple")
      .select("id, started_at")
      .eq("user_id", userId)
      .eq("module_id", module_id)
      .eq("sub_materi_id", sub_materi_id)
      .is("completed_at", null)
      .maybeSingle();

    let attemptData;

    if (existingAttempt) {
      // Update existing attempt
      console.log("DEBUG: Updating existing attempt:", existingAttempt.id);

      const { data: updatedAttempt, error: updateError } = await client
        .from("user_quiz_attempts_simple")
        .update({
          quiz_data,
          score,
          total_questions: totalQuestions,
          correct_answers: correctAnswers,
          answers,
          completed_at: new Date().toISOString(),
          is_passed: isPassed,
          time_taken_seconds,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingAttempt.id)
        .select()
        .single();

      if (updateError) {
        console.error("DEBUG: Error updating attempt:", updateError);
        return failure(
          res,
          "QUIZ_UPDATE_ERROR",
          "Failed to update quiz attempt",
          500,
          { details: updateError.message }
        );
      }

      attemptData = updatedAttempt;
    } else {
      // Create new attempt
      console.log("DEBUG: Creating new quiz attempt");

      const { data: newAttempt, error: insertError } = await client
        .from("user_quiz_attempts_simple")
        .insert({
          user_id: userId,
          module_id,
          sub_materi_id,
          quiz_data,
          score,
          total_questions: totalQuestions,
          correct_answers: correctAnswers,
          answers,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          is_passed: isPassed,
          time_taken_seconds,
        })
        .select()
        .single();

      if (insertError) {
        console.error("DEBUG: Error creating attempt:", insertError);
        return failure(
          res,
          "QUIZ_CREATE_ERROR",
          "Failed to create quiz attempt",
          500,
          { details: insertError.message }
        );
      }

      attemptData = newAttempt;
    }

    console.log("DEBUG: Quiz attempt saved successfully:", {
      attemptId: attemptData.id,
      score,
      isPassed,
    });

    // 🔥 FIX: Update sub-materi progress - Mark as completed when quiz is passed
    console.log("DEBUG: Updating sub-materi progress after quiz:", {
      userId,
      module_id,
      sub_materi_id,
      score,
      isPassed,
    });

    let currentSubMateriProgress = null;
    try {
      const { data: progressData, error: progressError } = await client
        .from("user_sub_materi_progress_simple")
        .upsert(
          {
            user_id: userId,
            module_id,
            sub_materi_id,
            is_completed: isPassed, // 🔥 FIX: Mark as completed when passed
            progress_percentage: isPassed ? 100 : score,
            completed_at: isPassed ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,sub_materi_id",
            ignoreDuplicates: false,
          }
        )
        .select()
        .single();

      if (progressError) {
        console.error(
          "DEBUG: Error updating sub-materi progress:",
          progressError
        );
      } else {
        console.log("DEBUG: Sub-materi progress updated:", progressData);
        currentSubMateriProgress = progressData;
      }
    } catch (progressUpdateError) {
      console.error(
        "DEBUG: Exception updating sub-materi progress:",
        progressUpdateError
      );
    }

    // 🔥 CRITICAL: Recalculate module progress after quiz submission
    const moduleProgressResult = await recalculateModuleProgress(
      client,
      userId,
      module_id
    );

    if (!moduleProgressResult.success) {
      console.error(
        "⚠️ Failed to recalculate module progress, but quiz saved successfully"
      );
    }

    // 🔥 NEW: Return sub-materi completion status to frontend
    return success(res, "QUIZ_SUBMITTED", "Quiz submitted successfully", {
      attempt: {
        id: attemptData.id,
        score: attemptData.score,
        is_passed: attemptData.is_passed,
        correct_answers: attemptData.correct_answers,
        total_questions: attemptData.total_questions,
        completed_at: attemptData.completed_at,
        started_at: attemptData.started_at,
      },
      results: {
        score,
        correct_answers: correctAnswers,
        total_questions: totalQuestions,
        is_passed: isPassed,
        passing_score: 70,
      },
      // 🔥 NEW: Add sub-materi progress info for frontend to handle navigation
      sub_materi_progress: currentSubMateriProgress,
      module_progress: moduleProgressResult.data || null,
    });
  } catch (error) {
    console.error("Submit simple quiz error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// GET /api/v1/simple-quizzes/results - Get quiz results (simple system)
const getSimpleQuizResults = async (req, res) => {
  try {
    const { module_id, sub_materi_id } = req.query;
    const userId = req.user.id;
    const client = req.supabase;

    if (!module_id || !sub_materi_id) {
      return failure(
        res,
        "VALIDATION_ERROR",
        "Missing required query params: module_id, sub_materi_id",
        422
      );
    }

    console.log("DEBUG: Getting simple quiz results:", {
      userId,
      module_id,
      sub_materi_id,
    });

    // Get latest completed attempt
    const { data: attempt, error: attemptError } = await client
      .from("user_quiz_attempts_simple")
      .select("*")
      .eq("user_id", userId)
      .eq("module_id", parseInt(module_id))
      .eq("sub_materi_id", sub_materi_id)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (attemptError) {
      console.error("DEBUG: Error fetching attempt:", attemptError);
      return failure(
        res,
        "ATTEMPT_FETCH_ERROR",
        "Failed to fetch attempt",
        500,
        {
          details: attemptError.message,
        }
      );
    }

    if (!attempt) {
      console.log("DEBUG: No quiz attempt found");
      return success(res, "NO_ATTEMPT", "No quiz attempt found", {
        attempt: null,
      });
    }

    console.log("DEBUG: Quiz attempt found:", {
      attemptId: attempt.id,
      score: attempt.score,
      isPassed: attempt.is_passed,
    });

    return success(res, "QUIZ_RESULTS_FOUND", "Quiz results retrieved", {
      attempt: {
        id: attempt.id,
        score: attempt.score,
        is_passed: attempt.is_passed,
        correct_answers: attempt.correct_answers,
        total_questions: attempt.total_questions,
        answers: attempt.answers,
        completed_at: attempt.completed_at,
        started_at: attempt.started_at,
        time_taken_seconds: attempt.time_taken_seconds,
      },
    });
  } catch (error) {
    console.error("Get simple quiz results error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// GET /api/v1/simple-quizzes/history - Get all quiz attempts history
const getSimpleQuizHistory = async (req, res) => {
  try {
    const { module_id } = req.query;
    const userId = req.user.id;
    const client = req.supabase;

    let query = client
      .from("user_quiz_attempts_simple")
      .select("*")
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false });

    if (module_id) {
      query = query.eq("module_id", parseInt(module_id));
    }

    const { data: attempts, error } = await query;

    if (error) {
      return failure(res, "FETCH_ERROR", "Failed to fetch quiz history", 500, {
        details: error.message,
      });
    }

    return success(res, "HISTORY_FOUND", "Quiz history retrieved", {
      attempts: attempts || [],
      total: attempts?.length || 0,
    });
  } catch (error) {
    console.error("Get simple quiz history error:", error);
    return failure(res, "INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// Register routes
router.post("/submit", submitSimpleQuiz);
router.get("/results", getSimpleQuizResults);
router.get("/history", getSimpleQuizHistory);

module.exports = router;
