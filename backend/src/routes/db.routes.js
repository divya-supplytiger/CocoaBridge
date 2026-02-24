import express from "express";
import { protectRoute, adminOnly, readOnlyOrAbove } from "../middleware/auth.middleware.js";
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
  listContacts,
  getContact,
} from "../controllers/db.controller.js";

export const router = express.Router();

// Health check (no data — all authenticated users can ping)
router.get("/ping", ...protectRoute, (_req, res) => res.json({ ok: true }));

// Current authenticated user's DB profile (all roles can access)
router.get("/me", ...protectRoute, (req, res) => res.json(req.user));

// InboxItems
router.get("/inbox-items", ...protectRoute, readOnlyOrAbove, listInboxItems);
router.get("/inbox-items/:id", ...protectRoute, readOnlyOrAbove, getInboxItem);
router.patch("/inbox-items/:id", ...protectRoute, adminOnly, updateInboxItem);
router.delete("/inbox-items/:id", ...protectRoute, adminOnly, deleteInboxItem);

// Opportunities
router.get("/opportunities", ...protectRoute, readOnlyOrAbove, listOpportunities);
router.get("/opportunities/:id", ...protectRoute, readOnlyOrAbove, getOpportunity);
// TODO: delete opportunity

// Awards
router.get("/awards", ...protectRoute, readOnlyOrAbove, listAwards);
router.get("/awards/:id", ...protectRoute, readOnlyOrAbove, getAward);
// TODO: delete award

// Industry Days
router.get("/industry-days", ...protectRoute, readOnlyOrAbove, listIndustryDays);
router.get("/industry-days/:id", ...protectRoute, readOnlyOrAbove, getIndustryDay);
router.patch("/industry-days/:id", ...protectRoute, adminOnly, updateIndustryDay);
// TODO: delete industry day, create industry day

// Buying Organizations
router.get("/buying-orgs", ...protectRoute, readOnlyOrAbove, listBuyingOrgs);
router.get("/buying-orgs/:id", ...protectRoute, readOnlyOrAbove, getBuyingOrg);

// Contacts
router.get("/contacts", ...protectRoute, readOnlyOrAbove, listContacts);
router.get("/contacts/:id", ...protectRoute, readOnlyOrAbove, getContact);
