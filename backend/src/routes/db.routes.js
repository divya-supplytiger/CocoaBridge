import express from "express";
import { protectRoute, adminOnly } from "../middleware/auth.middleware.js";
import {
  listInboxItems,
  getInboxItem,
  updateInboxItem,
  deleteInboxItem,
  listOpportunities,
  getOpportunity,
  listAwards,
  getAward,
  listIndustryDays,
  getIndustryDay,
  updateIndustryDay,
  listBuyingOrgs,
  getBuyingOrg,
} from "../controllers/db.controller.js";

export const router = express.Router();

// Health check
router.get("/ping", ...protectRoute, (_req, res) => res.json({ ok: true }));

// InboxItems
router.get("/inbox-items", ...protectRoute, listInboxItems);
router.get("/inbox-items/:id", ...protectRoute, getInboxItem);
router.patch("/inbox-items/:id", ...protectRoute, adminOnly, updateInboxItem);
router.delete("/inbox-items/:id", ...protectRoute, adminOnly, deleteInboxItem);

// Opportunities
router.get("/opportunities", ...protectRoute, listOpportunities);
router.get("/opportunities/:id", ...protectRoute, getOpportunity);
// TODO: delete opportunity

// Awards
router.get("/awards", ...protectRoute, listAwards);
router.get("/awards/:id", ...protectRoute, getAward);
// TODO: delete award

// Industry Days
router.get("/industry-days", ...protectRoute, listIndustryDays);
router.get("/industry-days/:id", ...protectRoute, getIndustryDay);
router.patch("/industry-days/:id", ...protectRoute, adminOnly, updateIndustryDay);
// TODO: delete industry day, create industry day

// Buying Organizations
router.get("/buying-orgs", ...protectRoute, listBuyingOrgs);
router.get("/buying-orgs/:id", ...protectRoute, getBuyingOrg);

// TODO: Contacts, Recipients
