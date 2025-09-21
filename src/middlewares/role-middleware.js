const requireRole = (requiredRole) => {
  return (req, res, next) => {
    try {
      // Check if user is authenticated (should be set by auth middleware)
      if (!req.profile) {
        return res.status(401).json({
          error: {
            message: "Authentication required",
            code: "UNAUTHORIZED",
          },
        });
      }

      // Check if user has required role
      if (req.profile.role !== requiredRole) {
        return res.status(403).json({
          error: {
            message: `Access denied. Required role: ${requiredRole}`,
            code: "FORBIDDEN",
          },
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

// Convenience middleware for admin-only routes
const requireAdmin = requireRole("admin");

module.exports = {
  requireRole,
  requireAdmin,
};
