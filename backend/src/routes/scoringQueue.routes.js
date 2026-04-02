import express from "express";
import { protectRoute, adminOnly } from "../middleware/auth.middleware.js";
import {
  listScoringQueue,
  approveScoringQueueItem,
  dismissScoringQueueItem,
  previewManualScore,
  submitManualScore,
} from "../controllers/scoringQueue.controller.js";

export const scoringQueueRouter = express.Router();

scoringQueueRouter.get("/", ...protectRoute, adminOnly, listScoringQueue);
scoringQueueRouter.post("/:id/approve", ...protectRoute, adminOnly, approveScoringQueueItem);
scoringQueueRouter.post("/:id/dismiss", ...protectRoute, adminOnly, dismissScoringQueueItem);

// Manual scoring — mounted under /api/db/opportunities/:id
export const manualScoreRouter = express.Router({ mergeParams: true });
manualScoreRouter.get("/manual-score/preview", ...protectRoute, adminOnly, previewManualScore);
manualScoreRouter.post("/manual-score", ...protectRoute, adminOnly, submitManualScore);
