# SupplyTiger – Government Outreach Automation (SupplyTigerGOA)

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
git clone https://github.com/divya-supplytiger/SupplyTigerGOA.git
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
SAMGOV_NOTICE_DESC_URL=https://api.sam.gov/opportunities/v1/noticedesc

# USASpending API
USASPENDING_BASE_URL=https://api.usaspending.gov

# Neon DB REST API (for direct queries)
NEON_DB_API=your_neon_api_key

# Admin access — comma-separated emails that auto-receive ADMIN role on signup
ADMIN_EMAILS=admin@example.com,another@example.com
```

**`frontend/.env`**

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx
VITE_API_BASE_URL=https://your-backend.vercel.app/api
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
├── backend/
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma         # Database schema
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
│       │   ├── db.controller.js         # DB CRUD + Clerk user sync
│       │   ├── sam.controller.js        # SAM.gov API integration
│       │   └── usaspending.controller.js # USASpending API integration
│       ├── middleware/
│       │   └── auth.middleware.js       # protectRoute, adminOnly, readOnlyOrAbove
│       ├── routes/
│       │   ├── admin.routes.js          # /api/admin/*
│       │   ├── db.routes.js             # /api/db/*
│       │   ├── sam.routes.js            # /api/samgov/*
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
        │   ├── Navbar.jsx
        │   ├── Sidebar.jsx       # Role-aware nav (hides Admin for non-admins)
        │   ├── NavigationLinks.jsx
        │   └── ...
        ├── pages/
        │   ├── AdminPage.jsx     # User mgmt, sync controls, system health
        │   ├── DashboardLayout.jsx
        │   ├── DashboardPage.jsx # Access-denied state for USER role
        │   ├── InboxPage.jsx
        │   ├── OpportunitiesPage.jsx
        │   ├── AwardsPage.jsx
        │   └── ...
        └── lib/
            ├── api.js            # dbApi + adminApi fetch functions
            ├── axios.js          # Axios instance with base URL
            └── CurrentUserContext.jsx  # DB user role context + useCurrentUser hook
```

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
| GET | `/api/db/awards` | READ_ONLY+ | List awards |
| GET | `/api/db/awards/:id` | READ_ONLY+ | Get award |
| GET | `/api/db/industry-days` | READ_ONLY+ | List industry days |
| GET | `/api/db/industry-days/:id` | READ_ONLY+ | Get industry day |
| PATCH | `/api/db/industry-days/:id` | ADMIN | Update industry day |
| GET | `/api/db/buying-orgs` | READ_ONLY+ | List buying organizations |
| GET | `/api/db/buying-orgs/:id` | READ_ONLY+ | Get buying organization |

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

### USASpending.gov Endpoints (`/api/usaspending`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/usaspending/awards/search` | Search awards |
| POST | `/api/usaspending/awards/count` | Get award counts |
| POST | `/api/usaspending/awards/category` | Search by category |
| GET | `/api/usaspending/awards/:award_id` | Get award by ID |
| GET | `/api/usaspending/awards/sync` | Sync awards to DB |

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
| Sync USASpending Awards | Every 3 days 1:00 AM EST | Pulls recent contract awards |

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
| **SyncLog** | History of automated and manual sync job runs |

---

## Admin Page

The `/admin` page (ADMIN role only) provides:

- **User Management** — view all users, change their role via dropdown, toggle active/inactive status
- **Manual Sync Controls** — trigger any of the 4 data sync jobs on demand with live feedback
- **System Health** — status cards showing last run time, success/failure, and records affected for each sync job

---

## Future Features

* Enhanced opportunity scoring (speed, size, friction)
* Prime contractor intelligence & relationship tracking via MCP Server
* Quote / follow-up templates tied to opportunity records
* GSA Advantage listing support
* Analytics: response rates, conversion paths, win/loss tracking
* Calendar integration for industry day events

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
