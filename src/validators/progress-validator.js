const Joi = require("joi");

/**
 * Progress Validators
 * Validation schemas for progress tracking operations
 */

// Schema untuk complete poin
const completePoinSchema = Joi.object({
  completed: Joi.boolean().default(true),
  time_spent_seconds: Joi.number().integer().min(0).optional().messages({
    "number.base": "Waktu yang dihabiskan harus berupa angka",
    "number.integer": "Waktu yang dihabiskan harus berupa bilangan bulat",
    "number.min": "Waktu yang dihabiskan minimal 0 detik",
  }),
});

// Schema untuk complete sub-materi
const completeSubMateriSchema = Joi.object({
  completed: Joi.boolean().default(true),
  score: Joi.number().integer().min(0).max(100).optional().messages({
    "number.base": "Skor harus berupa angka",
    "number.integer": "Skor harus berupa bilangan bulat",
    "number.min": "Skor minimal 0",
    "number.max": "Skor maksimal 100",
  }),
});

// Schema untuk update progress percentage
const updateProgressSchema = Joi.object({
  progress_percentage: Joi.number().min(0).max(100).required().messages({
    "number.base": "Persentase progress harus berupa angka",
    "number.min": "Persentase progress minimal 0",
    "number.max": "Persentase progress maksimal 100",
    "any.required": "Persentase progress wajib diisi",
  }),
  is_completed: Joi.boolean().optional(),
});

// Schema untuk query progress
const queryProgressSchema = Joi.object({
  module_id: Joi.string().uuid().optional().messages({
    "string.guid": "Module ID harus berformat UUID yang valid",
  }),
  sub_materi_id: Joi.string().uuid().optional().messages({
    "string.guid": "Sub Materi ID harus berformat UUID yang valid",
  }),
  include_details: Joi.boolean().default(false),
});

module.exports = {
  completePoinSchema,
  completeSubMateriSchema,
  updateProgressSchema,
  queryProgressSchema,
};

