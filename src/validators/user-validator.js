const Joi = require("joi");

/**
 * User Validators
 * Validation schemas for user-related operations
 */

// Schema untuk user update profil sendiri (self-management)
const updateOwnProfileSchema = Joi.object({
  full_name: Joi.string().trim().min(2).max(100).optional().messages({
    "string.min": "Nama lengkap minimal 2 karakter",
    "string.max": "Nama lengkap maksimal 100 karakter",
  }),
  email: Joi.string().email().optional().messages({
    "string.email": "Email harus berformat email yang valid",
  }),
  phone: Joi.string()
    .trim()
    .pattern(/^(\+62|62|0)[0-9]{9,12}$/)
    .optional()
    .allow(null, "")
    .messages({
      "string.pattern.base":
        "Nomor telepon harus berformat Indonesia yang valid (08xx atau +62xx)",
    }),
  address: Joi.string().max(500).optional().allow(null, ""),
  date_of_birth: Joi.date().iso().optional().allow(null),
  profil_url: Joi.string().uri().optional().allow(null, ""),
})
  .min(1)
  .messages({
    "object.min": "Minimal satu field harus diubah",
  });

// Schema untuk admin create user
const createUserSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Email harus berformat email yang valid",
    "string.empty": "Email wajib diisi",
    "any.required": "Email wajib diisi",
  }),
  password: Joi.string().min(6).max(100).required().messages({
    "string.min": "Password minimal 6 karakter",
    "string.max": "Password maksimal 100 karakter",
    "string.empty": "Password wajib diisi",
    "any.required": "Password wajib diisi",
  }),
  full_name: Joi.string().min(2).max(100).required().messages({
    "string.min": "Nama lengkap minimal 2 karakter",
    "string.max": "Nama lengkap maksimal 100 karakter",
    "string.empty": "Nama lengkap wajib diisi",
    "any.required": "Nama lengkap wajib diisi",
  }),
  phone: Joi.string()
    .trim()
    .pattern(/^(\+62|62|0)[0-9]{9,12}$/)
    .optional()
    .allow(null, "")
    .messages({
      "string.pattern.base":
        "Nomor telepon harus berformat Indonesia yang valid (08xx atau +62xx)",
    }),
  role: Joi.string()
    .valid("pengguna", "admin", "superadmin")
    .default("pengguna")
    .messages({
      "any.only": "Role harus salah satu dari: pengguna, admin, superadmin",
    }),
  address: Joi.string().max(500).optional().allow(null, ""),
  date_of_birth: Joi.date().optional().allow(null),
  gender: Joi.string().valid("male", "female", "other").optional().allow(null),
});

// Schema untuk admin update user
const updateUserSchema = Joi.object({
  full_name: Joi.string().min(2).max(100).optional().messages({
    "string.min": "Nama lengkap minimal 2 karakter",
    "string.max": "Nama lengkap maksimal 100 karakter",
  }),
  email: Joi.string().email().optional().messages({
    "string.email": "Email harus berformat email yang valid",
  }),
  phone: Joi.string()
    .trim()
    .pattern(/^(\+62|62|0)[0-9]{9,12}$/)
    .optional()
    .allow(null, "")
    .messages({
      "string.pattern.base":
        "Nomor telepon harus berformat Indonesia yang valid (08xx atau +62xx)",
    }),
  address: Joi.string().max(500).optional().allow(null, ""),
  date_of_birth: Joi.date().optional().allow(null),
  gender: Joi.string().valid("male", "female", "other").optional().allow(null),
  bio: Joi.string().max(1000).optional().allow(null, ""),
  profil_url: Joi.string().uri().optional().allow(null, "").messages({
    "string.uri": "URL foto profil harus berformat URL yang valid",
  }),
  is_active: Joi.boolean().optional(),
})
  .min(1)
  .messages({
    "object.min": "Minimal satu field harus diubah",
  });

// Schema untuk admin update user role
const updateUserRoleSchema = Joi.object({
  role: Joi.string()
    .valid("pengguna", "admin", "superadmin")
    .required()
    .messages({
      "any.only": "Role harus salah satu dari: pengguna, admin, superadmin",
      "any.required": "Role wajib diisi",
    }),
});

// Schema untuk upload profile photo
const uploadPhotoSchema = Joi.object({
  photo: Joi.any().required().messages({
    "any.required": "File foto wajib diupload",
  }),
});

// Schema untuk admin invite (superadmin only)
const inviteAdminSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Email harus berformat email yang valid",
    "string.empty": "Email wajib diisi",
    "any.required": "Email wajib diisi",
  }),
  password: Joi.string().min(6).max(100).required().messages({
    "string.min": "Password minimal 6 karakter",
    "string.max": "Password maksimal 100 karakter",
    "string.empty": "Password wajib diisi",
    "any.required": "Password wajib diisi",
  }),
  full_name: Joi.string().min(2).max(100).required().messages({
    "string.min": "Nama lengkap minimal 2 karakter",
    "string.max": "Nama lengkap maksimal 100 karakter",
    "string.empty": "Nama lengkap wajib diisi",
    "any.required": "Nama lengkap wajib diisi",
  }),
  phone: Joi.string()
    .trim()
    .pattern(/^(\+62|62|0)[0-9]{9,12}$/)
    .optional()
    .allow(null, "")
    .messages({
      "string.pattern.base":
        "Nomor telepon harus berformat Indonesia yang valid (08xx atau +62xx)",
    }),
});

module.exports = {
  updateOwnProfileSchema,
  createUserSchema,
  updateUserSchema,
  updateUserRoleSchema,
  uploadPhotoSchema,
  inviteAdminSchema,
};

