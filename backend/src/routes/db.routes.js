import express from "express";
import { protectRoute, adminOnly, readOnlyOrAbove } from "../middleware/auth.middleware.js";
import {
  getRecipientAnalytics,
  getPscAnalytics,
  getNaicsAnalytics,
  getAgencyAnalytics,
} from "../controllers/analytics.controller.js";
import {
  listInboxItems,
  getInboxItem,
  createInboxItem,
  updateInboxItem,
  deleteInboxItem,
  listOpportunities,
  getOpportunity,
  deleteOpportunity,
  listAwards,
  getAward,
  deleteAward,
  listIndustryDays,
  getIndustryDay,
  updateIndustryDay,
  listBuyingOrgs,
  getBuyingOrg,
  updateBuyingOrg,
  listRecipients,
  getRecipient,
  updateRecipient,
  listContacts,
  getContact,
  updateContact,
  deleteContact,
  listFavorites,
  toggleFavorite,
  listFLISItems,
  getFLISItem,
  parseAttachment,
  saveParsedAttachment,
  getAttachmentText,
  exportOpportunities,
  exportAwards,
  exportContacts,
  exportInboxItems,
} from "../controllers/db.controller.js";

export const router = express.Router();

// Health check (no data — all authenticated users can ping)
router.get("/ping", ...protectRoute, (_req, res) => res.json({ ok: true }));

// Current authenticated user's DB profile (all roles can access)
router.get("/me", ...protectRoute, (req, res) => res.json(req.user));

// InboxItems
router.get("/inbox-items/export", ...protectRoute, readOnlyOrAbove, exportInboxItems);
router.get("/inbox-items", ...protectRoute, readOnlyOrAbove, listInboxItems);
router.get("/inbox-items/:id", ...protectRoute, readOnlyOrAbove, getInboxItem);
router.post("/inbox-items", ...protectRoute, adminOnly, createInboxItem);
router.patch("/inbox-items/:id", ...protectRoute, adminOnly, updateInboxItem);
router.delete("/inbox-items/:id", ...protectRoute, adminOnly, deleteInboxItem);

// Opportunities
router.get("/opportunities/export", ...protectRoute, readOnlyOrAbove, exportOpportunities);
router.get("/opportunities", ...protectRoute, readOnlyOrAbove, listOpportunities);
router.get("/opportunities/:id", ...protectRoute, readOnlyOrAbove, getOpportunity);
router.delete("/opportunities/:id", ...protectRoute, adminOnly, deleteOpportunity);

// Attachment parsing (PDF/DOCX text extraction)
router.post("/attachments/:id/parse", ...protectRoute, readOnlyOrAbove, parseAttachment);
router.post("/attachments/:id/save-parsed", ...protectRoute, readOnlyOrAbove, saveParsedAttachment);
router.get("/attachments/:id/text", ...protectRoute, readOnlyOrAbove, getAttachmentText);

// Awards
router.get("/awards/export", ...protectRoute, readOnlyOrAbove, exportAwards);
router.get("/awards", ...protectRoute, readOnlyOrAbove, listAwards);
router.get("/awards/:id", ...protectRoute, readOnlyOrAbove, getAward);
router.delete("/awards/:id", ...protectRoute, adminOnly, deleteAward);

// Industry Days
router.get("/industry-days", ...protectRoute, readOnlyOrAbove, listIndustryDays);
router.get("/industry-days/:id", ...protectRoute, readOnlyOrAbove, getIndustryDay);
router.patch("/industry-days/:id", ...protectRoute, adminOnly, updateIndustryDay);
// TODO: delete industry day, create industry day

// Buying Organizations
router.get("/buying-orgs", ...protectRoute, readOnlyOrAbove, listBuyingOrgs);
router.get("/buying-orgs/:id", ...protectRoute, readOnlyOrAbove, getBuyingOrg);
router.patch("/buying-orgs/:id", ...protectRoute, adminOnly, updateBuyingOrg);

// Recipients
router.get("/recipients", ...protectRoute, readOnlyOrAbove, listRecipients);
router.get("/recipients/:id", ...protectRoute, readOnlyOrAbove, getRecipient);
router.patch("/recipients/:id", ...protectRoute, adminOnly, updateRecipient);

// FLIS Items
router.get("/flis-items", ...protectRoute, readOnlyOrAbove, listFLISItems);
router.get("/flis-items/:id", ...protectRoute, readOnlyOrAbove, getFLISItem);

// Contacts
router.get("/contacts/export", ...protectRoute, readOnlyOrAbove, exportContacts);
router.get("/contacts", ...protectRoute, readOnlyOrAbove, listContacts);
router.get("/contacts/:id", ...protectRoute, readOnlyOrAbove, getContact);
router.patch("/contacts/:id", ...protectRoute, adminOnly, updateContact);
router.delete("/contacts/:id", ...protectRoute, adminOnly, deleteContact);

// Favorites
router.get("/favorites", ...protectRoute, readOnlyOrAbove, listFavorites);
router.post("/favorites", ...protectRoute, readOnlyOrAbove, toggleFavorite);

// Analytics
router.get("/analytics/recipients", ...protectRoute, readOnlyOrAbove, getRecipientAnalytics);
router.get("/analytics/psc",        ...protectRoute, readOnlyOrAbove, getPscAnalytics);
router.get("/analytics/naics",      ...protectRoute, readOnlyOrAbove, getNaicsAnalytics);
router.get("/analytics/agencies",   ...protectRoute, readOnlyOrAbove, getAgencyAnalytics);
