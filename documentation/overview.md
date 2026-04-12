# CocoaBridge — Overview

CocoaBridge is SupplyTiger's government procurement intelligence platform. It monitors federal contract databases (SAM.gov and USASpending.gov), scores incoming opportunities and awards against SupplyTiger's product profile, and surfaces the most relevant ones as work tickets — called **inbox items** — for the team to review and act on.

In short: the app watches the federal marketplace on SupplyTiger's behalf, filters out the noise, and presents only the opportunities worth pursuing.

---

## What Are Inbox Items?

An inbox item is the primary unit of work in the app. When an opportunity or award scores high enough against SupplyTiger's profile (based on NAICS codes, PSC codes, FLIS item matches, and keyword signals), it is automatically promoted into the inbox. Think of it as a work ticket that says "this federal opportunity is relevant to us — someone should look at it."

Each inbox item links back to the original opportunity or award and shows which signals triggered the match.

---

## App Structure

CocoaBridge is made up of three separate services that run together:

| Service | What it does | Local port |
|---|---|---|
| `backend/` | Express API — ingests data, scores opps, handles auth, serves the frontend in production | `5050` |
| `frontend/` | React app — the UI the team interacts with | `5173` |
| `mcp/` | MCP server — exposes DB data as structured tools for the AI chat feature | `3001` |

In production, the backend and frontend are deployed together on Vercel under `cocoabridge.vercel.app`. The MCP server is deployed separately at `cocoabridge-mcp.vercel.app`.

---

## Getting the App Running Locally

### Step 1 — Set up environment variables

Each of the three services needs its own `.env` file. Templates are in this folder:

| Template file | Copy to |
|---|---|
| `.env_backend_template` | `backend/.env` |
| `.env_frontend_template` | `frontend/.env` |
| `.env_mcp_template` | `mcp/.env` |

Copy each template, then fill in the blank values. The values you need are in the Vercel project's Environment Variables settings — ask John for Vercel access. Leave the pre-filled URLs and settings as-is.

### Step 2 — Install dependencies

Run `npm install` in each service folder:

```bash
cd backend && npm install
cd ../frontend && npm install
cd ../mcp && npm install
```

### Step 3 — Start each service

Open three terminal windows and run one command per window:

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev

# Terminal 3 — MCP server
cd mcp
npm run start
```

The frontend will be available at `http://localhost:5173`. The backend API runs at `http://localhost:5050`. The MCP server runs at `http://localhost:3001`.

---

## Notes

- The backend serves the built frontend in production (Vercel). Locally they run separately.
- Pushing to `main` on GitHub automatically triggers a Vercel deployment. See `github.md` for branching rules.
- For AI/chat features to work locally, the MCP server must also be running.
- If you hit issues getting set up, read through the other docs in this folder first.

Reach out to divyamalikverma@gmail.com if you have specific questions after reading all of this.
