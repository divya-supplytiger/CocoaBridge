import "dotenv/config";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

// Resolve the generated Prisma client from the backend's node_modules.
// prisma generate outputs to backend/node_modules/@prisma/client (nearest
// node_modules to the schema file). We dynamically import from there.
const require = createRequire(import.meta.url);
const clientPath = require.resolve("../../backend/node_modules/@prisma/client");
const { PrismaClient } = await import(pathToFileURL(clientPath).href);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  log: ["error", "warn"],
  errorFormat: "minimal",
  adapter,
});

export default prisma;
