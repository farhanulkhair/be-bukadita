const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

// Import routes
const authRoutes = require("./routes/auth-routes");
const penggunaRoutes = require("./routes/pengguna-routes");
const adminRoutes = require("./routes/admin-routes");

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://your-frontend-domain.com"] // Replace with actual frontend domain
        : ["http://localhost:3000", "http://localhost:5173"], // Common dev ports
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Request logging
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Bukadita Backend API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/pengguna", penggunaRoutes);
app.use("/api/admin", adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: "Route not found",
      code: "NOT_FOUND",
      path: req.originalUrl,
      method: req.method,
    },
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error("Global error handler:", error);

  // Handle Joi validation errors
  if (error.isJoi) {
    return res.status(400).json({
      error: {
        message: error.details[0].message,
        code: "VALIDATION_ERROR",
      },
    });
  }

  // Handle Supabase errors
  if (error.code && error.message) {
    return res.status(500).json({
      error: {
        message: "Database error occurred",
        code: "DATABASE_ERROR",
      },
    });
  }

  // Default error response
  res.status(500).json({
    error: {
      message:
        process.env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : error.message,
      code: "INTERNAL_ERROR",
    },
  });
});

module.exports = app;
