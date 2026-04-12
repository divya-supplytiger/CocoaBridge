# Maintenance

Recurring tasks to keep CocoaBridge running correctly. Do these proactively — most issues here are silent failures (data stops flowing, emails stop sending) that won't throw obvious errors in the UI.

---

## 1. Rotate the SAM.gov API Key (Every 90 Days)

**Why:** SAM.gov API keys expire after 90 days. When the key expires, all daily opportunity ingest stops — no new opportunities will be fetched or scored. The app will continue to appear functional but the data will silently go stale.

**How to get a new key:**
1. Go to [SAM.gov](https://sam.gov) → sign in → account settings → API keys
2. Generate a new key
3. Copy it

**How to update it:**
1. Go to the Vercel dashboard → CocoaBridge main project → Settings → Environment Variables
2. Find `SAMGOV_API_KEY` and update it with the new value
3. Redeploy: go to Deployments → select the latest deployment → Redeploy (or push any commit to `main` to trigger a fresh deploy)
4. Also update `SAMGOV_API_KEY` in your local `backend/.env` so local development doesn't break

**Tip:** Set a calendar reminder 85 days out so you don't get caught by the expiry.

---

## 2. Check Vercel Deployment Logs

**Why:** Failed deployments or runtime errors (DB connection failures, bad env vars, Inngest issues) show up in Vercel logs. If the app is behaving unexpectedly, this is the first place to look.

**Where:**
- Vercel dashboard → CocoaBridge project → Deployments → click the latest deployment → Functions tab
- For the MCP server: same flow in the MCP Vercel project

**What to look for:**
- HTTP 500 errors on API routes
- Database connection errors (usually indicates `DATABASE_URL` is wrong or Neon is down)
- Inngest signature verification failures (indicates `INNGEST_SIGNING_KEY` mismatch)
- Any stack traces from controllers

---

## 3. Monitor Inngest Job Status

**Why:** The daily Inngest cron jobs are what keep the data fresh. If a job fails silently, opportunities stop being synced, scoring stops running, or digest emails stop sending.

**Where:** Inngest dashboard → Functions (ask John for access)

**What to check:**
- All cron functions ran at their expected times
- No functions are showing a `Failed` status
- Failed runs include the full error message and stack trace — use this to diagnose

**Common causes of failure:**
- SAM.gov API key expired (see task 1)
- Neon DB hit its monthly quota
- A code change introduced a bug in a function handler

If a cron job failed and you need to re-run it, go to `/admin` in the app → Sync section → trigger the relevant sync manually.

---

## 4. Check the Admin Health Panel

**Why:** The fastest in-app way to verify the system is healthy without opening Vercel or Inngest.

**Where:** Log into the app → `/admin` → System Health tab

**What it shows:**
- Last successful sync times for each data source (SAM, USASpending)
- Total record counts for key tables
- Recent error logs from sync operations

Use this as a quick daily/weekly sanity check. If sync times are stale (more than 2 days old), something in the Inngest pipeline likely failed.

---

## 5. Ensure the DB Monthly Quota Isn't Hit

**Why:** Neon's free tier has a monthly data transfer and storage limit. Hitting the quota can cause DB connections to be refused, which breaks the entire app.

**Where:** Neon console (ask John for access) → project → Usage tab

**What to watch:**
- Storage approaching the limit → audit large tables: `OpportunityAttachment` (parsed text can be large), `ChatMessage` (auto-cleaned after 14 days but can accumulate)
- Data transfer approaching the limit → check if any runaway queries are hammering the DB

If nearing the limit, run a `cleanup db` job in the admin panel. Do this with caution, as this is a destructive job.

---

## 6. Ensure Vercel Has Permission to Access the GitHub Repo

**Why:** Vercel's auto-deploy on push to `main` requires GitHub authorization. If this permission lapses (e.g., after a GitHub org permission change), pushes to `main` will no longer trigger deployments.

**How to check:** Push a commit to `main` — if no deployment appears in the Vercel dashboard within ~1 minute, the connection is broken.

**How to fix:**
1. Vercel dashboard → CocoaBridge project → Settings → Git
2. Reconnect the GitHub repository
3. Re-authorize Vercel's GitHub app if prompted
