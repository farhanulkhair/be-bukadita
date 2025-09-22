const { supabase, supabaseAdmin } = require("../lib/SupabaseClient");
const Joi = require("joi");

// Validation schemas
const profileSchema = Joi.object({
  full_name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Full name must be at least 2 characters long',
    'string.max': 'Full name must not exceed 100 characters',
    'any.required': 'Full name is required'
  }),
  phone: Joi.string()
    .pattern(/^(\+62[8-9][\d]{8,11}|0[8-9][\d]{8,11})$/)
    .optional()
    .messages({
      'string.pattern.base': 'Phone number must start with 08 and be 10-13 digits long (e.g., 08123456789)'
    }),
  role: Joi.string().valid('pengguna', 'admin').optional()
});

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  full_name: Joi.string().trim().min(2).max(100).required(),
  phone: Joi.string()
    .trim()
    .pattern(/^(\+62[8-9][\d]{8,11}|0[8-9][\d]{8,11})$/)
    .optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

const createOrUpdateProfile = async (req, res) => {
  try {
    const { error: validationError, value } = profileSchema.validate(req.body);
    if (validationError) {
      return res.status(400).json({
        error: {
          message: "Validation error", 
          code: "VALIDATION_ERROR",
          details: validationError.details[0].message,
        },
      });
    }

    const { full_name, phone } = value;
    const userId = req.user.id;

    console.log("=== PROFILE CREATE/UPDATE START ===");
    console.log("User ID:", userId);
    console.log("User Email:", req.user.email);
    console.log("Profile data:", { full_name, phone });

    // Check if profile already exists
    const { data: existingProfile, error: checkError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error("Error checking existing profile:", checkError);
      return res.status(500).json({
        error: {
          message: "Failed to check existing profile",
          code: "CHECK_ERROR",
          details: checkError.message,
        },
      });
    }

    let profileData;
    
    if (existingProfile) {
      console.log("Profile exists, updating...");
      // Update existing profile
      const { data, error } = await supabase
        .from("profiles")
        .update({
          full_name,
          phone,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .select()
        .single();

      if (error) {
        console.error("Profile update error:", error);
        return res.status(500).json({
          error: {
            message: "Failed to update profile",
            code: "UPDATE_ERROR",
            details: error.message,
          },
        });
      }

      profileData = data;
      console.log("Profile updated successfully:", profileData);
    } else {
      console.log("Profile doesn't exist, creating new profile...");
      // Create new profile
      const { data, error } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          full_name,
          phone,
          role: "pengguna",
        })
        .select()
        .single();

      if (error) {
        console.error("Profile creation error:", error);
        return res.status(500).json({
          error: {
            message: "Failed to create profile",
            code: "CREATE_ERROR",
            details: error.message,
          },
        });
      }

      profileData = data;
      console.log("Profile created successfully:", profileData);
    }

    return res.status(200).json({
      message: existingProfile ? "Profile updated successfully" : "Profile created successfully",
      data: {
        user: {
          id: userId,
          email: req.user.email,
          profile: profileData,
        },
      },
    });

  } catch (error) {
    console.error("Profile operation error:", error);
    return res.status(500).json({
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
        details: error.message,
      },
    });
  }
};

// POST /api/auth/register - Register with email & password
const register = async (req, res) => {
  try {
    const { error: validationError, value } = registerSchema.validate(req.body);
    if (validationError) {
      return res.status(400).json({
        error: {
          message: "Validation error",
          code: "VALIDATION_ERROR",
          details: validationError.details[0].message,
        },
      });
    }

    const { email, password, full_name, phone } = value;

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: {
          message: "Invalid email format",
          code: "INVALID_EMAIL",
        },
      });
    }

    console.log("Attempting to register user:", { email, full_name, phone });

    // Register user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          phone,
        },
      },
    });

    if (authError) {
      console.error("Registration error:", authError);
      return res.status(400).json({
        error: {
          message: "Failed to register user",
          code: "REGISTER_ERROR",
          details: authError.message,
        },
      });
    }

    console.log("Registration response:", {
      user: authData.user?.id,
      session: !!authData.session,
      email_confirmed: authData.user?.email_confirmed_at,
    });

    // Since email confirmation is disabled, user should have session immediately
    if (authData.user && authData.session) {
      console.log("User created with immediate session (email confirmation disabled)");

      // Create profile for the new user
      try {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .insert({
            id: authData.user.id,
            full_name,
            phone,
            role: "pengguna",
          })
          .select()
          .single();

        if (profileError) {
          console.error("Profile creation error:", profileError);
          // Don't fail registration if profile creation fails
          // User can create profile later via create-missing-profile endpoint
        } else {
          console.log("Profile created successfully:", profileData);
        }

        return res.status(201).json({
          message: "Registration successful",
          data: {
            access_token: authData.session.access_token,
            refresh_token: authData.session.refresh_token,
            expires_at: authData.session.expires_at,
            user: {
              id: authData.user.id,
              email: authData.user.email,
              profile: profileData || null,
            },
          },
        });
      } catch (error) {
        console.error("Error during profile creation:", error);
        // Still return success response even if profile creation fails
        return res.status(201).json({
          message: "Registration successful (profile creation pending)",
          data: {
            access_token: authData.session.access_token,
            refresh_token: authData.session.refresh_token,
            expires_at: authData.session.expires_at,
            user: {
              id: authData.user.id,
              email: authData.user.email,
              profile: null,
            },
          },
        });
      }
    }

    // This should not happen when email confirmation is disabled
    // But keeping as fallback
    if (authData.user && !authData.session) {
      console.log("User created but no session - unexpected with email confirmation disabled");
      return res.status(201).json({
        message: "Registration successful but session not created. Please try logging in.",
        data: {
          user_id: authData.user.id,
          email: authData.user.email,
        },
      });
    }

    // Should never reach here
    return res.status(500).json({
      error: {
        message: "Unexpected registration state",
        code: "UNEXPECTED_STATE",
      },
    });

  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      error: {
        message: "Internal server error during registration",
        code: "INTERNAL_ERROR",
        details: error.message,
      },
    });
  }
};

// POST /api/auth/login - Login with email & password
const login = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          message: error.details[0].message,
          code: "VALIDATION_ERROR",
        },
      });
    }

    const { email, password } = value;

    // Sign in with Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError) {
      console.error("Login error:", authError);

      if (authError.message.includes("Invalid login credentials")) {
        return res.status(401).json({
          error: {
            message: "Invalid email or password",
            code: "INVALID_CREDENTIALS",
          },
        });
      }

      if (authError.message.includes("Email not confirmed")) {
        return res.status(401).json({
          error: {
            message: "Please confirm your email before logging in",
            code: "EMAIL_NOT_CONFIRMED",
          },
        });
      }

      return res.status(500).json({
        error: {
          message: "Failed to login",
          code: "LOGIN_ERROR",
        },
      });
    }

    // Get user profile
    let { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authData.user.id)
      .single();

    // If profile doesn't exist, create one
    if (profileError && profileError.code === "PGRST116") {
      console.log("Profile not found, creating one for existing user");

      const { data: newProfileData, error: createError } = await supabase
        .from("profiles")
        .insert({
          id: authData.user.id,
          full_name:
            authData.user.user_metadata?.full_name ||
            authData.user.email.split("@")[0],
          phone: null,
          role: "pengguna",
        })
        .select()
        .single();

      if (createError) {
        console.error("Failed to create profile on login:", createError);
        profileData = null;
      } else {
        console.log("Profile created on login:", newProfileData);
        profileData = newProfileData;
      }
    } else if (profileError) {
      console.error("Profile fetch error:", profileError);
      profileData = null;
    }

    res.status(200).json({
      message: "Login successful",
      data: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_at: authData.session.expires_at,
        user: {
          id: authData.user.id,
          email: authData.user.email,
          email_confirmed_at: authData.user.email_confirmed_at,
          profile: profileData,
        },
      },
    });
  } catch (error) {
    console.error("Login controller error:", error);
    res.status(500).json({
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
    });
  }
};

// POST /api/auth/logout - Logout user
const logout = async (req, res) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: {
          message: "Access token is required",
          code: "UNAUTHORIZED",
        },
      });
    }

    const token = authHeader.substring(7);

    // Sign out from Supabase
    const { error } = await supabase.auth.admin.signOut(token);

    if (error) {
      console.error("Logout error:", error);
      return res.status(500).json({
        error: {
          message: "Failed to logout",
          code: "LOGOUT_ERROR",
        },
      });
    }

    res.status(200).json({
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout controller error:", error);
    res.status(500).json({
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
    });
  }
};

// GET /api/auth/debug-users - Debug endpoint to check users and profiles
const debugUsers = async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({
        error: {
          message: "Endpoint not available in production",
          code: "NOT_AVAILABLE",
        },
      });
    }

    // Get all users from Supabase auth (requires service role)
    const { data: authUsers, error: authError } =
      await supabaseAdmin.auth.admin.listUsers();

    if (authError) {
      console.error("Error fetching auth users:", authError);
      return res.status(500).json({
        error: {
          message: "Failed to fetch auth users",
          code: "AUTH_FETCH_ERROR",
        },
      });
    }

    // Get all profiles
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("*");

    if (profileError) {
      console.error("Error fetching profiles:", profileError);
      return res.status(500).json({
        error: {
          message: "Failed to fetch profiles",
          code: "PROFILE_FETCH_ERROR",
        },
      });
    }

    res.status(200).json({
      message: "Debug information",
      data: {
        auth_users:
          authUsers.users?.map((user) => ({
            id: user.id,
            email: user.email,
            created_at: user.created_at,
            email_confirmed_at: user.email_confirmed_at,
            user_metadata: user.user_metadata,
          })) || [],
        profiles: profiles || [],
        summary: {
          total_auth_users: authUsers.users?.length || 0,
          total_profiles: profiles?.length || 0,
        },
      },
    });
  } catch (error) {
    console.error("Debug users error:", error);
    res.status(500).json({
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
    });
  }
};

// POST /api/auth/create-missing-profile - Create profile for authenticated user if missing
const createMissingProfile = async (req, res) => {
  try {
    const userId = req.user.id; // From auth middleware
    const { full_name, phone } = req.body;

    console.log("Creating missing profile for user:", userId);

    // Get the user's token from request header
    const authHeader = req.headers.authorization;
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Create authenticated supabase client with user token
    const { createClient } = require("@supabase/supabase-js");
    const userSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Set the user session
    await userSupabase.auth.setSession({
      access_token: token,
      refresh_token: "", // Not needed for this operation
    });

    console.log("Checking if profile already exists...");

    // Check if profile already exists (using authenticated client)
    const { data: existingProfile, error: checkError } = await userSupabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (existingProfile) {
      console.log("Profile already exists:", existingProfile);
      return res.status(200).json({
        message: "Profile already exists",
        data: existingProfile,
      });
    }

    if (checkError && checkError.code !== "PGRST116") {
      console.error("Error checking existing profile:", checkError);
      return res.status(500).json({
        error: {
          message: "Failed to check existing profile",
          code: "CHECK_ERROR",
          details: checkError.message,
        },
      });
    }

    console.log("Profile not found, creating new profile...");

    // Create profile using authenticated client
    const { data: profileData, error: profileError } = await userSupabase
      .from("profiles")
      .insert({
        id: userId,
        full_name: full_name || req.user.email?.split("@")[0] || "User",
        phone: phone || null,
        role: "pengguna",
      })
      .select()
      .single();

    if (profileError) {
      console.error("Profile creation error:", profileError);
      return res.status(500).json({
        error: {
          message: "Failed to create profile",
          code: "CREATION_ERROR",
          details: profileError.message,
        },
      });
    }

    console.log("Profile created successfully:", profileData);

    res.status(201).json({
      message: "Profile created successfully",
      data: profileData,
    });
  } catch (error) {
    console.error("Create missing profile error:", error);
    res.status(500).json({
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
    });
  }
};

module.exports = {
  createOrUpdateProfile,
  register,
  login,
  logout,
  debugUsers,
  createMissingProfile,
};
