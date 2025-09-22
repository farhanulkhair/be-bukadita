const { supabase } = require("../lib/SupabaseClient");

const authMiddleware = async (req, res, next) => {
  try {
    console.log(
      "Auth middleware - Header received:",
      req.headers.authorization ? "Present" : "Missing"
    );

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: {
          message: "Authorization header missing or invalid",
          code: "UNAUTHORIZED",
        },
      });
    }

    const token = authHeader.substring(7);
    console.log("Auth middleware - Token extracted, length:", token.length);

    // Verify token with Supabase
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.log(
        "Auth middleware - Token verification failed:",
        error?.message
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

    // Set user in request
    req.user = user;

    // Skip profile check for specific endpoints that don't require profile
    const skipProfileEndpoints = [
      "create-missing-profile",
      "profile",
      "test-login",
      "debug-users",
    ];

    // Debug logging for endpoint checking
    console.log("Auth middleware - Checking endpoints for skip...");
    const shouldSkipProfileCheck = skipProfileEndpoints.some((endpoint) => {
      const pathCheck = req.path.includes(endpoint);
      const urlCheck = req.url.includes(endpoint);
      console.log(
        `Auth middleware - Endpoint '${endpoint}': path.includes=${pathCheck}, url.includes=${urlCheck}`
      );
      return pathCheck || urlCheck;
    });

    console.log(
      "Auth middleware - Should skip profile check:",
      shouldSkipProfileCheck
    );

    if (shouldSkipProfileCheck) {
      console.log("Auth middleware - Skipping profile check for:", req.path);
      return next();
    }

    // For other endpoints, check if profile exists
    console.log("Auth middleware - Fetching profile for user:", user.id);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.log("Auth middleware - Profile fetch error:", profileError);
      console.log("Auth middleware - Profile error code:", profileError.code);

      if (profileError.code === "PGRST116") {
        // Profile not found
        return res.status(404).json({
          error: {
            message:
              "User profile not found. Please complete your profile first.",
            code: "PROFILE_NOT_FOUND",
          },
        });
      }

      return res.status(500).json({
        error: {
          message: "Failed to fetch user profile",
          code: "PROFILE_FETCH_ERROR",
        },
      });
    }

    console.log("Auth middleware - Profile found:", profile.id, profile.role);
    req.user.profile = profile;

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({
      error: {
        message: "Authentication middleware error",
        code: "AUTH_MIDDLEWARE_ERROR",
      },
    });
  }
};

module.exports = authMiddleware;
