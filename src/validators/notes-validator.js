const Joi = require("joi");

/**
 * Notes Validators
 * Validation schemas for notes-related operations
 */

// Schema untuk create note
const createNoteSchema = Joi.object({
  title: Joi.string().trim().max(200).allow(null, "").messages({
    "string.max": "Judul catatan maksimal 200 karakter",
  }),
  content: Joi.string().trim().min(1).max(10000).required().messages({
    "string.empty": "Konten catatan wajib diisi",
    "string.min": "Konten catatan minimal 1 karakter",
    "string.max": "Konten catatan maksimal 10000 karakter",
    "any.required": "Konten catatan wajib diisi",
  }),
  module_id: Joi.string().uuid().optional().allow(null).messages({
    "string.guid": "Module ID harus berformat UUID yang valid",
  }),
  sub_materi_id: Joi.string().uuid().optional().allow(null).messages({
    "string.guid": "Sub Materi ID harus berformat UUID yang valid",
  }),
  pinned: Joi.boolean().default(false),
  archived: Joi.boolean().default(false),
  tags: Joi.array().items(Joi.string().trim().max(50)).max(10).optional(),
});

// Schema untuk update note
const updateNoteSchema = Joi.object({
  title: Joi.string().trim().max(200).allow(null, "").messages({
    "string.max": "Judul catatan maksimal 200 karakter",
  }),
  content: Joi.string().trim().min(1).max(10000).messages({
    "string.empty": "Konten catatan tidak boleh kosong",
    "string.min": "Konten catatan minimal 1 karakter",
    "string.max": "Konten catatan maksimal 10000 karakter",
  }),
  module_id: Joi.string().uuid().allow(null).messages({
    "string.guid": "Module ID harus berformat UUID yang valid",
  }),
  sub_materi_id: Joi.string().uuid().allow(null).messages({
    "string.guid": "Sub Materi ID harus berformat UUID yang valid",
  }),
  pinned: Joi.boolean(),
  archived: Joi.boolean(),
  tags: Joi.array().items(Joi.string().trim().max(50)).max(10),
})
  .min(1)
  .messages({
    "object.min": "Minimal satu field harus diubah",
  });

// Schema untuk search/filter notes
const searchNotesSchema = Joi.object({
  q: Joi.string().trim().max(100).optional().messages({
    "string.max": "Query pencarian maksimal 100 karakter",
  }),
  module_id: Joi.string().uuid().optional().messages({
    "string.guid": "Module ID harus berformat UUID yang valid",
  }),
  sub_materi_id: Joi.string().uuid().optional().messages({
    "string.guid": "Sub Materi ID harus berformat UUID yang valid",
  }),
  pinned: Joi.string().valid("true", "false").optional(),
  archived: Joi.string().valid("true", "false").optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort_by: Joi.string()
    .valid("created_at", "updated_at", "title")
    .default("updated_at"),
  sort_order: Joi.string().valid("asc", "desc").default("desc"),
});

module.exports = {
  createNoteSchema,
  updateNoteSchema,
  searchNotesSchema,
};

