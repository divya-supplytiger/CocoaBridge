# External Services

CocoaBridge integrates with the following external services. For console/dashboard access, ask John.

---

## Neon — Database

**What it does:** Managed PostgreSQL cloud database. This is where all of CocoaBridge's data lives.

The database has two schemas:
- `public` — all procurement data (opportunities, awards, inbox items, contacts, buying orgs, FLIS items, etc.)
- `chat` — AI conversation history (14-day retention, auto-cleaned by Inngest)

**Relevant env var:** `DATABASE_URL`

**Notes:** Neon has a monthly data transfer/storage quota. Monitor usage in the Neon console and flag if approaching the limit (see `maintenance.md`).

---

## Clerk — Authentication

**What it does:** Handles all user authentication (login, signup, session management). CocoaBridge does not store passwords — Clerk owns the auth layer.

When a user signs up, is updated, or is deleted in Clerk, a webhook fires to Inngest, which syncs the change to the CocoaBridge database (`User` table). This keeps the app's user records in sync with Clerk automatically.

**Relevant env vars:**
- `CLERK_SECRET_KEY` (backend)
- `CLERK_PUBLISHABLE_KEY` (backend)
- `VITE_CLERK_PUBLISHABLE_KEY` (frontend)
- `CLERK_JWKS_URL` (backend — for token verification)

**Notes:** User roles (ADMIN, READ_ONLY, USER) are managed in the CocoaBridge database, not in Clerk. An admin promotes users from the `/admin` panel.

---

## Inngest — Background Jobs

**What it does:** Orchestrates all background and scheduled work — daily data syncs from SAM.gov and USASpending, opportunity scoring, email digest sending, and cleanup tasks.

CocoaBridge has 18 Inngest functions (see `architecture.md` for the full list). They are split into:
- **Cron functions** — run on a schedule automatically
- **Event-driven functions** — triggered by internal app events (e.g., a new opportunity being upserted fires a scoring event)

All cron functions can also be triggered manually from the `/admin` panel without waiting for the scheduled time — useful for testing or catching up after an outage.

**Relevant env vars:**
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`
- `INNGEST_ID`

**Notes:** Check the Inngest dashboard for function run history and failure details. Failed runs will show up there with error messages and stack traces.

---

## Resend — Email

**What it does:** Sends transactional emails. Currently used for one purpose: the daily procurement digest email.

The digest is sent Monday–Friday at 8:00 AM EST to `cocoabridge@supplytiger.com`. It summarizes recent inbox items and opportunities using a Gemini-generated narrative.
Currently, the emails are sent from `onboarding@resend.dev`, eventually we'll want to verify our own domain with Vercel to enable sending emails to everyone with the `READ_ONLY` or `ADMIN` role who have `digestEnabled` turned on. 

**Relevant env vars:**
- `RESEND_API_KEY`
- `RESEND_FROM` — the sender address
- `RESEND_TEST_TO` — override recipient for testing

---

## SAM.gov API — Federal Opportunity Data

**What it does:** The primary data source for federal contracting opportunities. CocoaBridge calls the SAM.gov API daily to pull current opportunities, descriptions, attachment metadata, and industry day notices.

**Important:** The SAM.gov API key expires every 90 days. If the key is not rotated, all daily opportunity ingest stops silently. See `maintenance.md` for the rotation steps.

**Relevant env vars:**
- `SAMGOV_API_KEY` — main opportunities API (rotate every 90 days)
- `SAMGOV_BASE_URL` — `https://api.sam.gov/opportunities/v2/search`
- `SAMGOV_NOTICE_DESC_URL` — for fetching opportunity descriptions
- `SAMGOV_RESOURCES_URL` — for fetching attachment metadata

---

## USASpending.gov API — Federal Award Data

**What it does:** Provides federal contract award data — who got the contract, how much, from which agency, for what. CocoaBridge syncs awards every 3 days.

**No API key required** — USASpending is a public API.

**Relevant env var:** `USASPENDING_BASE_URL` — `https://api.usaspending.gov`

---

## Gemini (Google AI) — Language Model

**What it does:** Powers the AI features in CocoaBridge:
1. **Chat backend** — the `/api/chat` route uses Gemini to generate responses, calling MCP tools to pull live DB data into the context
2. **Daily digest narrative** — Gemini writes the prose summary of recent procurement activity included in the digest email

The frontend chat client is model-agnostic. Gemini is the default, but OpenAI, Claude (Anthropic), or a local Ollama model can be substituted by changing the model configuration.

**Relevant env var:** `GEMINI_API_KEY`

---

## Vercel — Hosting

**What it does:** Hosts the application in production.

Two separate Vercel projects:
1. **Main app** (`cocoabridge.vercel.app`) — deploys both the backend (Node.js serverless) and the built frontend (static). Defined by `vercel.json` in the repo root.
2. **MCP server** (`cocoabridge-mcp.vercel.app`) — deploys the MCP server independently. Defined by `mcp/vercel.json`.

Both projects are connected to the GitHub repo. Pushing to `main` triggers an automatic redeploy of both.

**Notes:**
- Environment variables for each service are set in the Vercel project settings (not in `.env` files in the repo)
- Vercel must have permission to access the GitHub repo for auto-deploys to work — verify this in Vercel project settings if deploys stop triggering (see `maintenance.md`)
- Deployment logs are available in the Vercel dashboard under each project's Deployments tab
