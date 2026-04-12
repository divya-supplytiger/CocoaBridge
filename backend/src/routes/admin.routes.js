import express from "express";
import { protectRoute, adminOnly } from "../middleware/auth.middleware.js";
import {
  listUsers,
  updateUser,
  getSystemHealth,
  triggerSync,
  getDbStats,
  getFilterConfig,
  getPublicConfig,
  updateFilterConfig,
  getCompanyProfile,
  updateCompanyProfile,
  getParsedDocumentStats,
  listParsedDocuments,
  getCleanupDbPreview,
} from "../controllers/admin.controller.js";

export const router = express.Router();

// User management
router.get("/users", ...protectRoute, adminOnly, listUsers);
router.patch("/users/:id", ...protectRoute, adminOnly, updateUser);

// System health
router.get("/system-health", ...protectRoute, adminOnly, getSystemHealth);

// DB stats
router.get("/stats", ...protectRoute, adminOnly, getDbStats);

// Manual sync triggers — type: sam-opportunities | usaspending-awards | sam-descriptions | sam-industry-days
router.post("/sync/:type", ...protectRoute, adminOnly, triggerSync);

// Filter configuration
router.get("/config/public", ...protectRoute, getPublicConfig);
router.get("/config", ...protectRoute, adminOnly, getFilterConfig);
router.put("/config/:key", ...protectRoute, adminOnly, updateFilterConfig);

// Company Profile
router.get("/company-profile", ...protectRoute, adminOnly, getCompanyProfile);
router.put("/company-profile", ...protectRoute, adminOnly, updateCompanyProfile);

// Parsed Documents (OpportunityAttachment)
router.get("/parsed-documents/stats", ...protectRoute, adminOnly, getParsedDocumentStats);
router.get("/parsed-documents", ...protectRoute, adminOnly, listParsedDocuments);

// Cleanup DB — preview count before running
router.get("/cleanup-db/preview", ...protectRoute, adminOnly, getCleanupDbPreview);
