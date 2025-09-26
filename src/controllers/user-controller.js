const Joi = require("joi");
const { success, failure } = require("../utils/respond");

// Validation schema for updating own profile
const updateOwnProfileSchema = Joi.object({
  full_name: Joi.string().trim().min(2).max(100).optional(),
  phone: Joi.string()
    .trim()
    .pattern(/^($|(\+62[8-9][\d]{8,11})|(0[8-9][\d]{8,11}))$/)
    .messages({
      "string.pattern.base":
        "Phone must start with 08 (or +62) dan 10-13 digit. Contoh: 081234567890",
    })
    .optional(),
  email: Joi.string().trim().email().optional(),
})
  .min(1)
  .messages({
    "object.min": "Minimal satu field diubah",
  });

// GET /api/pengguna/profile - get own profile
async function getMyProfile(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return failure(res, "USER_UNAUTHORIZED", "Unauthorized", 401);
    }
    // Use per-request authenticated client if present (RLS owner access)
    const client = req.supabase; // anon or user client supplied via middleware/auth
    const { data: profile, error } = await client
      .from("profiles")
      .select("id, full_name, phone, email, role, created_at, updated_at")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      return failure(
        res,
        "USER_PROFILE_FETCH_ERROR",
        "Failed to fetch profile",
        500,
        { details: error.message }
      );
    }
    if (!profile) {
      return failure(
        res,
        "USER_PROFILE_NOT_FOUND",
        "Profile belum tersedia. Gunakan PUT /api/pengguna/profile untuk membuat pertama kali.",
        404
      );
    }
    return success(
      res,
      "USER_PROFILE_FETCH_SUCCESS",
      "Profile fetched",
      profile
    );
  } catch (e) {
    console.error("getMyProfile error:", e);
    return failure(res, "USER_INTERNAL_ERROR", "Internal server error", 500, {
      details: e.message,
    });
  }
}

// PUT /api/pengguna/profile - update own profile
async function updateMyProfile(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return failure(res, "USER_UNAUTHORIZED", "Unauthorized", 401);
    }

    const { value, error: valErr } = updateOwnProfileSchema.validate(
      req.body || {}
    );
    if (valErr) {
      return failure(
        res,
        "USER_PROFILE_VALIDATION_ERROR",
        valErr.details[0].message,
        422
      );
    }

    // Ensure profile exists first
    const client = req.supabase;
    const { data: existing, error: fetchErr } = await client
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (fetchErr) {
      return failure(
        res,
        "USER_PROFILE_FETCH_ERROR",
        "Failed to check existing profile",
        500,
        { details: fetchErr.message }
      );
    }
    // If profile doesn't exist yet, create it (Option A: upsert-on-PUT)
    if (!existing) {
      const now = new Date().toISOString();
      const baseFullName =
        value.full_name || req.user?.email?.split("@")[0] || "User";
      const insertPayload = {
        id: userId,
        full_name: baseFullName,
        phone: value.phone || "",
        email: value.email || req.user?.email,
        role: "pengguna", // enforce default role
        created_at: now,
        updated_at: now,
      };

      // If user also wants to change email on initial creation and it's different, update auth first
      let emailChangedInitial = false;
      if (value.email && value.email !== req.user?.email) {
        try {
          const userClient = req.authenticatedClient;
          if (!userClient) {
            return failure(
              res,
              "USER_CLIENT_MISSING",
              "Authenticated client missing for email update",
              500
            );
          }
          const { error: emailErr } = await userClient.auth.updateUser({
            email: value.email,
          });
          if (emailErr) {
            return failure(
              res,
              "USER_EMAIL_UPDATE_ERROR",
              emailErr.message,
              400
            );
          }
          emailChangedInitial = true;
        } catch (e) {
          return failure(res, "USER_EMAIL_UPDATE_EXCEPTION", e.message, 500);
        }
      }

      const { data: created, error: createErr } = await client
        .from("profiles")
        .insert(insertPayload)
        .select("id, full_name, phone, email, role, created_at, updated_at")
        .single();
      if (createErr) {
        return failure(
          res,
          "USER_PROFILE_CREATE_ERROR",
          createErr.message,
          500
        );
      }
      return success(
        res,
        "USER_PROFILE_CREATE_SUCCESS",
        emailChangedInitial
          ? "Profile created & email updated (periksa konfirmasi jika diperlukan)"
          : "Profile created",
        created,
        201
      );
    }

    const updatePayload = { ...value, updated_at: new Date().toISOString() };
    // Never allow role modifications here
    delete updatePayload.role;

    // Handle email change (Supabase Auth) first if requested
    let emailChanged = false;
    if (value.email && value.email !== req.user.email) {
      try {
        // Use per-request authenticated client (must carry user token)
        const userClient = req.authenticatedClient;
        if (!userClient) {
          return failure(
            res,
            "USER_CLIENT_MISSING",
            "Authenticated client missing for email update",
            500
          );
        }
        const { error: emailErr, data: emailData } =
          await userClient.auth.updateUser({ email: value.email });
        if (emailErr) {
          return failure(res, "USER_EMAIL_UPDATE_ERROR", emailErr.message, 400);
        }
        emailChanged = true;
        // If Supabase requires confirmation, email may be pending; still proceed updating profile email for consistency.
      } catch (e) {
        return failure(res, "USER_EMAIL_UPDATE_EXCEPTION", e.message, 500);
      }
    }

    // Do not leave email inside updatePayload if undefined
    if (updatePayload.email === undefined) delete updatePayload.email;

    const { data: updated, error: updErr } = await client
      .from("profiles")
      .update(updatePayload)
      .eq("id", userId)
      .select("id, full_name, phone, email, role, created_at, updated_at")
      .single();

    if (updErr) {
      return failure(res, "USER_PROFILE_UPDATE_ERROR", updErr.message, 500);
    }

    return success(
      res,
      "USER_PROFILE_UPDATE_SUCCESS",
      emailChanged
        ? "Profile & email updated (periksa konfirmasi email jika diperlukan)"
        : "Profile updated",
      updated
    );
  } catch (e) {
    console.error("updateMyProfile error:", e);
    return failure(res, "USER_INTERNAL_ERROR", "Internal server error", 500, {
      details: e.message,
    });
  }
}

module.exports = { getMyProfile, updateMyProfile };
