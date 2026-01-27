# SupplyTiger – Government Outreach Automation Project (SupplyTigerGOA) - v1

## Overview

This project supports **SupplyTiger’s execution-focused expansion into U.S. Federal Government sales**, with a primary emphasis on **micro-purchases, open-market buys, and subcontracting**.

The system is designed to:

* Identify **near-term buying opportunities**
* Track outreach and responses
* Reduce friction between discovery → contact → quote → card swipe

This README represents the **current state** of the project and will be expanded as additional functionality is implemented.

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

## Project Structure (Current)

At a high level, the project is organized around three functional layers:

### 1. Data Ingestion

* Pulls opportunity and event data
* Normalizes inconsistent government data
* Stores raw + cleaned payloads for auditability

### 2. Opportunity & Outreach Tracking

* Tracks:
  * Opportunities (Solicitations, Awards, etc.)
  * Industry Days
  * Outreach status (new, contacted, responded, qualified, dead)
* Designed to work in tandem with **manual outreach** as a tool.

### 3. Internal Workflow Support

* Enables the team to:
  * Decide *who to contact*
  * Decide *how to contact them*
  * Avoid duplicate or wasted effort
* Acts as a lightweight directory tailored specifically to federal sales

---

## Future Features (Planned / Under Consideration)

* Enhanced opportunity scoring (speed, size, friction)
* Prime contractor intelligence & relationship tracking via an MCP Server
* Quote / follow-up templates tied to opportunity records
* GSA Advantage listing support
* Light analytics (response rates, conversion paths)

---

## Status

**Active development**
