# Architecture

## System Overview

CocoaBridge has three services. In production they talk to the same Neon PostgreSQL database:

```
[SAM.gov API]          [USASpending.gov API]
      |                        |
      └────────┬───────────────┘
               ▼
        [Backend / Express]  ──────────────────→  [Neon PostgreSQL]
               |                                         ▲
               |  fires Inngest events                   |
               ▼                                         |
           [Inngest]  (cron jobs + event handlers)       |
               |                                         |
               └──── scores opps ──→ creates InboxItems  |
                                                         |
                                                  [MCP Server]
                                                         |
                                                  [Chat Client]
                                              (frontend /chat page)
```

---

## Backend (`/backend`)

**Tech stack:** Node.js, Express, Prisma, Inngest, Clerk

The backend is the core of the app. It:
- Fetches opportunity and award data from SAM.gov and USASpending.gov on a daily/bi-weekly schedule via Inngest cron jobs
- Normalizes and upserts that data into the database as `Opportunity`, `Award`, `BuyingOrganization`, `Recipient`, and `Contact` records
- Runs a scoring pipeline on every opportunity and award to determine if it is relevant to SupplyTiger
- Creates `InboxItem` records for anything that scores above the threshold
- Serves all CRUD operations for the frontend via a REST API
- Handles authentication via Clerk middleware (all routes are protected)
- Serves the built frontend in production

**Key source files:**

| File | Purpose |
|---|---|
| `backend/src/server.js` | Entry point — sets up Express, Clerk middleware, and all route mounts |
| `backend/src/config/inngest.js` | All 18 Inngest functions (cron + event-driven) |
| `backend/src/controllers/db.controller.js` | All entity CRUD operations |
| `backend/src/utils/inboxScoring.js` | Scoring algorithm |
| `backend/src/routes/db.routes.js` | All REST endpoints for data entities |
| `backend/src/routes/admin.routes.js` | Admin-only endpoints (user mgmt, sync triggers, config) |

**API route structure:**

| Prefix | Description |
|---|---|
| `/api/inngest` | Inngest webhook receiver |
| `/api/db` | All entity CRUD (inbox, opps, awards, contacts, etc.) |
| `/api/admin` | Admin controls (users, config, sync triggers, health) |
| `/api/chat` | LLM chat (powered by Gemini) |
| `/api/samgov` | SAM.gov ingest triggers |
| `/api/usaspending` | USASpending ingest triggers |
| `/api/digest` | Email digest triggers |

---

## Frontend (`/frontend`)

**Tech stack:** React 19, Vite, React Router v7, TanStack Query, Tailwind CSS, DaisyUI, Clerk

The frontend is a single-page React app. All data fetching goes through TanStack Query (`useQuery` / `useMutation`), which handles caching, loading states, and refetching.

**Route guards:**

| Guard | Allowed roles | Behavior if unauthorized |
|---|---|---|
| Public | Anyone | Login page |
| `DataOnlyRoute` | READ_ONLY, ADMIN | Redirects USER role to `/dashboard` |
| `AdminRoute` | ADMIN only | Redirects non-admin to `/dashboard` |

**Pages:**

| Route | Page | What it does |
|---|---|---|
| `/dashboard` | Dashboard | Overview stats — recent inbox items, opp counts, quick links |
| `/inbox` | Inbox | List of all work tickets (scored opps/awards worth pursuing) |
| `/inbox/:id` | Inbox Item Detail | Matched signals, notes log, edit form, link to source opp/award |
| `/opportunities` | Opportunities | Searchable/filterable list of all SAM.gov opportunities |
| `/opportunities/:id` | Opportunity Detail | Full opp view: contacts, agency, external SAM link, parsed docs, favorite toggle |
| `/awards` | Awards | List of USASpending.gov contract awards |
| `/awards/:id` | Award Detail | Full award view: recipient, agency, external link, favorite toggle |
| `/market-intelligence` | Market Intelligence | FLIS item research — browse NSN/NIIN items and PUBLOG data |
| `/analytics` | Analytics | Charts — PSC code distribution, NAICS breakdown, agency and recipient analytics |
| `/metrics` | Weekly Metrics | Weekly procurement metrics view |
| `/calendar` | Calendar | Industry Days calendar — lists upcoming events by date |
| `/industry-day/:id` | Industry Day Detail | Links to the source opp, edit status (Upcoming / Past Event) |
| `/contacts` | Contacts | All contacts extracted from opportunities and buying orgs |
| `/contacts/:id` | Contact Detail | Email, phone, outreach log, related opps and orgs. Contacts with no linked opps are flagged as orphaned and can be deleted. |
| `/recipients/:id` | Recipient Detail | Company that received a federal award — related awards, edit |
| `/buying-orgs/:id` | Buying Org Detail | Federal agency — parent/child org hierarchy, related opportunities |
| `/flis-items/:id` | FLIS Item Detail | NSN, NIIN, item name, description, PSC classification |
| `/chat` | Chat | AI-powered chat client backed by the MCP server — ask questions about the procurement data |
| `/admin` | Admin Panel | User management, keyword/filter config, manual sync triggers, system health, company profile, chat retention settings |
| `/favorites` | Favorites | Saved opportunities and awards |

---

## MCP Server (`/mcp`)

**Tech stack:** Node.js, Model Context Protocol SDK, Prisma

See `mcp.md` for full detail. In short: the MCP server is a read-only layer that exposes CocoaBridge's database as structured tools for LLM consumption. The chat client calls it to answer user questions about opportunities, awards, contacts, scoring, analytics, and more.

It is hosted separately from the backend because:
1. It is stateless and read-only — no need to share request lifecycle with the backend
2. Separating it reduces latency for the AI chat feature
3. It can be scaled and versioned independently

---

## Database

**Provider:** Neon (managed PostgreSQL)

The database uses two schemas:
- `public` — all procurement data (Opportunity, Award, InboxItem, BuyingOrganization, Recipient, Contact, FLIS items, etc.)
- `chat` — conversation history (ChatConversation, ChatMessage; 14-day TTL)

Schema is defined in `backend/prisma/schema.prisma`. Both the backend and MCP use a Prisma client generated from this schema. See `prisma.md` for the migration workflow.

---

## Data Flow — How an Opportunity Becomes an Inbox Item

1. Inngest cron fires daily at 12:00 AM EST
2. Backend calls the SAM.gov API and upserts opportunities into the `Opportunity` table
3. For each upserted opportunity, an `internal/opportunity.upserted` event is fired to Inngest
4. Inngest triggers the scoring pipeline:
   - Checks NAICS codes against SupplyTiger's configured codes
   - Checks PSC code against SupplyTiger's configured prefixes
   - Checks agency award history for relevant past contracts
   - Checks title/description for configured keyword signals
   - If the opportunity has parsed attachment text (PDFs/Word docs from SAM), checks for FLIS item/NSN matches
5. If total score exceeds the threshold → an `InboxItem` is created (or updated) in the database
6. The InboxItem appears in the frontend `/inbox` page for the team to review

**FLIS items** are the only manually seeded data in the system. They were inserted via SQL query from PUBLOG data and represent the federal logistics items most relevant to SupplyTiger's product catalog.

**Note:** The criteria for what item's we're inngesting can be configured in the admin `filters` panel.

---

## User Roles

| Role | Access | Notes |
|---|---|---|
| `ADMIN` | Full access — all pages, user management, sync triggers, config edits | John, Ryan, Prady, eCommerce Intern |
| `READ_ONLY` | Can view all data, cannot modify or trigger syncs | Standard role for team members |
| `USER` | Minimal access — account exists but most pages redirect to dashboard | Entry-level role. A new user who signs up starts here. An ADMIN must promote them to READ_ONLY or ADMIN from the `/admin` panel before they can do meaningful work. This is by design. |

---

## Inngest Functions

All 18 functions are defined in `backend/src/config/inngest.js`. They can all be triggered manually from the `/admin` panel without waiting for the scheduled cron time — useful for testing.

| Function | Trigger | Schedule |
|---|---|---|
| Sync SAM Opportunities | Cron | Daily 12:00 AM EST |
| Deactivate Expired Opps | Cron | Daily 12:15 AM EST |
| Mark Past Industry Days | Cron | Daily 12:20 AM EST |
| Backfill Opp Descriptions | Cron | Daily 12:30 AM EST |
| Sync SAM Industry Days | Cron | Daily 12:45 AM EST |
| Backfill Attachment Metadata | Cron | Daily 1:00 AM EST |
| Score New Opp Attachments | Cron | Daily 1:15 AM EST |
| Sync USASpending Awards | Cron | Every 3 days 1:00 AM EST |
| Score All Parsed Attachments | Cron | Sundays 2:00 AM EST |
| Cleanup Expired Scoring Queue | Cron | Daily 4:00 AM UTC |
| Cleanup Expired Chats | Cron | Daily 3:00 AM UTC |
| Send Daily Digest Email | Cron | Mon–Fri 8:00 AM EST |
| Sync New User from Clerk | Event: `clerk/user.created` | On signup |
| Update User from Clerk | Event: `clerk/user.updated` | On profile update |
| Delete User from Clerk | Event: `clerk/user.deleted` | On account deletion |
| Upsert InboxItem from Opp | Event: `internal/opportunity.upserted` | After each opp upsert |
| Upsert InboxItem from Award | Event: `internal/award.upserted` | After each award upsert |
| Score Attachment on Parsed | Event: `internal/attachment.parsed` | After attachment text is saved |
