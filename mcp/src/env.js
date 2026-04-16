import "dotenv/config";
import e from "express";

export const ENV = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || "development",
  MCP_SERVER_URL: process.env.MCP_SERVER_URL || `http://localhost:${process.env.PORT || 3001}`,
  MCP_SECRET: process.env.MCP_SECRET,
  // OAuth 2.0
  OAUTH_CLIENT_ID: process.env.OAUTH_CLIENT_ID,
  OAUTH_CLIENT_SECRET: process.env.OAUTH_CLIENT_SECRET,
  JWT_SECRET: process.env.JWT_SECRET,
};

export const REQUIRED_ENV_VARS = ["GEMINI_API_KEY", "DATABASE_URL", "MCP_SECRET", "MCP_SERVER_URL", "OAUTH_CLIENT_ID", "OAUTH_CLIENT_SECRET", "JWT_SECRET"];

const missing = REQUIRED_ENV_VARS.filter((key) => !ENV[key]);

if (missing.length) {
  throw new Error(
    `Missing required environment variables: ${missing.join(", ")}`,
  );
}
