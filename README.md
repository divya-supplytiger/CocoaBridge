# SupplyTiger – CocoaBridge

## Overview

This project supports **SupplyTiger's execution-focused expansion into U.S. Federal Government sales**, with a primary emphasis on **micro-purchases, open-market buys, and subcontracting**.

See SRS Requirements: https://docs.google.com/document/d/1tAXbPDT3e3M8t0n1YTpOQnxqQT9WiyIk4owBVybbpMU/edit?usp=sharing

The system is designed to:

* Identify **near-term buying opportunities** from SAM.gov and USASpending.gov
* Track outreach, responses, and award follow-through
* Reduce friction between discovery → contact → quote → card swipe
* Provide role-based access for team members at different trust levels

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19 + Vite, React Router 7, TailwindCSS + DaisyUI |
| **Backend** | Node.js + Express |
| **Database** | PostgreSQL (Neon) + Prisma ORM |
| **Authentication** | Clerk (JWT + webhook sync) |
| **Background Jobs** | Inngest (cron syncs + event-driven inbox creation) |
| **MCP Server** | Model Context Protocol SDK + Zod validation |
| **AI / Chat** | Vercel AI SDK (`@ai-sdk/react`) with multi-model support |
| **Document Parsing** | pdf-parse (PDF), mammoth (DOCX) |
| **External APIs** | SAM.gov, USASpending.gov |
| **State Management** | TanStack React Query |
| **Deployment** | Vercel |

---

## Installation

### Prerequisites

- Node.js v18+
- PostgreSQL database (or Neon account)
- SAM.gov API key ([request here](https://sam.gov/content/entity-information))
- Clerk account ([clerk.com](https://clerk.com))
- Inngest account ([inngest.com](https://inngest.com))

### 1. Clone the Repository

```bash
git clone https://github.com/divya-supplytiger/CocoaBridge.git
cd SupplyTigerGOA
```

### 2. Install Dependencies

```bash
# Install root + all workspaces
npm install

# Or separately
cd backend && npm install
cd ../frontend && npm install
```

### 3. Environment Setup

**`backend/.env`**

```env
# Server
PORT=5050
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Database (Neon or local PostgreSQL)
DATABASE_URL=postgresql://user:pass@host/dbname

# Clerk Authentication
CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
CLERK_JWKS_URL=https://your-clerk-domain.clerk.accounts.dev/.well-known/jwks.json

# Inngest (background jobs)
INNGEST_EVENT_KEY=your_inngest_event_key
INNGEST_SIGNING_KEY=your_inngest_signing_key
INNGEST_ID=your_inngest_app_id

# SAM.gov API
SAMGOV_API_KEY=your_sam_gov_api_key
SAMGOV_BASE_URL=https://api.sam.gov/opportunities/v2/search
SAMGOV_NOTICE_DESC_URL=https://api.sam.gov/prod/opportunities/v1/noticedesc
SAMGOV_AWARD_URL=https://api.sam.gov/contract-awards/v1/search
SAMGOV_RESOURCES_URL=https://sam.gov/api/prod/opps/v3/opportunities

# USASpending API
USASPENDING_BASE_URL=https://api.usaspending.gov

# Neon DB REST API (for direct queries)
NEON_DB_API=your_neon_api_key

# GSA Acquisition API
GSA_AQUISITION_API_KEY=your_gsa_acquisition_api_key

# MCP Server (internal bridge)
MCP_SERVER_URL=http://localhost:3001
MCP_SECRET=your_mcp_shared_secret

# AI model
GEMINI_API_KEY=your_gemini_api_key

# Email (Resend)
RESEND_API_KEY=your_resend_api_key
RESEND_FROM=noreply@yourdomain.com
DIGEST_HMAC_SECRET=your_digest_hmac_secret

# Admin access — comma-separated emails that auto-receive ADMIN role on signup
ADMIN_EMAILS=admin@example.com,another@example.com
```

**`frontend/.env`**

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx
VITE_API_BASE_URL=https://your-backend.vercel.app/api
VITE_ENV=development
```

**`mcp/.env`**

```env
# Database (same Neon DB as backend)
DATABASE_URL=postgresql://user:pass@host/dbname

# MCP Server
PORT=3001
NODE_ENV=development
MCP_SERVER_URL=http://localhost:3001
MCP_SECRET=your_mcp_shared_secret

# AI model
GEMINI_API_KEY=your_gemini_api_key
```

### 4. Database Setup

```bash
cd backend

# Run migrations
npx prisma migrate dev

# Regenerate Prisma client (required after schema changes)
npx prisma generate

# (Optional) View database in Prisma Studio
npx prisma studio
```

### 5. Start Development Servers

```bash
# Backend (http://localhost:5050)
cd backend && npm run dev

# Frontend (http://localhost:5173)
cd frontend && npm run dev
```

---

## Project Structure

```
SupplyTigerGOA/
├── README.md
├── package.json                  # Root monorepo config
├── vercel.json                   # Vercel deployment config
├── mcp/                          # MCP Server (AI data layer)
│   └── src/
│       ├── mcpServer.js          # Tool registry & server setup
│       ├── promptLogic.js        # Prompt builders for bid drafts, fit analysis, fulfillment
│       ├── resources/
│       │   └── cidSpecs.js       # USDA CID specification data (8925, 8950, 8970)
│       └── tools/                # Individual MCP tool definitions
├── backend/
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma         # Database schema (public + chat schemas)
│   │   └── migrations/           # Applied migrations
│   └── src/
│       ├── server.js             # Express app entry point
│       ├── config/
│       │   ├── db.js             # Prisma client
│       │   ├── env.js            # Environment variable validation
│       │   ├── inngest.js        # Inngest functions + cron jobs
│       │   └── inngestClient.js  # Inngest client setup
│       ├── controllers/
│       │   ├── admin.controller.js      # Admin: user mgmt, sync triggers, health
│       │   ├── analytics.controller.js  # Analytics aggregation endpoints
│       │   ├── chat.controller.js       # Chat: conversation + message handlers
│       │   ├── db.controller.js         # DB CRUD + Clerk user sync
│       │   ├── sam.controller.js        # SAM.gov API integration
│       │   ├── scoringQueue.controller.js # Scoring queue approve/dismiss/manual score
│       │   └── usaspending.controller.js  # USASpending API integration
│       ├── lib/
│       │   ├── chatTools.js             # AI tool definitions bridging to MCP
│       │   ├── mcpClient.js             # MCP server client bridge
│       │   └── modelProvider.js         # Multi-model LLM provider config
│       ├── middleware/
│       │   └── auth.middleware.js       # protectRoute, adminOnly, readOnlyOrAbove
│       ├── routes/
│       │   ├── admin.routes.js          # /api/admin/*
│       │   ├── chat.routes.js           # /api/chat/*
│       │   ├── db.routes.js             # /api/db/*
│       │   ├── digest.routes.js         # /api/digest/* (HMAC-protected unsubscribe)
│       │   ├── sam.routes.js            # /api/samgov/*
│       │   ├── scoringQueue.routes.js   # /api/db/scoring-queue/* + manual score
│       │   └── usaspending.routes.js    # /api/usaspending/*
│       └── utils/
│           ├── extractSAM.js
│           ├── normalizeSAM.js
│           └── globals.js
└── frontend/
    └── src/
        ├── App.jsx               # Routes with role-based guards
        ├── main.jsx              # React entry point (Clerk + React Query)
        ├── components/
        │   ├── AddToInboxModal.jsx       # Modal to manually add opp/award to inbox
        │   ├── ConfirmModal.jsx          # Shared confirmation dialog (replaces inline confirm)
        │   ├── ExportToolbar.jsx         # Row export controls
        │   ├── FavoriteButton.jsx        # Star toggle; optimistic UI; opps + awards
        │   ├── Footer.jsx
        │   ├── ItemDetail.jsx            # Shared detail card (title, badges, fields, children)
        │   ├── ListEditors.jsx           # Editable list UI for admin config
        │   ├── ManualScoreModal.jsx      # Two-step manual scoring modal for no-attachment opps
        │   ├── Modal.jsx                 # Reusable DaisyUI modal wrapper
        │   ├── Navbar.jsx
        │   ├── NavigationLinks.jsx
        │   ├── NoteLog.jsx               # Logged notes panel for inbox items
        │   ├── OutreachLog.jsx           # Outreach interaction log panel for contacts
        │   ├── PageLoader.jsx            # Full-page loading spinner
        │   ├── PaginationButton.jsx      # Standalone pagination control
        │   ├── ParsedTextModal.jsx       # Attachment parse/preview/save modal
        │   ├── RelatedRecordsCard.jsx    # Linked records panel (opps, awards, orgs, contacts)
        │   ├── Row.jsx                   # Single table row
        │   ├── SearchBar.jsx             # Debounced search input (300ms), shared across pages
        │   ├── Sidebar.jsx               # Role-aware nav (hides Admin for non-admins)
        │   ├── SignalPills.jsx           # Signal badge display for matched scoring signals
        │   ├── Table.jsx                 # Paginated data table with clickable rows
        │   ├── TabsJoinButton.jsx        # Reusable DaisyUI join-style tab switcher
        │   ├── calendar/
        │   │   └── MonthGrid.jsx         # Month-view calendar grid
        │   ├── chat/
        │   │   ├── ChatMessage.jsx       # Message rendering with tool invocations
        │   │   └── ChatSidebar.jsx       # Conversation list with delete/rename
        │   └── dashboard/
        │       ├── KpiSection.jsx
        │       ├── RecentActivitySection.jsx
        │       ├── UpcomingDeadlinesSection.jsx
        │       ├── UpcomingIndustryDaysSection.jsx
        │       └── dashboardHelpers.jsx
        ├── pages/
        │   ├── AdminPage.jsx             # User mgmt, sync controls, system health, filter config
        │   ├── AnalyticsPage.jsx         # Tabbed analytics: Top Recipients | By PSC | By NAICS | By Agency
        │   ├── AwardDetail.jsx
        │   ├── AwardsPage.jsx            # Tabbed: All | Favorites; filterable by search, NAICS, PSC
        │   ├── BuyingOrgDetail.jsx       # Buying org detail; child orgs + linked opps; admin inline edit
        │   ├── CalendarPage.jsx          # Industry day + deadline calendar
        │   ├── ChatPage.jsx              # AI chat with conversation history & model selector
        │   ├── ContactDetail.jsx         # Contact detail; outreach log; admin inline edit
        │   ├── ContactsPage.jsx          # Contacts list with debounced search
        │   ├── DashboardLayout.jsx
        │   ├── DashboardPage.jsx         # KPI cards, recent activity, upcoming deadlines, industry days
        │   ├── FLISItemDetail.jsx        # FLIS/Publog supply item detail page
        │   ├── FavoritesPage.jsx         # User's starred opportunities and awards
        │   ├── InboxItemDetail.jsx       # Inbox detail; notes log; admin status edit; linked opp/award
        │   ├── InboxPage.jsx             # Inbox list; admin status dropdown + delete
        │   ├── IndustryDayDetail.jsx     # Industry day detail page
        │   ├── LoginPage.jsx             # Sign-in page
        │   ├── MarketIntelligencePage.jsx # Tabbed view: Recipients | Buying Agencies
        │   ├── NotFoundPage.jsx          # 404 page
        │   ├── OpportunitiesPage.jsx
        │   ├── OpportunityDetail.jsx
        │   ├── RecipientDetail.jsx       # Recipient detail; admin inline edit (website)
        │   └── WeeklyMetricsPage.jsx     # Weekly pipeline metrics dashboard
        └── lib/
            ├── api.js            # dbApi + chatApi + adminApi fetch functions
            ├── axios.js          # Axios instance with base URL
            └── CurrentUserContext.jsx  # DB user role context + useCurrentUser hook
```

---

## MCP Server (AI Data Layer)

The MCP (Model Context Protocol) server acts as the **sole data access layer for all AI interactions**, providing a clean separation between the chat interface and the database.

### Tools (23)

| Tool | Description |
|------|-------------|
| `search_opportunities` | Find procurement opportunities by keyword, type, NAICS, PSC, state, or active status |
| `get_opportunity` | Retrieve full details of a single opportunity by ID, including `inboxStatus` (pipeline score, review status, matched signals) |
| `search_awards` | Search federal contract awards by keyword, NAICS, PSC, recipient, buying org, or amount range |
| `get_award` | Retrieve full details of a single award by ID, including `inboxStatus` |
| `search_buying_orgs` | Search government buying organizations by name or hierarchy level |
| `get_buying_org` | Get buying org details including parent, children, and counts |
| `search_recipients` | Find award recipients (prime contractors) by name or UEI |
| `search_contacts` | Find contacts linked to opportunities, buying orgs, or industry days; `includeInboxContacts` flag exposes manually-added inbox contacts |
| `search_inbox_opportunities` | Search the active pursuit pipeline — InboxItems and ScoringQueue entries — by PSC, NAICS, keyword, review status, or minimum score; returns inline contacts |
| `search_publog_items` | Search federal supply items by keyword, PSC, NIIN, or NSN from DLA Publog data |
| `get_cid_spec` | Look up USDA Commercial Item Description (CID) specs by CID code or PSC code |
| `get_analytics_summary` | High-level database summary: totals, top agencies, recent opportunities |
| `score_opportunity` | Score an opportunity against SupplyTiger's company profile (HIGH/MEDIUM/LOW fit); response includes `inboxStatus` showing whether the opportunity is already in the inbox or queue |
| `get_intelligence_summary` | Deep procurement intelligence for a NAICS code, PSC code, or buying org; when filtering by org, expands the query to include all child and grandchild offices |
| `generate_bid_draft` | Generate a structured draft bid/proposal for a specific opportunity |
| `analyze_opportunity_fit` | Analyze competitive landscape, incumbents, and recommend GO/NO-GO/CONDITIONAL |
| `analyze_fulfillment` | Determine FULL/PARTIAL/NO-BID based on capabilities, CLIN structure, and PSC/NAICS alignment |
| `generate_outreach_draft` | Draft a professional outreach email to the contracting POC for an active inbox item |
| `get_inbox_item` | Retrieve full details of a single inbox item by ID, including score, matched signals, buying org, contacts, linked opportunity, and paginated logged notes |
| `get_contact_interactions` | Returns the paginated outreach interaction log for a contact; filter by status or date; useful for reviewing outreach history before drafting a follow-up |
| `get_calendar_events` | Returns upcoming opportunity deadlines, inbox item deadlines, and industry days for a given month/year or custom date range |
| `get_weekly_metrics` | Returns the 5-metric pipeline report for a given ISO week (e.g. `2026-W14`); includes full records for current week and counts-only for previous week |

### Prompt Tools

The `generate_*` / `analyze_*` tools are **prompt-flow tools** — they assemble rich context (opportunity data, company profile, CID specs, buying history, pipeline score) into structured prompts that the AI model executes as instructions. Each returns a preamble that forces the model to produce a full analysis rather than summarizing.

`generate_bid_draft`, `analyze_opportunity_fit`, and `analyze_fulfillment` all inject the opportunity's current **pipeline scoring context** (inbox review status, queue score, matched NSN signals) when available, giving the model insight into SupplyTiger's internal assessment.

`generate_outreach_draft` fetches the inbox item's linked opportunity contacts (from SAM.gov) and any manually-added inbox contacts, deduplicates them, and includes NSN/signal data to ground the email in SupplyTiger's supply capability.

### Resources

| Resource | Description |
|----------|-------------|
| Company Profile | SupplyTiger's capabilities, NAICS/PSC codes, acquisition paths |
| Bid Template | Standard bid response template for context |
| CID Specs | USDA Commercial Item Descriptions (A-A-20177G, A-A-20001C, A-A-20331B) with scope, salient characteristics, analytical requirements, QA provisions, and packaging |

### Architecture

```
ChatPage → /api/chat (streaming) → chatTools → mcpClient → MCP Server → Database
```

The MCP server is registered in `mcp/src/mcpServer.js`. Each tool includes annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`) for proper classification.

---

## Chat Widget

The `/chat` page provides an AI-powered procurement intelligence assistant accessible to all authenticated users.

- **Streaming responses** via Vercel AI SDK (`@ai-sdk/react`)
- **Multi-model support** — configurable LLM provider (Gemini, Claude, etc.)
- **Conversation management** — create, rename, delete, and browse conversation history
- **Tool integration** — AI can search opportunities, score fits, pull analytics, and more via MCP tools
- **Privacy controls** — conversations can be toggled between private and shared
- **14-day retention** — conversations auto-expire after 14 days
- **Persistence** — conversations and messages stored in a separate `chat` schema in PostgreSQL
- **Prompt starters** — four quick-launch buttons on the chat page: Analyze Fit, Draft Bid, Analyze Fulfillment, and **Draft Outreach** (pre-fills the outreach draft prompt for an active inbox item)

---

## Document Parsing (Attachments)

Solicitation documents (PDFs, DOCX files) attached to SAM.gov opportunities can be parsed on-demand from the opportunity detail page.

### How It Works

1. **Metadata ingestion** — During opportunity sync, `resourceLinks` (download URLs) are stored. A daily cron job calls the SAM.gov `/resources` endpoint to backfill file metadata (name, size, MIME type, posted date) into the `OpportunityAttachment` table.
2. **On-demand parsing** — From the opportunity detail page, users click **Parse** on a PDF/DOCX attachment. The backend downloads the file, extracts text via `pdf-parse` (PDF) or `mammoth` (DOCX), and applies section filtering.
3. **Section extraction** — A 4-tier regex hierarchy extracts only relevant content:
   - **Tier 1:** Section B (Supplies/Services/CLINs) and Section C (Description/Specs)
   - **Tier 2:** CLIN blocks (`CLIN 0001`, `CLIN 0002`, etc.)
   - **Tier 3:** Item description/info/detail and component list patterns
   - **Tier 4:** Full text fallback if no structure is detected
4. **Preview-then-save** — Parsed text is returned as a preview. Users review the extracted content and explicitly click **Save** to persist to the database, or **Discard** to throw it away. Already-saved attachments can be re-parsed.

### Size Limit

Files over 10 MB are rejected to avoid memory issues.

---

## Dashboard

The `/dashboard` page provides an at-a-glance overview for READ_ONLY and ADMIN users:

| Section | Description |
|---------|-------------|
| **KPI Cards** | Counts by status — total opportunities, active opportunities, awards, inbox items |
| **Recent Activity** | Most recently added opportunities |
| **Upcoming Deadlines** | Opportunities with approaching response deadlines |
| **Upcoming Industry Days** | Industry day events happening soon |

Users with the `USER` role see an access-restricted message instead.

---

## Authentication & Role-Based Access Control

The app uses **Clerk** for authentication (JWT validation) and **Prisma** for storing the user's role in the database.

### User Roles

| Role | Access |
|------|--------|
| `USER` | Default on signup. Can log in, but sees an access-restricted message on the dashboard. Cannot navigate to any data pages. |
| `READ_ONLY` | Full read access to all data pages (Inbox, Opportunities, Awards, etc.). Cannot perform any mutations (PATCH/DELETE). |
| `ADMIN` | Full access to all pages including `/admin`. Can update data and manage users. Only role that sees "Admin" in the sidebar. |

### How Role Assignment Works

- New users default to `USER` role when their Clerk account syncs to the database.
- Users whose email matches the `ADMIN_EMAILS` environment variable are automatically assigned `ADMIN` on signup.
- Admins can manually promote any user to `READ_ONLY` or `ADMIN` from the Admin page.

### Auth Middleware (Backend)

| Middleware | Behavior |
|-----------|----------|
| `protectRoute` | Validates Clerk JWT; looks up user in DB; checks `isActive`. |
| `readOnlyOrAbove` | Blocks `USER` role from data endpoints (GET data routes). |
| `adminOnly` | Blocks all non-`ADMIN` roles from mutation and admin endpoints. |

---

## API Reference

All endpoints under `/api/db` and `/api/admin` require authentication via Clerk JWT.

### Database Endpoints (`/api/db`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/api/db/ping` | Any authenticated | Health check |
| GET | `/api/db/me` | Any authenticated | Current user's DB profile |
| GET | `/api/db/inbox-items` | READ_ONLY+ | List inbox items |
| GET | `/api/db/inbox-items/:id` | READ_ONLY+ | Get inbox item |
| PATCH | `/api/db/inbox-items/:id` | ADMIN | Update inbox item |
| DELETE | `/api/db/inbox-items/:id` | ADMIN | Delete inbox item |
| GET | `/api/db/opportunities` | READ_ONLY+ | List opportunities |
| GET | `/api/db/opportunities/:id` | READ_ONLY+ | Get opportunity |
| DELETE | `/api/db/opportunities/:id` | ADMIN | Hard delete opportunity (preserves multi-parent contact links) |
| GET | `/api/db/opportunities/:id/manual-score/preview` | ADMIN | Run the metadata scoring layer and return `metadataScore` + `metadataSignals` for the manual score modal |
| POST | `/api/db/opportunities/:id/manual-score` | ADMIN | Submit manual attachment-layer signals; validates NSNs against FLIS; routes result to InboxItem or ScoringQueue |
| POST | `/api/db/attachments/:id/parse` | READ_ONLY+ | Parse a PDF/DOCX attachment and return extracted text (preview only, not saved) |
| POST | `/api/db/attachments/:id/save-parsed` | READ_ONLY+ | Save previously parsed text to the database after user review |
| GET | `/api/db/attachments/:id/text` | READ_ONLY+ | Retrieve saved parsed text for an attachment |
| GET | `/api/db/awards` | READ_ONLY+ | List awards |
| GET | `/api/db/awards/:id` | READ_ONLY+ | Get award |
| DELETE | `/api/db/awards/:id` | ADMIN | Hard delete award |
| GET | `/api/db/industry-days` | READ_ONLY+ | List industry days |
| GET | `/api/db/industry-days/:id` | READ_ONLY+ | Get industry day |
| PATCH | `/api/db/industry-days/:id` | ADMIN | Update industry day |
| GET | `/api/db/buying-orgs` | READ_ONLY+ | List buying organizations (filter by `level`) |
| GET | `/api/db/buying-orgs/:id` | READ_ONLY+ | Get buying organization with child orgs + opportunities |
| PATCH | `/api/db/buying-orgs/:id` | ADMIN | Update buying org (`website`) |
| GET | `/api/db/recipients` | READ_ONLY+ | List recipients (search by name/UEI) |
| GET | `/api/db/recipients/:id` | READ_ONLY+ | Get recipient with linked awards |
| PATCH | `/api/db/recipients/:id` | ADMIN | Update recipient (`website`) |
| GET | `/api/db/contacts` | READ_ONLY+ | List contacts (search by name/email) |
| GET | `/api/db/contacts/:id` | READ_ONLY+ | Get contact with linked opps/industry days/buying orgs |
| PATCH | `/api/db/contacts/:id` | ADMIN | Update contact (`phone`, `title`) |
| GET | `/api/db/favorites` | READ_ONLY+ | List all favorited opportunities and awards |
| POST | `/api/db/favorites` | READ_ONLY+ | Toggle favorite on an opportunity or award |
| GET | `/api/db/analytics/recipients` | READ_ONLY+ | Top award recipients ranked by total obligated amount |
| GET | `/api/db/analytics/psc` | READ_ONLY+ | Award spend and opportunity counts grouped by PSC code |
| GET | `/api/db/analytics/naics` | READ_ONLY+ | Award spend and opportunity counts grouped by NAICS code |
| GET | `/api/db/analytics/agencies` | READ_ONLY+ | Buying agencies ranked by opportunity count and award spend |

**Scoring Queue (`/api/db/scoring-queue`)**

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/api/db/scoring-queue` | ADMIN | List pending scoring queue entries |
| POST | `/api/db/scoring-queue/:id/approve` | ADMIN | Approve entry — promotes to InboxItem |
| POST | `/api/db/scoring-queue/:id/dismiss` | ADMIN | Dismiss entry |

### Chat Endpoints (`/api/chat`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/api/chat` | Any authenticated | Stream a chat response (auto-saves conversation) |
| GET | `/api/chat/models` | Any authenticated | List available AI models |
| GET | `/api/chat/conversations` | Any authenticated | User's conversation history |
| GET | `/api/chat/conversations/:id/messages` | Any authenticated | Messages for a specific conversation |
| DELETE | `/api/chat/conversations/:id` | Any authenticated | Delete a conversation |
| PATCH | `/api/chat/conversations/:id` | Any authenticated | Update conversation title or privacy |

### Admin Endpoints (`/api/admin`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/api/admin/users` | ADMIN | List all users |
| PATCH | `/api/admin/users/:id` | ADMIN | Update user role / active status |
| GET | `/api/admin/system-health` | ADMIN | Most recent sync log per job |
| POST | `/api/admin/sync/sam-opportunities` | ADMIN | Manually trigger SAM sync |
| POST | `/api/admin/sync/usaspending-awards` | ADMIN | Manually trigger USASpending sync |
| POST | `/api/admin/sync/sam-descriptions` | ADMIN | Manually trigger description backfill |
| POST | `/api/admin/sync/sam-industry-days` | ADMIN | Manually trigger industry day sync |
| POST | `/api/admin/sync/sam-attachments` | ADMIN | Manually trigger attachment metadata backfill |
| POST | `/api/admin/sync/score-opportunity-attachments` | ADMIN | Manually trigger inbox scoring pipeline |
| POST | `/api/admin/sync/cleanup-chats` | ADMIN | Manually trigger expired chat cleanup |
| GET | `/api/admin/config` | ADMIN | Get all filter + access config values |
| GET | `/api/admin/config/public` | Any authenticated | Get `chatRetentionDays` (used by chat widget) |
| PUT | `/api/admin/config/:key` | ADMIN | Update a config value (`solicitationKeywords`, `naicsCodes`, `pscPrefixes`, `industryDayKeywords`, `adminEmailRules`, `readOnlyEmailRules`, `chatRetentionDays`, and their bank variants) |
| GET | `/api/admin/stats` | ADMIN | Database record counts |
| GET | `/api/admin/company-profile` | ADMIN | Get company profile resource |
| PUT | `/api/admin/company-profile` | ADMIN | Update company profile |
| GET | `/api/admin/parsed-documents/stats` | ADMIN | Parsed attachment statistics |
| GET | `/api/admin/parsed-documents` | ADMIN | List parsed documents |

### SAM.gov Endpoints (`/api/samgov`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/samgov/ping` | Health check |
| GET | `/api/samgov/opportunities/current` | Fetch current opportunities |
| GET | `/api/samgov/opportunities/current/sync` | Sync current opportunities to DB |
| GET | `/api/samgov/opportunities/historical` | Fetch historical opportunities |
| GET | `/api/samgov/opportunities/event` | Fetch industry day events |
| GET | `/api/samgov/opportunities/description/backfill` | Backfill missing descriptions |
| GET | `/api/samgov/opportunities/:noticeId/description` | Fetch single opportunity description |
| GET | `/api/samgov/opportunities/attachments/backfill` | Backfill attachment metadata from SAM.gov `/resources` endpoint |

### USASpending.gov Endpoints (`/api/usaspending`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/usaspending/awards/search` | Search awards |
| POST | `/api/usaspending/awards/count` | Get award counts |
| POST | `/api/usaspending/awards/category` | Search by category |
| GET | `/api/usaspending/awards/:award_id` | Get award by ID |
| GET | `/api/usaspending/awards/sync` | Sync awards to DB |

### Digest Endpoints (`/api/digest`)

> Not protected by Clerk JWT. Uses an HMAC token embedded in the unsubscribe URL.

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/api/digest/unsubscribe` | None (HMAC token) | Unsubscribe a user from digest emails |

---

## Background Jobs (Inngest)

Cron jobs run automatically. All jobs write a `SyncLog` entry to the database on start and completion, visible from the Admin page.

| Job | Schedule | Description |
|-----|----------|-------------|
| Sync SAM Opportunities | Daily 12:00 AM EST | Pulls current opportunities from SAM.gov |
| Deactivate Expired Opportunities | Daily 12:15 AM EST | Marks past-deadline opportunities inactive |
| Mark Past Industry Days | Daily 12:20 AM EST | Marks industry days with passed event dates |
| Backfill Opportunity Descriptions | Daily 12:30 AM EST | Fills in missing descriptions from SAM.gov |
| Sync Industry Days | Daily 12:45 AM EST | Syncs industry day events from SAM.gov |
| Backfill Attachment Metadata | Daily 1:00 AM EST | Fetches attachment metadata from SAM.gov for opportunities with resource links |
| Score New Opportunity Attachments | Daily 1:30 AM EST | Downloads + parses attachments for unprocessed PSC-matched opps; routes to inbox or scoring queue based on score |
| Cleanup Expired Scoring Queue | Daily 2:00 AM EST | Removes PENDING scoring queue entries that have expired or belong to inactive opportunities |
| Sync USASpending Awards | Every 3 days 1:00 AM EST | Pulls recent contract awards |
| Send Daily Digest | Weekdays 8:00 AM EST | Sends a procurement digest email to all active users with digest enabled |

**Event-driven jobs:**

| Event | Trigger | Description |
|-------|---------|-------------|
| `clerk/user.created` | New Clerk signup | Creates user in DB, assigns role |
| `clerk/user.updated` | Clerk profile change | Updates user in DB |
| `clerk/user.deleted` | Clerk account deletion | Removes user from DB |
| `internal/opportunity.upserted` | After opportunity sync | Creates/updates InboxItem |
| `internal/award.upserted` | After award sync | Creates/updates InboxItem |

---

## Database Schema

Key models in the Prisma schema:

| Model | Description |
|-------|-------------|
| **User** | Authenticated users with role (`ADMIN`, `READ_ONLY`, `USER`) |
| **Opportunity** | Government opportunities from SAM.gov |
| **IndustryDay** | Industry day events linked to opportunities |
| **Award** | Contract awards from USASpending.gov |
| **InboxItem** | Central workflow item linking opportunities/awards to review status |
| **BuyingOrganization** | Hierarchical agency/office structure |
| **Contact** + **ContactLink** | Points of contact extracted from opportunities |
| **Recipient** | Award recipients/contractors (by UEI) |
| **OpportunityAttachment** | Solicitation documents linked to opportunities (PDF/DOCX metadata, parsed text) |
| **FederalLogisticsInformationSystem** | DLA Publog/FLIS supply item data (NSN, NIIN, PSC, item descriptions) |
| **Favorite** | User bookmarks for opportunities and awards |
| **ScoringQueue** | Pending opportunities scored 4–7 awaiting manual review; stores `matchedSignals` JSON and expiry |
| **AppConfig** | Key-value store for runtime config: filter lists, email rules, chat retention |
| **SyncLog** | History of automated and manual sync job runs |
| **ChatConversation** | Conversation metadata with expiry tracking (chat schema) |
| **ChatMessage** | Individual messages with role, content, tool calls (chat schema) |

---

## Inbox Item Upsertion Pipeline

New opportunities are evaluated and routed into the inbox through a multi-stage scoring pipeline rather than being admitted wholesale.

### Trigger

The **Score New Opportunity Attachments** job (manually triggerable from Admin → Manual Sync, and schedulable via Inngest) runs against all active opportunities that:
- Have a PSC code in SupplyTiger's target set (`8925`, `8950`, `8970`)
- Have no existing `InboxItem`
- Have no pending `ScoringQueue` entry

### Opportunity Scoring Algorithm

Each opportunity is scored against two layers:

**Layer 1 — Metadata signals** (evaluated against the opportunity record):

| Signal | Points | Source |
|--------|--------|--------|
| NAICS code matches active filter config | +2 | opportunity |
| NAICS code is a core code (`424450`, `424410`, `424490`) | +3 additional | opportunity |
| PSC code matches active filter config prefixes | +2 | opportunity |
| PSC code is a core code (`8925`, `8950`, `8970`) | +2 additional | opportunity |
| Agency has prior award history in target NAICS/PSC | +1 | awards table |
| Response deadline ≥ 14 days away | +1 | opportunity |
| Response deadline < 7 days away | -1 | opportunity |
| Title/description keyword match (solicitation keywords) | +2 per match | opportunity |

> A single opportunity can score up to +5 for NAICS (base +2, priority +3) and +4 for PSC (base +2, priority +2) from metadata alone.

**Layer 2 — Attachment signals** (evaluated against parsed PDF/DOCX content; falls back to metadata text if no attachments):

| Signal | Points | Source |
|--------|--------|--------|
| NSN found in text matches a FLIS item | +5 per NSN | attachment |
| FLIS item name found in text | +3 (first match only) | attachment |
| FLIS common name found in text | +2 (first match only) | attachment |
| Target PSC code found in text | +1 | attachment |
| Keyword match not already caught in metadata | +2 per match | attachment |

The best-scoring attachment contributes its signals; others are discarded to avoid double-counting. If no attachments exist, Layer 2 falls back to scoring the title + description text.

### Routing by Score

| Score | Action |
|-------|--------|
| **≥ 8** | **Auto-admit** — creates an `InboxItem` immediately. Attachment text is persisted to `OpportunityAttachment.parsedText`. |
| **4–7** | **Queue for review** — creates a `ScoringQueue` entry. Expires at the earlier of 14 days or the opportunity deadline. Attachment text is persisted. |
| **< 4** | **Drop** — no record created; opportunity is skipped on future runs until it changes. |

### Award Scoring Algorithm

Awards ingested from USASpending.gov are scored using `scoreAwardForInbox` against SupplyTiger's domain signals. Awards scoring below **2** are skipped entirely.

| Signal | Points | Source |
|--------|--------|--------|
| PSC code matches classification prefixes (`8925`, `8950`, `8970`) | +2 | award |
| PSC code is a core code (`8925`, `8950`, `8970`) | +2 additional | award |
| NAICS code matches target prefixes | +2 | award |
| NAICS code is a core code (`424450`, `424410`, `424490`) | +3 additional | award |
| Description keyword match (solicitation keywords, first match) | +2 | award |
| Obligated amount is below micropurchase threshold (`$10,000`) | +2 | award |
| Agency has prior award history in target NAICS/PSC | +1 | awards table |

Awards sourced from `internal/award.upserted` events are scored on ingest; the `InboxItem` is created with `attachmentScore` and `matchedSignals` populated. The backfill job (`runBackfillAwardInboxScores`) retroactively scores award-linked inbox items that have no score.

### MCP `score_opportunity` Tool (AI Scoring)

The `score_opportunity` MCP tool provides a lightweight HIGH/MEDIUM/LOW assessment used by the AI chat assistant. It uses a simpler point model than the inbox pipeline:

| Signal | Points |
|--------|--------|
| NAICS code matches active filter config | +3 |
| PSC code matches active filter config | +2 |
| Title/description keyword match | +2 |
| Acquisition path fits (SOLICITATION, PRE_SOLICITATION, SOURCES_SOUGHT → GSA; AWARD_NOTICE → SUBCONTRACTING) | +1 |
| Agency has prior award history in relevant NAICS/PSC | +2 |
| Response deadline ≥ 14 days away | +1 |
| Response deadline < 7 days away | -1 |

| Score | Rating |
|-------|--------|
| ≥ 7 | HIGH |
| ≥ 4 | MEDIUM |
| < 4 | LOW |

### Manual Scoring

For active opportunities that have **no parseable attachments** (PDFs/DOCX), the automated Layer 2 pipeline cannot run. Admins can trigger a manual score from the opportunity detail page using the **Manual Score** button.

#### When the button is shown

- Opportunity is active
- No PDF or DOCX attachments are present
- User is ADMIN
- The button is **disabled** (with a tooltip) if the opportunity already has a `PENDING` ScoringQueue entry — the pending item must be approved or dismissed first

#### How it works

The modal is two-step:

**Step 1 — Build**

- The metadata layer (`scoreOpportunityMetadata`) runs immediately on open and displays the **ground-truth signals** already matched (NAICS, PSC, agency history, deadline, keywords) as read-only pills
- Admin selects **attachment-layer signals** manually:
  - **NSN lookup** — search FLIS by item name or NSN; each selected item contributes `NSN_MATCH` (+5), `ITEM_NAME` (+3, first only), and `COMMON_NAME` (+2, first only)
  - **PSC in text** — checkbox, adds `PSC_IN_TEXT` (+1)
  - **Keywords** — multi-select from the active solicitation keyword list, each adds `KEYWORD` (+2)

**Step 2 — Preview**

- Displays total score, routing decision badge (`AUTO_ADMIT` / `QUEUE` / `BELOW_THRESHOLD`), and the full signal breakdown
- Admin can go back to adjust or confirm to submit

#### Routing

Same thresholds as the automated pipeline:

| Score | Action |
|-------|--------|
| **≥ 8** | Auto-admit — creates or updates an `InboxItem` |
| **4–7** | Queue for review — creates or updates a `ScoringQueue` entry |
| **< 4** | Below threshold — no record created |

The operation is **non-destructive**: if an `InboxItem` already exists, only `attachmentScore` and `matchedSignals` are updated (status and notes are preserved). A `ScoringQueue` entry that already exists is similarly updated rather than replaced.

#### Signal bank (attachment layer only)

| Signal | Points | Notes |
|--------|--------|-------|
| `NSN_MATCH` | +5 per NSN | Validated against FLIS table |
| `ITEM_NAME` | +3 | First FLIS item with a name match only |
| `COMMON_NAME` | +2 | First FLIS item with a common name only |
| `PSC_IN_TEXT` | +1 | Checkbox — admin asserts PSC appears in document |
| `KEYWORD` | +2 per keyword | From active solicitation keyword list |

---

### ML-Friendly Architecture

All scoring decisions are stored alongside the raw evidence that drove them:

- **`InboxItem.attachmentScore`** — the final numeric score at admission time
- **`InboxItem.matchedSignals`** / **`ScoringQueue.matchedSignals`** — a JSON array of every signal that fired, with `{ type, value, source }` (e.g. `{ type: "NSN_MATCH", value: "8925-01-234-5678", source: "attachment" }`). This makes the scoring auditable and can serve as labeled training data for a future ML classifier.
- **`OpportunityAttachment.parsedText`** — the full extracted text stored alongside the opportunity so it can be re-scored or used as a feature corpus without re-downloading the file.

Opportunity signal types: `NAICS_MATCH`, `NAICS_PRIORITY`, `PSC_MATCH`, `PSC_PRIORITY`, `AGENCY_HISTORY`, `DEADLINE_FAVORABLE`, `KEYWORD`, `NSN_MATCH`, `ITEM_NAME`, `COMMON_NAME`, `PSC_IN_TEXT`.

Award signal types: `PSC_MATCH`, `PSC_PRIORITY`, `NAICS_MATCH`, `NAICS_PRIORITY`, `KEYWORD`, `MICROPURCHASE`, `AGENCY_HISTORY`.

---

## Admin Page

The `/admin` page (ADMIN role only) provides:

- **User Management** — view all users, change their role via dropdown, toggle active/inactive status
- **Access Control** — configure default role assignment rules and chat retention window (see below)
- **Manual Sync Controls** — trigger any data sync job on demand with live feedback (includes Score New Opportunities)
- **System Health** — status cards showing last run time, success/failure, and records affected for each sync job
- **Filter Configuration** — tabbed keyword/code editor for the 4 sync filter types (Solicitation Keywords, NAICS Codes, PSC Prefixes, Industry Day Keywords); each filter has an active list and a word bank for quick re-adding
  > **Note:** Filter Configuration applies to SAM.gov and USASpending data ingest only. Publog data was manually inserted.

### Access Control

The **Access Control** card under Admin has two sub-sections:

**Email Rules** — controls the role automatically assigned when a new user signs up via Clerk:

- **Admin Email Rules** — exact emails (`user@example.com`) or domain postfixes (`@example.com`) that get the `ADMIN` role on first sign-in. Adding a domain here automatically removes any matching entries from the Read-Only rules to prevent conflicts.
- **Read-Only Email Rules** — same format; matched users get `READ_ONLY`. Entries that already exist in the Admin rules are silently stripped to enforce precedence (`ADMIN` always wins).

Rules are stored in `AppConfig` (`adminEmailRules` / `readOnlyEmailRules` keys) and evaluated in the Clerk `user.created` Inngest handler. Unmatched users default to `USER`.

**Chat Retention Days** — a numeric input (1–365) that sets how long new chat conversations are retained before auto-expiry. Stored in `AppConfig` under `chatRetentionDays`. Changes apply to conversations created after the save; existing conversations keep their original expiry.

## Admin Inline Editing

Admins can manually enrich or correct data on detail pages without waiting for a sync.

---

## Favorites

Users with `READ_ONLY` or `ADMIN` roles can star opportunities and awards to save them for quick access.

- **Star button** appears on the Awards list and detail pages, and the Opportunities detail page
- **Favorites tab** on the Awards page filters the list to only favorited awards
- Favorites are per-user and stored in the database via the `Favorite` model
- The toggle is optimistic — the UI updates instantly and reverts on error

---

## Analytics

The `/analytics` page (READ_ONLY+) provides a tabbed breakdown of contract data:

| Tab | Description |
|-----|-------------|
| **Top Recipients** | Award recipients ranked by total obligated amount, with award count and a relative bar |
| **By PSC Code** | Opportunity counts and award spend grouped by Product Service Code; sortable by award $ or opp count |
| **By NAICS Code** | Same as PSC but grouped by NAICS code |
| **By Agency** | Buying organizations ranked by activity, with a per-type opportunity breakdown (SOL, PRE, SS, AWD, SPC, OTH) |

---

## Future Features

* **Scoring Gradient Descent** — Adaptive signal weights via binary logistic regression trained on labeled InboxItems. Includes a `TrainingLabel` model for manual bootstrap labels, an async training endpoint (`POST /api/admin/scoring/train`), a `ScoringModel` table storing learned weights and thresholds, and an `/ml` admin page for labeling the queue and reviewing model history. The live pipeline loads learned weights within 60 seconds of training and falls back to hardcoded defaults when no trained model exists.
* **Ollama Model Provider** — Local/self-hosted LLM inference via `ollama-ai-provider`. When `OLLAMA_BASE_URL` is set, available Ollama models are fetched from `/api/tags`, cached for 60 seconds, and merged into the model list alongside Gemini. Each Ollama model appears in the chat dropdown with a `(Local)` suffix. Models known to support tool-calling (llama3.1+, qwen2.5, mistral, command-r) are flagged `toolCapable`. Ollama is fully optional — omitting `OLLAMA_BASE_URL` silently excludes it with no errors.
* Quote / follow-up templates tied to opportunity records
* GSA Advantage listing support

---

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Run `npx prisma generate` if schema was modified
4. Submit a pull request

---

## Status

**Active development**

---

## License

ISC
