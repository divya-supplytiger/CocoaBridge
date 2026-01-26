import express from "express";
import axios from "axios";
import { ENV } from "../config/env.js";
import { matchesOpportunityIndustryDay, matchesOpportunitySolicitation, matchesOpportunityHistorical } from "../utils/filter.js";

// todo: implement SAM routes
// (TIDY todo): port over routes to controllers instead of having logic in routes files
// Fields of interest:
/**
 * Total Records:
 * Notice Id:
 * Limit:
 * Title:
 * type:
 * baseType:
 * Solicitation Number:
 * Department:
 * Subtier:
 * Office:
 * postedDate:
 * rtpe:
 * responseDeadline:
 * naicsCode:
 * Classification Code:
 * active: true/false
 * data.award,
 * data.award.awardee
 * pointofcontact
 * description
 * organizationType
 * officeAddress
 * placeOfPerformance
 * links
 */
const router = express.Router();

// PING endpoint for testing
router.get("/ping", (req, res) => {
  console.log("SAM PING HIT", req.body);
  return res.status(200).json({ ok: true, body: req.body });
});

router.get("/opportunities/current", async (req, res) => {
  try {

        const { query } = req;

            const response = await axios.get(ENV.SAMGOV_BASE_URL, {
              params: {
                api_key: ENV.SAMGOV_API_KEY,
                ...query,
              },
              timeout: 50000,
            });

        const data = response.data;

        const opportunities =
          data.response?.opportunitiesData ||
          data?.opportunitiesData ||
          data?.opportunities ||
          data?.data ||
          [];

        const filteredOpportunities = opportunities.filter(
          matchesOpportunitySolicitation,
        );

        return res.status(200).json({
          meta: {
            pulled: opportunities.length,
            returned: filteredOpportunities.length,
          },
          data: {
            opportunities: filteredOpportunities,
          },
        });

  } catch (error) {

        console.error("Error in getCurrentOpportunities controller:", error);
        res.status(500).json({
          error: "Internal Server Error -- failed to fetch data from SAM.gov",
          details: error?.response?.data,
        });
  }
});

// get opportunities from SAM.gov by year, then get more specific with filters later
router.get("/opportunities/historical", async (req, res) => {
  try {
    const { query } = req;

    console.log(ENV.SAMGOV_BASE_URL);
    const response = await axios.get(ENV.SAMGOV_BASE_URL, {
      params: {
        api_key: ENV.SAMGOV_API_KEY,
        ...query,
      },
      timeout: 50000,
    });

    return res.status(200).json({ response: response.data });
        
    
  } catch (error) {
    console.error("Error in getHistoricalOpportunities controller:", error);
    res
      .status(500)
      .json({
        error: "Internal Server Error -- failed to fetch data from SAM.gov",
        details: error?.response?.data,
      });
  }
});

// This endpoint fetches opportunities and filters them based on criteria
// The current criteria are defined in the matchesOpportunity function

// TODO: account for variables
router.get("/opportunities/event", async (req, res) => {
  try {
    const { query } = req;

    const response = await axios.get(ENV.SAMGOV_BASE_URL, {
      params: {
        api_key: ENV.SAMGOV_API_KEY,
        ...query,
      },
      timeout: 50000,
    });
    const data = response.data;

    const opportunities = 
    data.response?.opportunitiesData ||
    data?.opportunitiesData ||
    data?.opportunities ||
    data?.data ||
     [];

     const filteredOpportunities = opportunities.filter(
       matchesOpportunityIndustryDay,
     );
     return res.status(200).json({
      meta: {
        pulled: opportunities.length,
        returned: filteredOpportunities.length,
      },
      data: {
        opportunities: filteredOpportunities,
      }
     })
  } catch (error) {
    console.error("Error in getIndustryDayOpportunities controller: ", error);
    res.status(500).json({
      error: "Internal Server Error -- failed to fetch data from SAM.gov",
      details: error?.response?.data,
    });
  }
});


// TODO: Cache into db --> 
// description: https://api.sam.gov/prod/opportunities/v1/noticedesc?noticeid=ab59e24aa7a143378601cee95947dd64&api_key=YOUR_API_KEY
// and capture details that match our criteria

export default router;
