const Joi = require("joi");

// Schema untuk membuat sub_materi baru
const createSubMateriSchema = Joi.object({
  title: Joi.string().trim().min(3).max(200).required().messages({
    "string.min": "Judul materi minimal 3 karakter",
    "string.max": "Judul materi maksimal 200 karakter",
    "any.required": "Judul materi wajib diisi",
  }),
  content: Joi.string().trim().min(10).required().messages({
    "string.min": "Konten materi minimal 10 karakter",
    "any.required": "Konten materi wajib diisi",
  }),
  module_id: Joi.string().uuid().required().messages({
    "string.guid": "Module ID harus berformat UUID yang valid",
    "any.required": "Module ID wajib diisi",
  }),
  order_index: Joi.number().integer().min(0).optional().default(0),
  published: Joi.boolean().optional().default(false),
});

// Schema untuk update sub_materi
const updateSubMateriSchema = Joi.object({
  title: Joi.string().trim().min(3).max(200).optional(),
  content: Joi.string().trim().min(10).optional(),
  module_id: Joi.string().uuid().optional(),
  order_index: Joi.number().integer().min(0).optional(),
  published: Joi.boolean().optional(),
})
  .min(1)
  .messages({
    "object.min": "Minimal satu field harus diubah",
  });

module.exports = {
  createSubMateriSchema,
  updateSubMateriSchema,
};
