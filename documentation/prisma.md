# Prisma

CocoaBridge uses Prisma as its ORM (Object-Relational Mapper) to interact with the Neon PostgreSQL database. The schema is defined in `backend/prisma/schema.prisma`.

Both the backend and the MCP server use Prisma clients generated from this same schema file.

---

## Key Concepts

- **Schema** (`backend/prisma/schema.prisma`) — the single source of truth for all database models, enums, and relations
- **Migrations** (`backend/prisma/migrations/`) — auto-generated SQL files that track schema changes over time. Never edit these manually.
- **Prisma Client** — a type-safe query builder generated from the schema. Must be regenerated whenever the schema changes.
- **Dual schemas** — the database uses two PostgreSQL schemas (`public` and `chat`), enabled via the `multiSchema` preview feature. Each model has a `@@schema("public")` or `@@schema("chat")` annotation.

---

## Workflow for Schema Changes

Follow these steps in order every time you modify `backend/prisma/schema.prisma`:

```bash
# Step 1 — Format the schema file (catches syntax errors, enforces style)
cd backend
npx prisma format

# Step 2 — Validate the schema (checks for semantic errors like broken relations)
npx prisma validate

# Step 3 — Create a migration (generates a SQL migration file in prisma/migrations/)
# Use a short descriptive name for what changed
npx prisma migrate dev --name add-column-to-opportunity

# Step 4 — Apply migrations to the production database
npx prisma migrate deploy

# Step 5 — Regenerate the Prisma client for the backend
npx prisma generate

# Step 6 — Regenerate the Prisma client for the MCP server
cd ../mcp
npx prisma generate
```

**Important:** Always run `prisma generate` in both `backend/` and `mcp/` after a schema change. The MCP server will use stale types until its client is regenerated.

---

## One-Time Setup (Already Handled)

Both `backend/package.json` and `mcp/package.json` have a `postinstall` script that runs `prisma generate` automatically after `npm install`. So when you first clone the repo and run `npm install`, Prisma clients are generated for you.

---

## Useful Commands

```bash
# Open Prisma Studio — a visual browser for the database (great for debugging)
npx prisma studio

# Check which migrations have been applied to the DB
npx prisma migrate status

# Reset the local dev database (WARNING: deletes all data — dev only)
npx prisma migrate reset
```

---

## If a Migration Fails in Production

1. Check the `_prisma_migrations` table in the Neon database — failed migrations are recorded there with error messages
2. Do not re-run `migrate deploy` blindly — identify the root cause first
3. If the migration is partially applied, you may need to manually fix the DB state before retrying
4. Contact divyamalikverma@gmail.com if you have further questions.
