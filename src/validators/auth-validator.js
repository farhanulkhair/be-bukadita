const Joi = require("joi");

/**
 * Auth Validators
 * Validation schemas for authentication-related operations
 */

// Schema untuk registrasi user baru
const registerSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } }) // Allow all TLDs including .gmail.com
    .trim() // Remove whitespace
    .lowercase() // Normalize to lowercase for consistency
    .required()
    .messages({
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
  full_name: Joi.string().trim().min(2).max(100).required().messages({
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

// Schema untuk login - bisa menggunakan email atau nomor HP
const loginSchema = Joi.object({
  identifier: Joi.string()
    .trim()
    .required()
    .messages({
      "string.empty": "Email atau nomor HP wajib diisi",
      "any.required": "Email atau nomor HP wajib diisi",
    }),
  password: Joi.string().min(6).required().messages({
    "string.min": "Password minimal 6 karakter",
    "string.empty": "Password wajib diisi",
    "any.required": "Password wajib diisi",
  }),
});

// Schema untuk create/update profile (after OAuth)
const profileSchema = Joi.object({
  full_name: Joi.string().min(2).max(100).required().messages({
    "string.min": "Nama lengkap minimal 2 karakter",
    "string.max": "Nama lengkap maksimal 100 karakter",
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
  address: Joi.string().max(500).optional().allow(null, ""),
  date_of_birth: Joi.date().optional().allow(null),
  gender: Joi.string().valid("male", "female", "other").optional().allow(null),
});

// Schema untuk change password
const changePasswordSchema = Joi.object({
  current_password: Joi.string().min(6).required().messages({
    "string.min": "Password saat ini minimal 6 karakter",
    "string.empty": "Password saat ini wajib diisi",
    "any.required": "Password saat ini wajib diisi",
  }),
  new_password: Joi.string().min(6).max(100).required().messages({
    "string.min": "Password baru minimal 6 karakter",
    "string.max": "Password baru maksimal 100 karakter",
    "string.empty": "Password baru wajib diisi",
    "any.required": "Password baru wajib diisi",
  }),
  confirm_password: Joi.string()
    .valid(Joi.ref("new_password"))
    .required()
    .messages({
      "any.only": "Konfirmasi password harus sama dengan password baru",
      "any.required": "Konfirmasi password wajib diisi",
    }),
});

// Schema untuk refresh token
const refreshTokenSchema = Joi.object({
  refresh_token: Joi.string().required().messages({
    "string.empty": "Refresh token wajib diisi",
    "any.required": "Refresh token wajib diisi",
  }),
});

module.exports = {
  registerSchema,
  loginSchema,
  profileSchema,
  changePasswordSchema,
  refreshTokenSchema,
};

