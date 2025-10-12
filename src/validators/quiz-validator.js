const Joi = require("joi");

// Schema untuk membuat quiz baru
const createQuizSchema = Joi.object({
  title: Joi.string().trim().min(3).max(200).required().messages({
    "string.empty": "Judul quiz wajib diisi",
    "string.min": "Judul quiz minimal 3 karakter",
    "string.max": "Judul quiz maksimal 200 karakter",
    "any.required": "Judul quiz wajib diisi",
  }),

  sub_materi_id: Joi.string().uuid().required().messages({
    "string.empty": "Sub materi wajib dipilih",
    "string.guid": "Format sub materi ID tidak valid",
    "any.required": "Sub materi wajib dipilih",
  }),

  description: Joi.string().trim().max(1000).allow("", null).messages({
    "string.max": "Deskripsi maksimal 1000 karakter",
  }),

  time_limit_seconds: Joi.number()
    .integer()
    .min(60)
    .max(7200)
    .default(600)
    .messages({
      "number.base": "Batas waktu harus berupa angka",
      "number.integer": "Batas waktu harus berupa bilangan bulat",
      "number.min": "Batas waktu minimal 60 detik (1 menit)",
      "number.max": "Batas waktu maksimal 7200 detik (2 jam)",
    }),

  passing_score: Joi.number().integer().min(0).max(100).default(70).messages({
    "number.base": "Nilai kelulusan harus berupa angka",
    "number.integer": "Nilai kelulusan harus berupa bilangan bulat",
    "number.min": "Nilai kelulusan minimal 0",
    "number.max": "Nilai kelulusan maksimal 100",
  }),

  published: Joi.boolean().default(false),

  quiz_type: Joi.string().valid("sub", "module").default("sub"),
});

// Schema untuk update quiz
const updateQuizSchema = Joi.object({
  title: Joi.string().trim().min(3).max(200).messages({
    "string.empty": "Judul quiz tidak boleh kosong",
    "string.min": "Judul quiz minimal 3 karakter",
    "string.max": "Judul quiz maksimal 200 karakter",
  }),

  sub_materi_id: Joi.string().uuid().messages({
    "string.guid": "Format sub materi ID tidak valid",
  }),

  description: Joi.string().trim().max(1000).allow("", null).messages({
    "string.max": "Deskripsi maksimal 1000 karakter",
  }),

  time_limit_seconds: Joi.number().integer().min(60).max(7200).messages({
    "number.base": "Batas waktu harus berupa angka",
    "number.integer": "Batas waktu harus berupa bilangan bulat",
    "number.min": "Batas waktu minimal 60 detik (1 menit)",
    "number.max": "Batas waktu maksimal 7200 detik (2 jam)",
  }),

  passing_score: Joi.number().integer().min(0).max(100).messages({
    "number.base": "Nilai kelulusan harus berupa angka",
    "number.integer": "Nilai kelulusan harus berupa bilangan bulat",
    "number.min": "Nilai kelulusan minimal 0",
    "number.max": "Nilai kelulusan maksimal 100",
  }),

  published: Joi.boolean(),

  quiz_type: Joi.string().valid("sub", "module"),
}).min(1);

// Schema untuk membuat pertanyaan quiz
const createQuestionSchema = Joi.object({
  question_text: Joi.string().trim().min(10).max(1000).required().messages({
    "string.empty": "Teks pertanyaan wajib diisi",
    "string.min": "Teks pertanyaan minimal 10 karakter",
    "string.max": "Teks pertanyaan maksimal 1000 karakter",
    "any.required": "Teks pertanyaan wajib diisi",
  }),

  options: Joi.array()
    .items(Joi.string().trim().min(1).max(300))
    .min(2)
    .max(4)
    .required()
    .messages({
      "array.min": "Minimal harus ada 2 pilihan jawaban",
      "array.max": "Maksimal 4 pilihan jawaban",
      "any.required": "Pilihan jawaban wajib diisi",
    }),

  correct_answer_index: Joi.number()
    .integer()
    .min(0)
    .max(3)
    .required()
    .messages({
      "number.base": "Indeks jawaban benar harus berupa angka",
      "number.integer": "Indeks jawaban benar harus berupa bilangan bulat",
      "number.min": "Indeks jawaban benar minimal 0",
      "number.max": "Indeks jawaban benar maksimal 3",
      "any.required": "Jawaban yang benar wajib dipilih",
    }),

  explanation: Joi.string().trim().max(500).allow("", null).messages({
    "string.max": "Penjelasan maksimal 500 karakter",
  }),

  order_index: Joi.number().integer().min(0).default(0),
})
  .custom((value, helpers) => {
    // Validasi bahwa correct_answer_index valid terhadap options array
    if (value.correct_answer_index >= value.options.length) {
      return helpers.error("custom.correctAnswerOutOfBounds");
    }
    return value;
  }, "Validate correct_answer_index")
  .messages({
    "custom.correctAnswerOutOfBounds":
      "Indeks jawaban benar melebihi jumlah pilihan",
  });

// Schema untuk update pertanyaan
const updateQuestionSchema = Joi.object({
  question_text: Joi.string().trim().min(10).max(1000).messages({
    "string.empty": "Teks pertanyaan tidak boleh kosong",
    "string.min": "Teks pertanyaan minimal 10 karakter",
    "string.max": "Teks pertanyaan maksimal 1000 karakter",
  }),

  options: Joi.array()
    .items(Joi.string().trim().min(1).max(300))
    .min(2)
    .max(4)
    .messages({
      "array.min": "Minimal harus ada 2 pilihan jawaban",
      "array.max": "Maksimal 4 pilihan jawaban",
    }),

  correct_answer_index: Joi.number().integer().min(0).max(3).messages({
    "number.base": "Indeks jawaban benar harus berupa angka",
    "number.integer": "Indeks jawaban benar harus berupa bilangan bulat",
    "number.min": "Indeks jawaban benar minimal 0",
    "number.max": "Indeks jawaban benar maksimal 3",
  }),

  explanation: Joi.string().trim().max(500).allow("", null).messages({
    "string.max": "Penjelasan maksimal 500 karakter",
  }),

  order_index: Joi.number().integer().min(0),
})
  .min(1)
  .custom((value, helpers) => {
    // Validasi bahwa correct_answer_index valid jika ada options
    if (
      value.options &&
      value.correct_answer_index !== undefined &&
      value.correct_answer_index >= value.options.length
    ) {
      return helpers.error("custom.correctAnswerOutOfBounds");
    }
    return value;
  }, "Validate correct_answer_index")
  .messages({
    "custom.correctAnswerOutOfBounds":
      "Indeks jawaban benar melebihi jumlah pilihan",
  });

// Schema untuk submit quiz answers
const submitQuizAnswersSchema = Joi.object({
  answers: Joi.array()
    .items(
      Joi.object({
        question_id: Joi.string().uuid().required().messages({
          "string.guid": "Format question ID tidak valid",
          "any.required": "Question ID wajib diisi",
        }),
        selected_option_index: Joi.number()
          .integer()
          .min(0)
          .max(3)
          .required()
          .messages({
            "number.base": "Pilihan jawaban harus berupa angka",
            "number.integer": "Pilihan jawaban harus berupa bilangan bulat",
            "number.min": "Pilihan jawaban minimal 0",
            "number.max": "Pilihan jawaban maksimal 3",
            "any.required": "Pilihan jawaban wajib diisi",
          }),
      })
    )
    .min(1)
    .required()
    .messages({
      "array.min": "Minimal satu jawaban harus diisi",
      "any.required": "Jawaban wajib diisi",
    }),
});

module.exports = {
  createQuizSchema,
  updateQuizSchema,
  createQuestionSchema,
  updateQuestionSchema,
  submitQuizAnswersSchema,
};
