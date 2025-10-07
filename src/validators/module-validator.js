const Joi = require("joi");

// Create/Update validators for modules
// Align with controller fields: title, description, published, duration_label, duration_minutes, lessons, difficulty, category
const commonFields = {
  title: Joi.string().trim().min(3).max(200),
  description: Joi.string().allow("").max(2000),
  published: Joi.boolean(),
  duration_label: Joi.string().trim().max(100).allow(null, ""),
  duration_minutes: Joi.number().integer().min(0).allow(null),
  lessons: Joi.number().integer().min(0).allow(null),
  difficulty: Joi.string().trim().max(50).allow(null, ""),
  category: Joi.string().trim().max(100).allow(null, ""),
};

const createModuleSchema = Joi.object({
  ...commonFields,
  title: commonFields.title.required(),
  description: commonFields.description.default(""),
  published: commonFields.published.default(false),
}).unknown(false);

const updateModuleSchema = Joi.object({
  ...commonFields,
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided",
  })
  .unknown(false);

module.exports = { createModuleSchema, updateModuleSchema };
