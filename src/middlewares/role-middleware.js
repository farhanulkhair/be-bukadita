const requireRole = (requiredRole) => {
  return (req, res, next) => {
    try {
      const profile = req.profile || (req.user && req.user.profile);

      // Check if user is authenticated (should be set by auth middleware)
      if (!profile) {
        return res.status(401).json({
          error: true,
          code: "UNAUTHORIZED",
          message: "Authentication required",
        });
      }

      // Check if user has required role
      if (profile.role !== requiredRole) {
        return res.status(403).json({
          error: true,
          code: "FORBIDDEN",
          message: `Access denied. Required role: ${requiredRole}`,
        });
      }

      next();
    } catch (error) {
      console.error("Role middleware error:", error);
      return res.status(500).json({
        error: {
          message: "Internal server error during authorization",
          code: "INTERNAL_ERROR",
        },
      });
    }
  };
};

// Convenience middleware for admin-only routes (superadmin is also allowed)
const requireAdmin = (req, res, next) => {
  const profile = req.profile || (req.user && req.user.profile);
  if (!profile) {
    return res.status(401).json({
      error: true,
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }
  // Fallback: if profile.role missing, try app_metadata.role (useful in early bootstrap / tests)
  const effectiveRole = profile.role || req.user?.app_metadata?.role;
  if (effectiveRole === "admin" || effectiveRole === "superadmin")
    return next();
  return res.status(403).json({
    error: true,
    code: "FORBIDDEN",
    message: "Admin access required",
  });
};

// Strict superadmin-only middleware
const requireSuperadmin = requireRole("superadmin");

module.exports = {
  requireRole,
  requireAdmin,
  requireSuperadmin,
};
