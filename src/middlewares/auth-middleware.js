const { supabaseAnon, supabaseAdmin } = require("../lib/SupabaseClient");
const { createClient } = require("@supabase/supabase-js");

/**
 * Shared authentication logic
 * @param {Object} req - Express request object
 * @param {boolean} isRequired - Whether authentication is required (true) or optional (false)
 * @returns {Object} { success: boolean, user?, profile?, userClient?, error? }
 */
async function processAuth(req, isRequired = true) {
  const authHeader = req.headers.authorization;

  // No auth header
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    if (isRequired) {
      console.log("Auth - No token provided (required)");
      return { success: false, error: "NO_TOKEN" };
    } else {
      console.log("Auth - No token provided (optional, continuing)");
      return { success: true }; // Continue without auth for optional
    }
  }

  const token = authHeader.substring(7);
  console.log("Auth - Token extracted, length:", token.length);

  // Create per-request authenticated client
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

  // Verify token
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser(token);

  if (error || !user) {
    console.log("Auth - Token verification failed:", error?.message);
    if (isRequired) {
      return { success: false, error: "INVALID_TOKEN" };
    } else {
      // For optional auth, continue without user if token is invalid
      console.log("Auth - Invalid token (optional, continuing)");
      return { success: true };
    }
  }

  console.log("Auth - User verified:", user.id, user.email);

  // Skip profile check for specific endpoints
  const skipProfileEndpoints = [
    "create-missing-profile",
    "profile",
    "test-login",
    "debug-users",
  ];

  const shouldSkipProfileCheck = skipProfileEndpoints.some(
    (endpoint) => req.path.includes(endpoint) || req.url.includes(endpoint)
  );

  if (shouldSkipProfileCheck) {
    console.log("Auth - Skipping profile check for:", req.path);
    return { success: true, user, userClient };
  }

  // Fetch user profile using supabaseAdmin to avoid RLS issues
  const profileClient = supabaseAdmin || userClient;

  const { data: profile, error: profileError } = await profileClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.log("Auth - Profile fetch error:", profileError);
    if (isRequired) {
      if (profileError.code === "PGRST116") {
        return { success: false, error: "PROFILE_NOT_FOUND" };
      }
      return { success: false, error: "PROFILE_FETCH_ERROR" };
    } else {
      // For optional auth, continue without profile if fetch fails
      console.log("Auth - Profile fetch failed (optional, continuing)");
      return { success: true, user, userClient };
    }
  }

  console.log("Auth - Profile found:", profile.id, profile.role);
  return { success: true, user, profile, userClient };
}

/**
 * Required Authentication Middleware
 * Rejects requests without valid JWT token
 */
const authMiddleware = async (req, res, next) => {
  try {
    console.log(
      "Auth middleware (required) - Header:",
      req.headers.authorization ? "Present" : "Missing"
    );

    const result = await processAuth(req, true);

    if (!result.success) {
      switch (result.error) {
        case "NO_TOKEN":
          return res.status(401).json({
            error: true,
            code: "UNAUTHORIZED",
            message: "Authorization header missing or invalid",
          });
        case "INVALID_TOKEN":
          return res.status(401).json({
            error: true,
            code: "UNAUTHORIZED",
            message: "Invalid or expired token",
          });
        case "PROFILE_NOT_FOUND":
          return res.status(404).json({
            error: true,
            code: "PROFILE_NOT_FOUND",
            message:
              "User profile not found. Please complete your profile first.",
          });
        case "PROFILE_FETCH_ERROR":
          return res.status(500).json({
            error: true,
            code: "PROFILE_FETCH_ERROR",
            message: "Failed to fetch user profile",
          });
        default:
          return res.status(500).json({
            error: true,
            code: "AUTH_ERROR",
            message: "Authentication error",
          });
      }
    }

    // Set user and profile in request
    req.user = result.user;
    if (result.profile) {
      req.user.profile = result.profile;
      req.profile = result.profile;
    }

    // Set Supabase clients
    req.authenticatedClient = result.userClient;
    req.supabase = result.userClient;
    req.supabaseAnon = supabaseAnon;
    req.supabaseAdmin = supabaseAdmin;

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

/**
 * Optional Authentication Middleware
 * Allows requests without JWT token, but processes auth if token is present
 * Used for endpoints that work for both authenticated and anonymous users
 */
const optionalAuthMiddleware = async (req, res, next) => {
  try {
    console.log(
      "Auth middleware (optional) - Header:",
      req.headers.authorization ? "Present" : "Missing"
    );

    const result = await processAuth(req, false);

    // Set user and profile if authentication succeeded
    if (result.user) {
      req.user = result.user;
      if (result.profile) {
        req.user.profile = result.profile;
        req.profile = result.profile;
      }
    }

    // Set Supabase clients
    if (result.userClient) {
      req.authenticatedClient = result.userClient;
      req.supabase = result.userClient;
    } else {
      req.supabase = supabaseAnon;
    }
    req.supabaseAnon = supabaseAnon;
    req.supabaseAdmin = supabaseAdmin;

    next();
  } catch (error) {
    console.error("Optional auth middleware error:", error);
    // For optional auth, continue even on error
    req.supabase = supabaseAnon;
    req.supabaseAnon = supabaseAnon;
    req.supabaseAdmin = supabaseAdmin;
    next();
  }
};

module.exports = authMiddleware;
module.exports.optionalAuth = optionalAuthMiddleware;
