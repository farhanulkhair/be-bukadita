const { supabaseAnon } = require("../lib/SupabaseClient");
const { createClient } = require("@supabase/supabase-js");

const authMiddleware = async (req, res, next) => {
  try {
    console.log(
      "Auth middleware - Header received:",
      req.headers.authorization ? "Present" : "Missing"
    );

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: true,
        code: "UNAUTHORIZED",
        message: "Authorization header missing or invalid",
      });
    }

    const token = authHeader.substring(7);
    console.log("Auth middleware - Token extracted, length:", token.length);

    // Create per-request authenticated client (token in header enables RLS as the user)
    const userClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify token with the per-request client
    const {
      data: { user },
      error,
    } = await userClient.auth.getUser(token);

    if (error || !user) {
      console.log(
        "Auth middleware - Token verification failed:",
        error?.message
      );
      return res.status(401).json({
        error: true,
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
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

    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.log("Auth middleware - Profile fetch error:", profileError);
      if (profileError.code === "PGRST116") {
        return res.status(404).json({
          error: true,
          code: "PROFILE_NOT_FOUND",
          message:
            "User profile not found. Please complete your profile first.",
        });
      }
      return res.status(500).json({
        error: true,
        code: "PROFILE_FETCH_ERROR",
        message: "Failed to fetch user profile",
      });
    }

    console.log("Auth middleware - Profile found:", profile.id, profile.role);
    req.user.profile = profile;
    req.profile = profile; // ensure role-middleware can read role

    // Expose the authenticated client for downstream controllers
    req.authenticatedClient = userClient; // per-request client with user token
    req.supabase = userClient; // alias for controllers expecting req.supabase

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({
      error: true,
      code: "AUTH_MIDDLEWARE_ERROR",
      message: "Authentication middleware error",
    });
  }
};

module.exports = authMiddleware;
