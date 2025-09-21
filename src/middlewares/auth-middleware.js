const { supabase } = require("../lib/SupabaseClient");

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    console.log(
      "Auth middleware - Header received:",
      authHeader ? "Present" : "Missing"
    );

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("Auth middleware - Invalid header format");
      return res.status(401).json({
        error: {
          message: "Access token is required",
          code: "UNAUTHORIZED",
        },
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log("Auth middleware - Token extracted, length:", token.length);

    // Verify token with Supabase
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error(
        "Auth middleware - Token verification failed:",
        error?.message || "User not found"
      );
      return res.status(401).json({
        error: {
          message: "Invalid or expired token",
          code: "UNAUTHORIZED",
        },
      });
    }

    console.log("Auth middleware - User verified:", user.id, user.email);
    console.log("Auth middleware - Request path:", req.path);
    console.log("Auth middleware - Request URL:", req.url);

    // For create-missing-profile endpoint, we don't require existing profile
    if (
      req.path.includes("create-missing-profile") ||
      req.url.includes("create-missing-profile")
    ) {
      console.log(
        "Auth middleware - Skipping profile check for create-missing-profile"
      );
      req.user = user;
      req.profile = null;
      return next();
    }

    console.log("Auth middleware - Fetching profile for user:", user.id);

    // Get user profile from profiles table
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Auth middleware - Profile fetch error:", profileError);
      console.error("Auth middleware - Profile error code:", profileError.code);

      // If profile not found (PGRST116), return specific error
      if (profileError.code === "PGRST116") {
        return res.status(404).json({
          error: {
            message:
              "User profile not found. Please create your profile first.",
            code: "PROFILE_NOT_FOUND",
            suggestion:
              "Use /api/auth/create-missing-profile endpoint to create your profile.",
          },
        });
      }

      return res.status(401).json({
        error: {
          message: "User profile not found",
          code: "PROFILE_NOT_FOUND",
        },
      });
    }

    console.log(
      "Auth middleware - Profile found:",
      profile.id,
      profile.full_name
    );

    // Attach user and profile to request
    req.user = user;
    req.profile = profile;

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({
      error: {
        message: "Internal server error during authentication",
        code: "INTERNAL_ERROR",
      },
    });
  }
};

module.exports = authMiddleware;
