import "dotenv/config";

export const ENV = {
  PORT: process.env.PORT || 5001,
  NODE_ENV: process.env.NODE_ENV,
  CLIENT_URL: process.env.CLIENT_URL,
  SAMGOV_BASE_URL: process.env.SAMGOV_BASE_URL,
  USASPENDING_BASE_URL: process.env.USASPENDING_BASE_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY,
  INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY,
  SAMGOV_API_KEY: process.env.SAMGOV_API_KEY,
  SAMGOV_NOTICE_DESC_URL: process.env.SAMGOV_NOTICE_DESC_URL,
  NEON_DB_API: process.env.NEON_DB_API,
  INNGEST_ID: process.env.INNGEST_ID,
  CLERK_JWKS_URL: process.env.CLERK_JWKS_URL,
  ADMIN_EMAILS: process.env.ADMIN_EMAILS
    ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase())
    : [],
};

const required = [
  "DATABASE_URL",
  "CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "INNGEST_EVENT_KEY",
  "INNGEST_SIGNING_KEY",
  "SAMGOV_API_KEY",
  "SAMGOV_NOTICE_DESC_URL",
  "NEON_DB_API",
  "CLIENT_URL",
  "INNGEST_ID",
];

const missing = required.filter((key) => !ENV[key]);

if (missing.length) {
  throw new Error(
    `Missing required environment variables: ${missing.join(", ")}`,
  );
}
