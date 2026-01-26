import { defineConfig } from "prisma/config";
import { ENV } from "./src/config/env.js";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "",
  },
  datasource: {
    url: ENV.DATABASE_URL,
  },
});
