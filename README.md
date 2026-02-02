# SupplyTiger – Government Outreach Automation Project (SupplyTigerGOA) - v1

## Overview

This project supports **SupplyTiger's execution-focused expansion into U.S. Federal Government sales**, with a primary emphasis on **micro-purchases, open-market buys, and subcontracting**.

The system is designed to:

* Identify **near-term buying opportunities**
* Track outreach and responses
* Reduce friction between discovery → contact → quote → card swipe

This README represents the **current state** of the project and will be expanded as additional functionality is implemented.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Node.js + Express |
| **Database** | PostgreSQL + Prisma ORM |
| **Authentication** | Clerk |
| **Background Jobs** | Inngest (planned) |
| **External APIs** | SAM.gov, USASpending.gov |

---

## Installation

### Prerequisites

- Node.js v18+ 
- PostgreSQL database
- SAM.gov API key ([request here](https://sam.gov/content/entity-information))
- Clerk account for authentication ([clerk.com](https://clerk.com))

### 1. Clone the Repository

```bash
git clone https://github.com/divya-supplytiger/SupplyTigerGOA.git
cd SupplyTigerGOA
```

### 2. Install Dependencies

```bash
cd backend
npm install
```

### 3. Environment Setup

Create a `.env` file in the `backend` directory:

```env
# Server
PORT=5001
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/supplytigergoa

# SAM.gov API
SAMGOV_API_KEY=your_sam_gov_api_key
SAMGOV_BASE_URL=https://api.sam.gov/opportunities/v2/search
SAMGOV_NOTICE_DESC_URL=https://api.sam.gov/opportunities/v1/noticedesc

# USASpending API
USASPENDING_BASE_URL=https://api.usaspending.gov

# Clerk Authentication
CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx

# Inngest (for background jobs)
INNGEST_EVENT_KEY=your_inngest_event_key
INNGEST_SIGNING_KEY=your_inngest_signing_key
```

### 4. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# (Optional) View database in Prisma Studio
npx prisma studio
```

### 5. Start the Server

```bash
# Development mode with hot reload
npm run dev

# Server runs on http://localhost:5001
```

---

## API Reference

### SAM.gov Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sam/ping` | Health check |
| GET | `/api/sam/opportunities/current` | Fetch current opportunities |
| GET | `/api/sam/opportunities/historical` | Fetch historical opportunities |
| GET | `/api/sam/opportunities/event` | Fetch industry day events |
| GET | `/api/sam/opportunities/:noticeId/description` | Fetch opportunity description |

#### Query Parameters (SAM.gov)

| Parameter | Default | Description |
|-----------|---------|-------------|
| `page` | - | Page number (SAM.gov pagination) |
| `limit` | `1000` | Records per page (max: 1000) |
| `fullSync` | `false` | Fetch all pages automatically |
| `maxPages` | `10` | Max pages to fetch when fullSync=true |
| `cacheInDB` | `true` | Save results to database |
| `postedFrom` | - | Filter by posted date (MM/DD/YYYY) |
| `postedTo` | - | Filter by posted date end |

#### Examples

```bash
# Fetch page 1 with 500 records
GET /api/sam/opportunities/current?page=1&limit=500&postedFrom=01/01/2024

# Full sync (all pages, save to DB)
GET /api/sam/opportunities/current?fullSync=true&maxPages=5&cacheInDB=true

# Preview only (don't save to DB)
GET /api/sam/opportunities/current?cacheInDB=false&postedFrom=01/01/2024

# Fetch opportunity description and cache it
GET /api/sam/opportunities/abc123/description?cache=true
```

### USASpending.gov Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/usaspending/ping` | Health check |
| POST | `/api/usaspending/awards/search` | Search awards |
| POST | `/api/usaspending/awards/count` | Get award counts |
| POST | `/api/usaspending/awards/category` | Search by category |
| GET | `/api/usaspending/awards/:award_id` | Get award by ID |

---

## Current Project Goals

**Primary Objective (Current):**

* Enable **identification and pursuit of direct federal buying paths**, especially:

  * GPC / micro-purchases (<$10K)
  * Base-level buyers (MWR, FSS, units)
  * Prime contractor subcontracting

**Near-Term Outcomes:**

* Centralize outreach tracking
* Standardize internal workflows for federal sales activity
* Support decision-making with clean, structured data

---

## Project Structure

```
SupplyTigerGOA/
├── README.md
├── backend/
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   └── migrations/        # Database migrations
│   └── src/
│       ├── server.js          # Express server entry point
│       ├── config/
│       │   ├── db.js          # Prisma client
│       │   └── env.js         # Environment variables
│       ├── controllers/
│       │   ├── sam.controller.js         # SAM.gov API logic
│       │   └── USASpending.controller.js # USASpending API logic
│       ├── routes/
│       │   ├── sam.routes.js
│       │   └── USASpending.routes.js
│       └── utils/
│           ├── extractSAM.js      # SAM data extraction helpers
│           ├── normalizeSAM.js    # SAM data normalization
│           └── globals.js         # Shared constants
└── frontend/                      # (Coming soon)
```

At a high level, the project is organized around three functional layers:

### 1. Data Ingestion

* Pulls opportunity and event data from SAM.gov and USASpending.gov
* Normalizes inconsistent government data
* Stores raw + cleaned payloads for auditability
* Supports pagination for large datasets

### 2. Opportunity & Outreach Tracking

* Tracks:
  * Opportunities (Solicitations, Awards, etc.)
  * Industry Days
  * Contacts (points of contact from opportunities)
  * Recipients/Awardees
  * Outreach status (new, contacted, responded, qualified, dead)
* Designed to work in tandem with **manual outreach** as a tool.

### 3. Internal Workflow Support

* Enables the team to:
  * Decide *who to contact*
  * Decide *how to contact them*
  * Avoid duplicate or wasted effort
* Acts as a lightweight directory tailored specifically to federal sales

---

## Database Schema

Key models in the Prisma schema:

| Model | Description |
|-------|-------------|
| **Opportunity** | Government opportunities from SAM.gov |
| **IndustryDay** | Industry day events linked to opportunities |
| **Contact** | Points of contact extracted from opportunities |
| **ContactLink** | Links contacts to opportunities with role info |
| **Award** | Contract awards |
| **Recipient** | Award recipients/contractors (by UEI) |

---

## Future Features (Planned / Under Consideration)

* Enhanced opportunity scoring (speed, size, friction)
* Prime contractor intelligence & relationship tracking via an MCP Server
* Quote / follow-up templates tied to opportunity records
* GSA Advantage listing support
* Light analytics (response rates, conversion paths)
* Background job processing with Inngest for:
  * Daily SAM.gov sync
  * Batch description fetching
  * Clerk user sync on signup

---

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Run tests and ensure the server starts
4. Submit a pull request

---

## Status

**Active development**

---

## License

ISC
