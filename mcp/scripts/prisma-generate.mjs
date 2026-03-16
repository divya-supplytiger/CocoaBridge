/**
 * Copies the backend Prisma schema into mcp/prisma/ with a local output path,
 * then runs `prisma generate`. This ensures the generated client lands in
 * mcp/node_modules/.prisma/client — works both locally and on Vercel where
 * ../backend/node_modules doesn't exist.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mcpRoot = resolve(__dirname, "..");
const backendSchema = resolve(mcpRoot, "../backend/prisma/schema.prisma");
const localSchemaDir = resolve(mcpRoot, "prisma");
const localSchema = resolve(localSchemaDir, "schema.prisma");

// Read backend schema
const schema = readFileSync(backendSchema, "utf8");

// Inject output directive so Prisma generates into mcp's node_modules
const patched = schema.replace(
  /generator client \{([^}]*)\}/s,
  (match, body) => {
    // Remove any existing (commented) output line
    const cleaned = body.replace(/.*output.*\n/g, "");
    return `generator client {${cleaned}  output = "../node_modules/.prisma/client"\n}`;
  }
);

mkdirSync(localSchemaDir, { recursive: true });
writeFileSync(localSchema, patched);

// Generate
execSync("npx prisma generate --schema prisma/schema.prisma", {
  cwd: mcpRoot,
  stdio: "inherit",
});
