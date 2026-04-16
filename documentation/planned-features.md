# Planned Features

This doc lists features that are defined and ready to be built, or infrastructure tasks that are blocking existing features. If you pick up an item and need more context on scope or architecture, refer to Ryan, John, or Divya (divyamalikverma@gmail.com).

---

## High Priority

### MCP Server Migration (Render / Railway)

The MCP server (the AI data layer) is currently deployed on Vercel's serverless platform, which has a hard 10-second execution limit per request and cannot maintain persistent connections. This causes AI clients like ChatGPT to drop mid-session after a few tool calls.

Migrate the MCP server (`mcp/`) to a persistent Node process on Railway or Render. No code changes are needed — the server already runs as `node src/server.js`. This is purely a deployment config change.

**Unblocks:** stable ChatGPT integration, any future AI client connections (Cursor, Copilot, etc.)

---

### Gradient Descent Scoring Algorithm

The current opportunity scoring pipeline uses hardcoded signal weights (e.g. NAICS match = 2 pts, PSC match = 3 pts). These were set manually and never adapt based on which opportunities actually turned out to be good leads.

Build an ML weight optimizer using logistic regression that trains on labeled inbox items and saves updated weights to the database. The live scoring pipeline then reads from the trained model instead of hardcoded values.

**Two-part implementation:**
1. **Label bootstrapping** — Admin UI page (`/ml`) where Divya can mark existing inbox items as POSITIVE or NEGATIVE training examples. No labeled data = no training run.
2. **Training endpoint** — Background job that runs gradient descent and saves a new `ScoringModel` record. Previous model is deactivated but kept for history.

**Dependency:** Needs at least ~50 labeled inbox items before the first training run is meaningful. Start by labeling before writing the optimizer.

---

### Ollama / Local LLM Support

The chat widget currently supports only Google Gemini. Add Ollama as a second model provider so the team can run inference locally (faster, private, no API cost).

Target model: **Gemma 4** (or whichever model is currently available on the Ollama instance).

Ollama models appear in the existing model selector dropdown with a `(Local)` suffix. If `OLLAMA_BASE_URL` is not set, Ollama is silently skipped — Gemini continues to work as normal.

**Dependency:** Requires an Ollama instance running locally or on a server with `OLLAMA_BASE_URL` set in the backend `.env`.

---

## Medium Priority

### Resend Domain Verification (Daily Digest)

The daily digest email is fully built and running on a Mon–Fri cron schedule. It is currently only sending to a test address (`RESEND_TEST_TO` env var) because the sending domain has not been verified with Resend.

To enable sending to all team members:
1. Verify the sending domain in the Resend dashboard
2. Remove or unset `RESEND_TEST_TO` from the Vercel environment variables
3. Confirm `RESEND_FROM` is set to an address on the verified domain

**Note:** Before removing `RESEND_TEST_TO`, confirm it is not set in the Vercel production environment — if it is, all digest emails currently route to that address regardless of the recipient's actual email.

---

## Known Issues

### Daily Digest — `RESEND_TEST_TO` override in production

**File:** `backend/src/lib/digestEmail.js:171`

```js
const to = process.env.RESEND_TEST_TO ?? user.email;
```

If `RESEND_TEST_TO` is set in the Vercel production environment, every digest email — for every user — is sent to that single address instead of the actual recipient. Check Vercel → backend project → Environment Variables and confirm this var is either absent or empty in production before the digest goes live for the team.