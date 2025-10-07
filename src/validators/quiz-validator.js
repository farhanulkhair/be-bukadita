const Joi = require("joi");

// Schema untuk membuat kuis baru
const createMateriQuizSchema = Joi.object({
  judul: Joi.string().trim().min(3).max(200).required().messages({
    "string.min": "Judul kuis minimal 3 karakter",
    "string.max": "Judul kuis maksimal 200 karakter",
    "any.required": "Judul kuis wajib diisi",
  }),
  deskripsi: Joi.string().trim().max(1000).optional().allow(""),
  sub_materi_id: Joi.string().uuid().required().messages({
    "string.guid": "Sub Materi ID harus berformat UUID yang valid",
    "any.required": "Sub Materi ID wajib diisi",
  }),
  passing_score: Joi.number().integer().min(1).max(100).optional().default(70),
  time_limit: Joi.number().integer().min(60).optional(), // dalam detik
});

// Schema untuk update kuis
const updateMateriQuizSchema = Joi.object({
  judul: Joi.string().trim().min(3).max(200).optional(),
  deskripsi: Joi.string().trim().max(1000).optional().allow(""),
  sub_materi_id: Joi.string().uuid().optional(),
  passing_score: Joi.number().integer().min(1).max(100).optional(),
  time_limit: Joi.number().integer().min(60).optional(),
})
  .min(1)
  .messages({
    "object.min": "Minimal satu field harus diubah",
  });

// Schema untuk membuat pertanyaan kuis
const createQuizQuestionSchema = Joi.object({
  pertanyaan: Joi.string().trim().min(5).required().messages({
    "string.min": "Pertanyaan minimal 5 karakter",
    "any.required": "Pertanyaan wajib diisi",
  }),
  options: Joi.array()
    .items(Joi.string().trim().min(1))
    .min(2)
    .max(5)
    .required()
    .messages({
      "array.min": "Minimal 2 pilihan jawaban",
      "array.max": "Maksimal 5 pilihan jawaban",
      "any.required": "Pilihan jawaban wajib diisi",
    }),
  correct_answer: Joi.number().integer().min(0).required().messages({
    "any.required": "Index jawaban benar wajib diisi",
  }),
  quiz_id: Joi.string().uuid().required().messages({
    "string.guid": "Quiz ID harus berformat UUID yang valid",
    "any.required": "Quiz ID wajib diisi",
  }),
  order_index: Joi.number().integer().min(0).optional().default(0),
})
  .custom((value, helpers) => {
    // Validasi bahwa correct_answer index valid terhadap options array
    if (value.correct_answer >= value.options.length) {
      return helpers.error("custom.correctAnswerOutOfBounds");
    }
    return value;
  }, "Validate correct_answer index")
  .messages({
    "custom.correctAnswerOutOfBounds":
      "Index jawaban benar melebihi jumlah pilihan",
  });

// Schema untuk update pertanyaan kuis
const updateQuizQuestionSchema = Joi.object({
  pertanyaan: Joi.string().trim().min(5).optional(),
  options: Joi.array()
    .items(Joi.string().trim().min(1))
    .min(2)
    .max(5)
    .optional(),
  correct_answer: Joi.number().integer().min(0).optional(),
  quiz_id: Joi.string().uuid().optional(),
  order_index: Joi.number().integer().min(0).optional(),
})
  .min(1)
  .messages({
    "object.min": "Minimal satu field harus diubah",
  })
  .custom((value, helpers) => {
    // Validasi bahwa correct_answer index valid jika ada options
    if (
      value.options &&
      value.correct_answer !== undefined &&
      value.correct_answer >= value.options.length
    ) {
      return helpers.error("custom.correctAnswerOutOfBounds");
    }
    return value;
  }, "Validate correct_answer index")
  .messages({
    "custom.correctAnswerOutOfBounds":
      "Index jawaban benar melebihi jumlah pilihan",
  });

// Schema untuk submit attempt kuis
const submitQuizAttemptSchema = Joi.object({
  answers: Joi.object()
    .pattern(
      Joi.string().uuid(), // question_id
      Joi.number().integer().min(0) // selected_option_index
    )
    .min(1)
    .required()
    .messages({
      "object.min": "Minimal satu jawaban harus diisi",
      "any.required": "Jawaban wajib diisi",
    }),
});

module.exports = {
  createMateriQuizSchema,
  updateMateriQuizSchema,
  createQuizQuestionSchema,
  updateQuizQuestionSchema,
  submitQuizAttemptSchema,
};
