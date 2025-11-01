const { supabaseAnon, supabaseAdmin } = require("../lib/SupabaseClient");
const { createClient } = require("@supabase/supabase-js");
const { success, failure } = require("../utils/respond");

// Import validation schemas from validator
const {
  profileSchema,
  registerSchema,
  loginSchema,
  changePasswordSchema,
} = require("../validators/auth-validator");

// Utility: detect missing 'role' column error from PostgREST/Supabase
function isMissingRoleColumn(err) {
  if (!err) return false;
  const msg = `${err.message || ""} ${err.hint || ""}`.toLowerCase();
  return (
    err.code === "PGRST204" ||
    msg.includes("'role' column") ||
    (msg.includes("role") &&
      (msg.includes("schema cache") ||
        msg.includes("does not exist") ||
        msg.includes("column")))
  );
}

// Utility: detect RLS denied error
function isRlsDenied(err) {
  if (!err) return false;
  const msg = `${err.message || ""}`.toLowerCase();
  return (
    err.code === "42501" || msg.includes("violates row-level security policy")
  );
}

// POST /api/v1/auth/profile (create/update)
const createOrUpdateProfile = async (req, res) => {
  try {
    const { error: validationError, value } = profileSchema.validate(req.body);
    if (validationError) {
      return failure(
        res,
        "AUTH_PROFILE_VALIDATION_ERROR",
        validationError.details[0].message,
        400
      );
    }

    const { full_name, phone } = value;
    const userId = req.user.id;

    console.log("=== PROFILE CREATE/UPDATE START ===");
    console.log("User ID:", userId);
    console.log("User Email:", req.user.email);
    console.log("Profile data:", { full_name, phone });

    // Build user-authenticated client (so RLS recognizes current user)
    const authHeader = req.headers.authorization || "";
    const accessToken = authHeader.startsWith("Bearer ")
      ? authHeader.substring(7)
      : undefined;
    const userClient = accessToken
      ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: `Bearer ${accessToken}` } },
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : null;

    // Check if profile already exists (prefer userClient to satisfy RLS)
    const { data: existingProfile, error: checkError } = await (
      userClient || supabaseAnon
    )
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      console.error("Error checking existing profile:", checkError);
      return failure(
        res,
        "AUTH_PROFILE_CHECK_ERROR",
        "Failed to check existing profile",
        500,
        { details: checkError.message }
      );
    }

    let profileData;

    if (existingProfile) {
      console.log("Profile exists, updating...");
      // Update existing profile (try with userClient for RLS)
      const updateFields = {
        full_name,
        phone,
        email: req.user.email,
        updated_at: new Date().toISOString(),
      };
      let updRes = await (userClient || supabaseAnon)
        .from("profiles")
        .update(updateFields)
        .eq("id", userId)
        .select()
        .single();

      if (updRes.error && isRlsDenied(updRes.error)) {
        console.warn("[AUTH] RLS denied on update, retrying with service role");
        updRes = await supabaseAdmin
          .from("profiles")
          .update(updateFields)
          .eq("id", userId)
          .select()
          .single();
      }

      if (updRes.error) {
        console.error("Profile update error:", updRes.error);
        return failure(
          res,
          "AUTH_PROFILE_UPDATE_ERROR",
          "Failed to update profile",
          500,
          { details: updRes.error.message }
        );
      }

      profileData = updRes.data;
      console.log("Profile updated successfully:", profileData);
    } else {
      console.log("Profile doesn't exist, creating new profile...");
      // Try create with role first
      let insertPayload = {
        id: userId,
        full_name,
        phone,
        email: req.user.email,
        role: "pengguna",
      };
      let insertRes = await (userClient || supabaseAnon)
        .from("profiles")
        .insert(insertPayload)
        .select()
        .single();

      if (insertRes.error && isMissingRoleColumn(insertRes.error)) {
        console.warn(
          "[AUTH] profiles.role column missing, retrying insert without role"
        );
        const { role, ...payloadNoRole } = insertPayload;
        insertRes = await (userClient || supabaseAnon)
          .from("profiles")
          .insert(payloadNoRole)
          .select()
          .single();
      }

      if (insertRes.error && isRlsDenied(insertRes.error)) {
        console.warn("[AUTH] RLS denied on insert, retrying with service role");
        // Retry with service role, first with role then without role if missing
        let adminRes = await supabaseAdmin
          .from("profiles")
          .insert(insertPayload)
          .select()
          .single();
        if (adminRes.error && isMissingRoleColumn(adminRes.error)) {
          const { role: _role, ...payloadNoRole } = insertPayload;
          adminRes = await supabaseAdmin
            .from("profiles")
            .insert(payloadNoRole)
            .select()
            .single();
        }
        insertRes = adminRes;
      }

      if (insertRes.error) {
        console.error("Profile creation error:", insertRes.error);
        return failure(
          res,
          "AUTH_PROFILE_CREATE_ERROR",
          "Failed to create profile",
          500,
          { details: insertRes.error.message }
        );
      }

      profileData = insertRes.data;
      console.log("Profile created successfully:", profileData);
    }

    return success(
      res,
      existingProfile
        ? "AUTH_PROFILE_UPDATE_SUCCESS"
        : "AUTH_PROFILE_CREATE_SUCCESS",
      existingProfile
        ? "Profile updated successfully"
        : "Profile created successfully",
      {
        user: {
          id: userId,
          email: req.user.email,
          profile: profileData,
        },
      }
    );
  } catch (error) {
    console.error("Profile operation error:", error);
    return failure(res, "AUTH_INTERNAL_ERROR", "Internal server error", 500, {
      details: error.message,
    });
  }
};

// POST /api/v1/auth/register - Register with email & password
const register = async (req, res) => {
  try {
    const { error: validationError, value } = registerSchema.validate(req.body);
    if (validationError) {
      return failure(
        res,
        "AUTH_REGISTER_VALIDATION_ERROR",
        validationError.details[0].message,
        400
      );
    }

    const { email, password, full_name, phone } = value;

    console.log("=== REGISTRATION ATTEMPT ===");
    console.log("Email (normalized):", email);
    console.log("Full name:", full_name);
    console.log("Phone:", phone || "(not provided)");
    
    // Check if user already exists
    try {
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const userExists = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (userExists) {
        console.log("User already exists with this email");
        return failure(
          res,
          "AUTH_EMAIL_ALREADY_EXISTS",
          "Email sudah terdaftar. Silakan login atau gunakan email lain.",
          400
        );
      }
    } catch (checkErr) {
      console.warn("Error checking existing users (non-fatal):", checkErr.message);
    }

    // Register user with Supabase Auth
    const { data: authData, error: authError } = await supabaseAnon.auth.signUp(
      {
        email,
        password,
        options: {
          data: {
            full_name: full_name || null,
            phone: phone || null,
          },
        },
      }
    );

    if (authError) {
      console.error("Registration error:", authError);
      return failure(
        res,
        "AUTH_REGISTER_ERROR",
        "Failed to register user",
        400,
        { details: authError.message }
      );
    }

    console.log("Registration response:", {
      user: authData.user?.id,
      session: !!authData.session,
      user_metadata: authData.user?.user_metadata,
    });

    if (authData.user && authData.session) {
      console.log(
        "User created with immediate session (email confirmation disabled)"
      );

      // Attempt to fetch profile (trigger insertion race)
      let profileData = null;
      try {
        const { data, error } = await supabaseAnon
          .from("profiles")
          .select("*")
          .eq("id", authData.user.id)
          .maybeSingle();
        if (!error) profileData = data || null;
      } catch (e) {
        console.warn(
          "Profile fetch right after signup failed (ignored):",
          e?.message
        );
      }

      return success(
        res,
        profileData ? "AUTH_REGISTER_SUCCESS" : "AUTH_REGISTER_PROFILE_PENDING",
        profileData
          ? "Registration successful"
          : "Registration successful (profile provisioning in progress)",
        {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_at: authData.session.expires_at,
          user: {
            id: authData.user.id,
            email: authData.user.email,
            profile: profileData,
          },
        },
        201
      );
    }

    if (authData.user && !authData.session) {
      return success(
        res,
        "AUTH_REGISTER_NO_SESSION",
        "Registration successful but session not created. Please try logging in.",
        {
          user_id: authData.user.id,
          email: authData.user.email,
        },
        201
      );
    }

    return failure(
      res,
      "AUTH_REGISTER_UNEXPECTED_STATE",
      "Unexpected registration state",
      500
    );
  } catch (error) {
    console.error("Registration error:", error);
    return failure(
      res,
      "AUTH_INTERNAL_ERROR",
      "Internal server error during registration",
      500,
      { details: error.message }
    );
  }
};

// POST /api/v1/auth/login - Login with email or phone & password
const login = async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return failure(
        res,
        "AUTH_LOGIN_VALIDATION_ERROR",
        error.details[0].message,
        400
      );
    }

    const { identifier, password } = value;
    let email = identifier;

    console.log("=== LOGIN ATTEMPT ===");
    console.log("Identifier:", identifier);
    
    // Check if identifier is phone number (starts with 0, +62, or 62)
    const isPhoneNumber = /^(\+62|62|0)[0-9]{9,12}$/.test(identifier);
    
    if (isPhoneNumber) {
      console.log("Identifier is a phone number, looking up email...");
      
      // Normalize phone number (convert all formats to +62 format for comparison)
      let normalizedPhone = identifier;
      if (identifier.startsWith('0')) {
        normalizedPhone = '+62' + identifier.substring(1);
      } else if (identifier.startsWith('62')) {
        normalizedPhone = '+' + identifier;
      }
      
      // Also try original and other variants
      const phoneVariants = [
        identifier,
        normalizedPhone,
        identifier.startsWith('0') ? '62' + identifier.substring(1) : null,
        identifier.startsWith('0') ? '+62' + identifier.substring(1) : null,
        identifier.startsWith('+62') ? identifier.substring(1) : null,
        identifier.startsWith('+62') ? '0' + identifier.substring(3) : null,
        identifier.startsWith('62') && !identifier.startsWith('+') ? '0' + identifier.substring(2) : null,
      ].filter(Boolean);
      
      console.log("Phone variants to search:", phoneVariants);
      
      // Search for user with this phone number in profiles table
      const { data: profiles, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("email, phone")
        .in("phone", phoneVariants);
      
      if (profileError) {
        console.error("Error looking up phone number:", profileError);
        return failure(
          res,
          "AUTH_LOGIN_ERROR",
          "Terjadi kesalahan saat mencari nomor HP",
          500
        );
      }
      
      if (!profiles || profiles.length === 0) {
        console.log("No user found with phone number:", identifier);
        return failure(
          res,
          "AUTH_LOGIN_INVALID_CREDENTIALS",
          "Nomor HP tidak terdaftar. Pastikan nomor HP sudah terdaftar.",
          401
        );
      }
      
      // Use the email from the profile
      email = profiles[0].email;
      console.log("Found email for phone number:", email);
    } else {
      console.log("Identifier is an email");
      // Normalize email to lowercase
      email = identifier.toLowerCase();
    }
    
    console.log("Final email for login:", email);
    console.log("Email length:", email.length);
    console.log("Has whitespace:", email !== email.trim());
    
    const { data: authData, error: authError } =
      await supabaseAnon.auth.signInWithPassword({
        email,
        password,
      });

    if (authError) {
      console.error("=== LOGIN ERROR ===");
      console.error("Error code:", authError.code);
      console.error("Error message:", authError.message);
      console.error("Error status:", authError.status);
      
      // Check if email exists in auth.users
      try {
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const userExists = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
        console.log("User exists in auth.users:", !!userExists);
        if (userExists) {
          console.log("Existing user email:", userExists.email);
          console.log("Email confirmed:", !!userExists.email_confirmed_at);
        }
      } catch (checkErr) {
        console.error("Error checking user existence:", checkErr);
      }
      
      if (authError.message?.includes("Invalid login credentials")) {
        return failure(
          res,
          "AUTH_LOGIN_INVALID_CREDENTIALS",
          "Email atau password salah. Pastikan email sudah terdaftar dan password benar.",
          401
        );
      }
      if (authError.message?.includes("Email not confirmed")) {
        return failure(
          res,
          "AUTH_LOGIN_EMAIL_NOT_CONFIRMED",
          "Silakan konfirmasi email Anda terlebih dahulu",
          401
        );
      }
      return failure(res, "AUTH_LOGIN_ERROR", `Login gagal: ${authError.message}`, 500);
    }

    // Fetch profile with authenticated client first (RLS owner)
    let profileData = null;
    let rlsBlocked = false;
    try {
      const accessToken = authData.session?.access_token;
      if (accessToken) {
        const userClient = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_ANON_KEY,
          {
            global: { headers: { Authorization: `Bearer ${accessToken}` } },
            auth: { autoRefreshToken: false, persistSession: false },
          }
        );
        const { data: ownProfile, error: ownErr } = await userClient
          .from("profiles")
          .select("*")
          .eq("id", authData.user.id)
          .maybeSingle();
        if (ownErr) {
          rlsBlocked = true;
          console.info(
            "[LOGIN] profile fetch via authenticated client failed, fallback to admin:",
            ownErr.message
          );
        } else if (ownProfile) {
          console.info("[LOGIN] profile fetched via authenticated client");
          profileData = ownProfile;
        }
      }
    } catch (e) {
      console.warn(
        "[LOGIN] authenticated client profile fetch threw:",
        e?.message
      );
    }

    if (!profileData) {
      const { data: adminProfile, error: adminErr } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", authData.user.id)
        .maybeSingle();
      if (!adminErr && adminProfile) {
        console.info("[LOGIN] profile fetched via service role (fallback)");
        profileData = adminProfile;
      }
    }

    if (!profileData) {
      return success(
        res,
        "AUTH_LOGIN_PROFILE_PENDING",
        "Profile belum tersedia, silakan coba lagi sebentar",
        {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_at: authData.session.expires_at,
          user: {
            id: authData.user.id,
            email: authData.user.email,
            last_sign_in_at: authData.user.last_sign_in_at,
            profile: null,
          },
          hints: { possible_rls_issue: rlsBlocked || undefined },
        },
        202
      );
    }

    return success(res, "AUTH_LOGIN_SUCCESS", "Login successful", {
      access_token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
      expires_at: authData.session.expires_at,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        last_sign_in_at: authData.user.last_sign_in_at,
        profile: profileData,
      },
    });
  } catch (error) {
    console.error("Login controller error:\n", error);
    return failure(res, "AUTH_INTERNAL_ERROR", "Internal server error", 500);
  }
};

// POST /api/v1/auth/logout - Logout user
const logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return failure(res, "AUTH_UNAUTHORIZED", "Access token is required", 401);
    }

    const token = authHeader.substring(7);
    const { error } = await supabaseAnon.auth.admin.signOut(token);
    if (error) {
      console.error("Logout error:", error);
      return failure(res, "AUTH_LOGOUT_ERROR", "Failed to logout", 500);
    }

    return success(res, "AUTH_LOGOUT_SUCCESS", "Logout successful");
  } catch (error) {
    console.error("Logout controller error:", error);
    return failure(res, "AUTH_INTERNAL_ERROR", "Internal server error", 500);
  }
};

// GET /api/v1/auth/debug-users - Debug endpoint (non-production)
const debugUsers = async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production") {
      return failure(
        res,
        "AUTH_DEBUG_NOT_AVAILABLE",
        "Endpoint not available in production",
        404
      );
    }

    const { data: authUsers, error: authError } =
      await supabaseAdmin.auth.admin.listUsers();
    if (authError) {
      console.error("Error fetching auth users:", authError);
      return failure(
        res,
        "AUTH_DEBUG_AUTH_FETCH_ERROR",
        "Failed to fetch auth users",
        500
      );
    }

    const { data: profiles, error: profileError } = await supabaseAnon
      .from("profiles")
      .select("*");
    if (profileError) {
      console.error("Error fetching profiles:", profileError);
      return failure(
        res,
        "AUTH_DEBUG_PROFILE_FETCH_ERROR",
        "Failed to fetch profiles",
        500
      );
    }

    return success(res, "AUTH_DEBUG_SUCCESS", "Debug information", {
      auth_users:
        authUsers.users?.map((user) => ({
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          user_metadata: user.user_metadata,
        })) || [],
      profiles: profiles || [],
      summary: {
        total_auth_users: authUsers.users?.length || 0,
        total_profiles: profiles?.length || 0,
      },
    });
  } catch (error) {
    console.error("Debug users error:", error);
    return failure(res, "AUTH_INTERNAL_ERROR", "Internal server error", 500);
  }
};

// POST /api/v1/auth/create-missing-profile - Create profile if missing (owner or admin)
const createMissingProfile = async (req, res) => {
  try {
    const callerId = req.user?.id;
    const callerRole = req.profile?.role || "pengguna";
    if (!callerId) {
      return failure(res, "AUTH_UNAUTHORIZED", "Unauthorized", 401);
    }

    const { id: targetIdInput, full_name, phone, role } = req.body || {};
    const targetId = targetIdInput || callerId;
    const isOwner = targetId === callerId;
    const isAdmin = callerRole === "admin";
    if (!isOwner && !isAdmin) {
      return failure(
        res,
        "AUTH_PROFILE_FORBIDDEN",
        "Only owner or admin can create profile",
        403
      );
    }

    const { data: existing, error: exErr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", targetId)
      .maybeSingle();
    if (exErr) {
      return failure(res, "AUTH_PROFILE_FETCH_ERROR", exErr.message, 500);
    }
    if (existing?.id) {
      return success(
        res,
        "AUTH_PROFILE_ALREADY_EXISTS",
        "Profile already exists",
        existing
      );
    }

    const { data: authUserRes, error: getUserErr } =
      await supabaseAdmin.auth.admin.getUserById(targetId);
    if (getUserErr) {
      return failure(res, "AUTH_USER_FETCH_ERROR", getUserErr.message, 500);
    }

    const authUser = authUserRes?.user;
    const meta = authUser?.user_metadata || {};

    const now = new Date().toISOString();
    const upsertData = {
      id: targetId,
      full_name:
        full_name ||
        meta.full_name ||
        meta.name ||
        authUser?.email?.split("@")[0] ||
        "User",
      phone: phone ?? meta.phone ?? null,
      email: authUser?.email || req.user?.email || null,
      role: isAdmin && role ? role : "pengguna",
      created_at: now,
      updated_at: now,
    };

    let upsertRes = await supabaseAdmin
      .from("profiles")
      .upsert(upsertData, { onConflict: "id" })
      .select()
      .single();

    if (upsertRes.error && isMissingRoleColumn(upsertRes.error)) {
      console.warn(
        "[AUTH] profiles.role column missing, retrying upsert without role"
      );
      const { role: _role, ...noRole } = upsertData;
      upsertRes = await supabaseAdmin
        .from("profiles")
        .upsert(noRole, { onConflict: "id" })
        .select()
        .single();
    }

    if (upsertRes.error) {
      if (/duplicate key value/i.test(upsertRes.error.message)) {
        console.warn(
          "[AUTH] duplicate profiles insertion attempted for id:",
          targetId
        );
      }
      return failure(
        res,
        "AUTH_PROFILE_INSERT_ERROR",
        upsertRes.error.message,
        500
      );
    }

    return success(
      res,
      "AUTH_PROFILE_CREATE_SUCCESS",
      "Profile created successfully",
      upsertRes.data,
      201
    );
  } catch (error) {
    console.error("Create missing profile error:", error);
    return failure(res, "AUTH_INTERNAL_ERROR", "Internal server error", 500);
  }
};

// POST /api/v1/auth/refresh - Refresh session using refresh_token
async function refresh(req, res) {
  try {
    const refreshToken =
      req.body?.refresh_token || req.headers["x-refresh-token"]; // allow header fallback
    if (!refreshToken) {
      return failure(
        res,
        "AUTH_REFRESH_MISSING_TOKEN",
        "refresh_token is required",
        400
      );
    }
    const { data, error } = await supabaseAnon.auth.refreshSession({
      refresh_token: refreshToken,
    });
    if (error) {
      return failure(res, "AUTH_REFRESH_FAILED", error.message, 401);
    }
    return success(res, "AUTH_REFRESH_SUCCESS", "Session refreshed", {
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token || refreshToken,
      expires_at: data.session?.expires_at,
      user: data.user && { id: data.user.id, email: data.user.email },
    });
  } catch (e) {
    console.error("Refresh error:", e);
    return failure(res, "AUTH_INTERNAL_ERROR", "Internal server error", 500);
  }
}

module.exports = {
  createOrUpdateProfile,
  register,
  login,
  logout,
  debugUsers,
  createMissingProfile,
  refresh,
};
