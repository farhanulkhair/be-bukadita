const Joi = require("joi");

// Schema untuk membuat poin detail baru
const createPoinDetailSchema = Joi.object({
  title: Joi.string().trim().min(3).max(200).required().messages({
    "string.min": "Judul poin minimal 3 karakter",
    "string.max": "Judul poin maksimal 200 karakter",
    "any.required": "Judul poin wajib diisi",
  }),
  content_html: Joi.string().trim().min(10).required().messages({
    "string.min": "Isi konten minimal 10 karakter",
    "any.required": "Isi konten wajib diisi",
  }),
  sub_materi_id: Joi.string().uuid().required().messages({
    "string.guid": "Sub Materi ID harus berformat UUID yang valid",
    "any.required": "Sub Materi ID wajib diisi",
  }),
  order_index: Joi.number().integer().min(0).optional().default(0),
  duration_label: Joi.string().trim().optional().allow(""),
  duration_minutes: Joi.number().integer().min(0).optional(),
});

// Schema untuk update poin detail
const updatePoinDetailSchema = Joi.object({
  title: Joi.string().trim().min(3).max(200).optional(),
  content_html: Joi.string().trim().min(10).optional(),
  sub_materi_id: Joi.string().uuid().optional(),
  order_index: Joi.number().integer().min(0).optional(),
  duration_label: Joi.string().trim().optional().allow(""),
  duration_minutes: Joi.number().integer().min(0).optional(),
})
  .min(1)
  .messages({
    "object.min": "Minimal satu field harus diubah",
  });

module.exports = {
  createPoinDetailSchema,
  updatePoinDetailSchema,
};
