const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();
const supabaseClientMiddleware = require("./middlewares/supabase-middleware");

// V1 index router (aggregates individual resource routers)
const v1Index = require("./routes/v1/index");

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
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cache-Control",
      "Pragma",
      "Expires",
      "X-Requested-With",
    ],
  })
);

// Request logging
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Attach base Supabase clients early (anon + admin). Auth middleware will later inject user-scoped client.
app.use(supabaseClientMiddleware);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Bukadita Backend API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Mount aggregated v1 API surface
app.use("/api/v1", v1Index);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: true,
    code: "NOT_FOUND",
    message: "Route not found",
    path: req.originalUrl,
    method: req.method,
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error("Global error handler:", error);

  // Handle Joi validation errors
  if (error.isJoi) {
    return res.status(400).json({
      error: true,
      code: "VALIDATION_ERROR",
      message: error.details[0].message,
    });
  }

  // Handle Supabase errors
  if (error.code && error.message) {
    return res
      .status(500)
      .json({ error: true, code: "DB_ERROR", message: error.message });
  }

  // Default error response
  res.status(500).json({
    error: true,
    code: "INTERNAL_ERROR",
    message:
      process.env.NODE_ENV === "production"
        ? "An unexpected error occurred"
        : error.message,
  });
});

module.exports = app;
