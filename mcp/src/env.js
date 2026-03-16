import "dotenv/config";
import e from "express";

export const ENV = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
};

export const REQUIRED_ENV_VARS = ["GEMINI_API_KEY", "DATABASE_URL"];

const missing = REQUIRED_ENV_VARS.filter((key) => !ENV[key]);

if (missing.length) {
  throw new Error(
    `Missing required environment variables: ${missing.join(", ")}`,
  );
}
