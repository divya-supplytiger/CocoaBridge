import express from "express";
import axios from "axios";
import { ENV } from "../config/env.js";

const router = express.Router();
// todo: implement USAspending routes
// (TIDY todo): port over routes to controllers instead of having logic in routes files
// Endpoints: 

/** 
 * PING endpoint for testing
 */
router.post("/ping", (req, res) => {
  console.log("USASPENDING PING HIT", req.body);
  return res.status(200).json({ ok: true, body: req.body });
});

// Endpoint A: /api/v2/search/spending_by_award/
/*
 * POST /api/usaspending/search-award
 * Body is passed directly to USAspending Advanced Search
 *
 * Example body:
{
    "filters": {
      "time_period": [
        {
          "start_date": "2007-10-01",
          "end_date": "2026-09-30"
        }
      ],
      "award_type_codes": [
        "A",
        "B",
        "C"
      ],
      "naics_codes": [
        "424450", "424490"
      ],
      "psc_codes": {
        "require": [
          [
            "Product",
            "89",
            "8925"
          ]
        ]
      }
    },
    "page": 1,
    "limit": 100,
    "sort": "End Date",
    "order": "desc",
    "auditTrail": "Results Table - Spending by award search",
    "fields": [
      "Award ID",
      "Recipient Name",
      "Award Amount",
      "Description",
      "Contract Award Type",
      "Recipient UEI",
      "Recipient Location",
      "Primary Place of Performance",
      "def_codes",
      "Awarding Agency",
      "Awarding Sub Agency",
      "Start Date",
      "End Date",
      "NAICS",
      "PSC",
      "recipient_id",
      "prime_award_recipient_id"
    ],
    "spending_level": "awards"
  }
*/
// TODO: Pagination params?
router.post("/search-award", async (req, res) => {
  try {
    // console.log("Incoming body:", req.body);
    // console.log("Incoming fields:", req.body?.fields);

    const response = await axios.post(
      `${ENV.USASPENDING_BASE_URL}/api/v2/search/spending_by_award/`,
      {
        ...req.body,
        limit: req.body.limit ?? 100,
        page: req.body.page ?? 1,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 20000,
      },
    );

    return res.status(200).json({
      count: response.data.page_metadata?.total || 0,
      data: response.data.results,
    });
  } catch (error) {
    console.error("USAspending API error:", error?.response?.data || error);

    res.status(500).json({
      error: "Failed to fetch data from USAspending",
      details: error?.response?.data,
    });
  }
});

// Endpoint B: /api/v2/search/spending_by_award_count/
/* 
 * POST /api/usaspending/search-count
 * /
 * Example Body:
 * {
 *   "filters": {
 *     "time_period": [
 *       { "start_date": "2007-10-01", "end_date": "2026-09-30" }
 *     ],
 *     "naics_codes": ["424450", "424490"],
 *     "psc_codes": ["8925"],
 *     "award_type_codes": ["A", "B", "C"] // optional
 *   },
 *   "spending_level": "awards" // optional; defaults to awards
 * }
 *
 */
router.post("/search-count", async (req, res) => {
  try {
    const response = await axios.post(
      `${ENV.USASPENDING_BASE_URL}/api/v2/search/spending_by_award_count/`,
      { ...req.body },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 20000,
      }
    );
    return res.status(200).json({ data: response.data });
  } catch (error) {
    console.error("USAspending API error:", error?.response?.data || error);
    res.status(500).json({
      error: "Failed to fetch data from USAspending",
      details: error?.response?.data,
    });
  }
});

// Endpoint C: /api/v2/search/spending_by_category/
/* 
 * POST /api/usaspending/search-category
 * / 
 * 
 * Purpose:
 * - Returns aggregated spending grouped by a specific category
 * - Used for geographic, organizational, and categorical analysis
 * - Supports high-level market sizing and trend exploration
 * 
 *  Notes:
 * - `category` is removed from the payload and used in the URL path
 * - Filters follow the standard USAspending Advanced Search schema
 * - Response is returned verbatim from USAspending
 * 
 * Example Body:
 * {
 *   "category": "state_territory",
 *   "filters": {
 *     "time_period": [
 *       { "start_date": "2019-09-28", "end_date": "2020-09-28" }
 *     ],
 *     "naics_codes": ["424450"],        // optional
 *     "psc_codes": ["8925"]             // optional
 *   },
 *   "spending_level": "transactions",   // or "awards" (default)
 *   "limit": 100,
 *   "page": 1
 * }
 * 
 * 
 * */

router.post("/search-category", async (req, res) => {
  try {
    const category = req.body.category;
    const url = `${ENV.USASPENDING_BASE_URL}/api/v2/search/spending_by_category/${category}/`;

    // remove category from payload since using category-in-path
    const { category: _omit, ...payload } = req.body;

    const response = await axios.post(
      url,
      { ...payload, limit: req.body.limit ?? 100, page: req.body.page ?? 1 },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 20000,
      },
    );
    return res.status(200).json({ data: response.data });
  } 
 catch (error) {
    console.error("USAspending API error:", error?.response?.data || error);
    res.status(500).json({
      error: "Failed to fetch data from USAspending",
      details: error?.response?.data,
    });
  }
});

// Endpoint D: /api/v2/awards/{award_id}/
router.get("/award/:award_id", async (req, res) => {
  try {
    const { award_id } = req.params;
    const response = await axios.get(
      `${ENV.USASPENDING_BASE_URL}/api/v2/awards/${award_id}/`,
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 20000,
      },
    );
    return res.status(200).json({ data: response.data });
  } catch (error) {
    console.error("USAspending API error:", error?.response?.data || error);
    res.status(500).json({
      error: "Failed to fetch data from USAspending",
      details: error?.response?.data,
    });
  }
});

// Optional Endpoint (add if needed):
// Endpoint E: /api/v2/agency/<TOPTIER_AGENCY_CODE>/sub_agency/


export default router;
