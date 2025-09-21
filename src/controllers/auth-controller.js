const { supabase, supabaseAdmin } = require("../lib/SupabaseClient");
const Joi = require("joi");

// Validation schemas
const profileSchema = Joi.object({
  full_name: Joi.string().trim().min(2).max(100).required(),
  phone: Joi.string()
    .trim()
    .pattern(/^[\+]?[1-9][\d]{0,15}$/)
    .optional(),
  role: Joi.string().valid("pengguna", "admin").default("pengguna"),
});

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  full_name: Joi.string().trim().min(2).max(100).required(),
  phone: Joi.string()
    .trim()
    .pattern(/^[\+]?[1-9][\d]{0,15}$/)
    .optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

const createOrUpdateProfile = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = profileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          message: error.details[0].message,
          code: "VALIDATION_ERROR",
        },
      });
    }

    const { full_name, phone, role = "pengguna" } = value;
    const userId = req.user.id;

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    let result;

    if (existingProfile) {
      // Update existing profile
      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name,
          phone,
          role: existingProfile.role, // Don't allow role change via this endpoint unless user is admin
        })
        .eq("id", userId)
        .select()
        .single();

      if (updateError) {
        console.error("Profile update error:", updateError);
        return res.status(500).json({
          error: {
            message: "Failed to update profile",
            code: "UPDATE_ERROR",
          },
        });
      }

      result = data;
    } else {
      // Create new profile
      const { data, error: insertError } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          full_name,
          phone,
          role,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Profile creation error:", insertError);
        return res.status(500).json({
          error: {
            message: "Failed to create profile",
            code: "CREATION_ERROR",
          },
        });
      }

      result = data;
    }

    res.status(200).json({
      message: existingProfile
        ? "Profile updated successfully"
        : "Profile created successfully",
      data: result,
    });
  } catch (error) {
    console.error("Auth controller error:", error);
    res.status(500).json({
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
    });
  }
};

// ⚠️ TEMPORARY ENDPOINT FOR TESTING ONLY - REMOVE IN PRODUCTION
// POST /api/auth/test-login - Generate temporary user for testing
const testLogin = async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({
        error: {
          message: "Endpoint not available in production",
          code: "NOT_AVAILABLE",
        },
      });
    }

    const { email, password = "testpassword123" } = req.body;

    if (!email) {
      return res.status(400).json({
        error: {
          message: "Email is required",
          code: "VALIDATION_ERROR",
        },
      });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({
        error: {
          message: "Service role key not configured",
          code: "CONFIG_ERROR",
        },
      });
    }

    // Create or get user using admin client
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError && authError.message !== "User already registered") {
      console.error("Test user creation error:", authError);
      return res.status(500).json({
        error: {
          message: "Failed to create test user",
          code: "CREATION_ERROR",
        },
      });
    }

    // Generate access token
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (signInError) {
      console.error("Test sign in error:", signInError);
      return res.status(500).json({
        error: {
          message: "Failed to sign in test user",
          code: "SIGNIN_ERROR",
        },
      });
    }

    res.status(200).json({
      message: "Test user created/signed in successfully",
      data: {
        access_token: signInData.session.access_token,
        user: signInData.user,
        note: '⚠️ This is for testing only. Use this token in Authorization header as "Bearer <token>"',
      },
    });
  } catch (error) {
    console.error("Test login error:", error);
    res.status(500).json({
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
    });
  }
};

// POST /api/auth/register - Register with email & password
const register = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          message: error.details[0].message,
          code: "VALIDATION_ERROR",
        },
      });
    }

    const { email, password, full_name, phone } = value;

    // Additional email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: {
          message: "Please provide a valid email address",
          code: "INVALID_EMAIL_FORMAT",
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
          full_name, // This will be accessible in user metadata
        },
      },
    });

    if (authError) {
      console.error("Register error:", authError);

      // Handle specific Supabase errors
      if (authError.code === "email_address_invalid") {
        return res.status(400).json({
          error: {
            message:
              "The email address format is invalid. Please check and try again.",
            code: "INVALID_EMAIL_FORMAT",
            details: authError.message,
          },
        });
      }

      if (
        authError.message.includes("User already registered") ||
        authError.code === "user_already_exists"
      ) {
        return res.status(400).json({
          error: {
            message: "Email already registered",
            code: "EMAIL_EXISTS",
          },
        });
      }

      if (authError.code === "signup_disabled") {
        return res.status(400).json({
          error: {
            message: "Registration is currently disabled",
            code: "SIGNUP_DISABLED",
          },
        });
      }

      if (authError.code === "weak_password") {
        return res.status(400).json({
          error: {
            message: "Password is too weak. Please use a stronger password.",
            code: "WEAK_PASSWORD",
          },
        });
      }

      // Generic error
      return res.status(500).json({
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
    });

    // If user is created but not confirmed, return appropriate message
    if (authData.user && !authData.session) {
      console.log("User created but email confirmation required");

      // Still try to create profile for unconfirmed users
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
          console.error(
            "Profile creation error for unconfirmed user:",
            profileError
          );
        } else {
          console.log("Profile created for unconfirmed user:", profileData);
        }
      } catch (error) {
        console.error("Error creating profile for unconfirmed user:", error);
      }

      return res.status(201).json({
        message:
          "Registration successful. Please check your email to confirm your account.",
        data: {
          user_id: authData.user.id,
          email: authData.user.email,
          confirmation_sent: true,
        },
      });
    }

    // If user is created and session exists (email confirmation disabled)
    if (authData.user && authData.session) {
      console.log("User created with session, creating profile...");

      // Create profile
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
        // Return success for user creation but note profile error
        return res.status(201).json({
          message: "Registration successful, but profile creation failed",
          data: {
            access_token: authData.session.access_token,
            refresh_token: authData.session.refresh_token,
            user: {
              id: authData.user.id,
              email: authData.user.email,
              profile: null,
            },
          },
          warning:
            "Profile was not created due to database error. Please contact support.",
        });
      }

      console.log("Profile created successfully:", profileData);

      return res.status(201).json({
        message: "Registration successful",
        data: {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          user: {
            id: authData.user.id,
            email: authData.user.email,
            profile: profileData,
          },
        },
      });
    }

    // Fallback response
    res.status(201).json({
      message: "Registration initiated",
      data: {
        user_id: authData.user?.id,
        email: authData.user?.email,
      },
    });
  } catch (error) {
    console.error("Register controller error:", error);
    res.status(500).json({
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
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
  testLogin,
  register,
  login,
  logout,
  debugUsers,
  createMissingProfile,
};
