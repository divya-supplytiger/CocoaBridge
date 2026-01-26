import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { ENV } from "./env.js";

const pool = new Pool({
  connectionString: ENV.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  log: ["error", "warn"], // add "query" only in dev if neededcls
  
  adapter,
});

export default prisma;