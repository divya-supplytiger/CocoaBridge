import { OppTag, Type, AcquisitionPath } from "@prisma/client";
import prisma from "./db.js";
import { inngestClient } from "./inngestClient.js";
import {
  createUser,
  updateUser,
  deleteUser,
  changeExpiredOpportunitiesToInactive,
  runBackfillNullOpportunityDescriptionsFromSam,
  runBackfillOpportunityAttachments,
  markPastIndustryDays,
  scoreAttachment,
  runScoreAllParsedAttachments,
} from "../controllers/db.controller.js";
import { runCurrentOpportunitiesSyncFromSam, runIndustryDaySyncFromSam } from "../controllers/sam.controller.js";
import { runAwardsSyncFromUsaspending } from "../controllers/usaspending.controller.js";
import { withSyncLog } from "../controllers/admin.controller.js";
import { runScoreNewOpportunityAttachments, runCleanupExpiredScoringQueue, scoreOpportunityForInbox, scoreAwardForInbox } from "../utils/inboxScoring.js";
import { loadFilterConfig } from "../utils/filterConfig.js";
import { FLIS_PSC } from "../utils/globals.js";

// Public export consumed by server route registration.
export const inngest = inngestClient;

// Every time a new user is created in Clerk, sync them to our database
const syncUser = inngest.createFunction(
  {
    id: "sync-user-to-db",
    name: "Sync New User",
    description: "Sync new users to the database from Clerk",
  },
  { event: "clerk/user.created" },
    async ({ event }) => {
        console.log("{DEBUG} New user created event received:", event);
        await createUser(event);
    }
);

// Every time a user is updated in Clerk, update them in our database
const updateUserInDB = inngest.createFunction(
  {
    id: "update-user-in-db",
    name: "Update User",
    description: "Update user in the database when updated in Clerk",
  },
  { event: "clerk/user.updated" },
  async ({ event }) => {
    console.log("{DEBUG} User updated event received:", event);
    await updateUser(event);
  }
);

const deleteUserInDB = inngest.createFunction(
  {
    id: "delete-user-in-db",
    name: "Delete User",
    description: "Delete user from the database when deleted in Clerk",
  
  },
  { event: "clerk/user.deleted" },
  async ({ event }) => {
    console.log("{DEBUG} User deleted event received:", event);
    await deleteUser(event);
  }
);

// Converts internal "opportunity upserted" events into a single idempotent InboxItem row.
const upsertInboxItemFromOpportunityEvent = inngest.createFunction(
  {
    id: "upsert-inbox-item-from-opportunity-event",
    name: "Upsert InboxItem from Opportunity Event",
    description:
      "Creates or updates InboxItem for an opportunity using source+opportunityId idempotency",
  },
  { event: "internal/opportunity.upserted" },
  async ({ event }) => {
    const data = event?.data ?? {};

    if (!data?.opportunityId || !data?.source) {
      return {
        skipped: true,
        reason: "Missing source or opportunityId",
      };
    }

    const source = data.source;

    const inboxItem = await prisma.inboxItem.upsert({
      where: {
        source_opportunityId: {
          source,
          opportunityId: data.opportunityId,
        },
      },
      update: {
        acquisitionPath: data.acquisitionPath ?? AcquisitionPath.OPEN_MARKET,
        type: data.type ?? Type.OTHER,
        tag: data.tag ?? OppTag.GENERAL,
        title: data.title ?? null,
        summary: data.summary ?? null,
        buyingOrganizationId: data.buyingOrganizationId ?? null,
      },
      create: {
        source,
        acquisitionPath: data.acquisitionPath ?? AcquisitionPath.OPEN_MARKET,
        type: data.type ?? Type.OTHER,
        tag: data.tag ?? OppTag.GENERAL,
        title: data.title ?? null,
        summary: data.summary ?? null,
        buyingOrganizationId: data.buyingOrganizationId ?? null,
        opportunityId: data.opportunityId,
      },
    });

    return {
      ok: true,
      inboxItemId: inboxItem.id,
      source,
      opportunityId: data.opportunityId,
      op: data.op ?? "UPSERTED",
    };
  },
);

// Converts internal "award upserted" events into a single idempotent InboxItem row.
const upsertInboxItemFromAwardEvent = inngest.createFunction(
  {
    id: "upsert-inbox-item-from-award-event",
    name: "Upsert InboxItem from Award Event",
    description:
      "Creates or updates InboxItem for an award using source+awardId idempotency",
  },
  { event: "internal/award.upserted" },
  async ({ event }) => {
    const data = event?.data ?? {};

    if (!data?.awardId || !data?.source) {
      return {
        skipped: true,
        reason: "Missing source or awardId",
      };
    }

    const source = data.source;

    const award = await prisma.award.findUnique({
      where: { id: data.awardId },
      select: { naicsCodes: true, pscCode: true, description: true, obligatedAmount: true, buyingOrganizationId: true },
    });

    if (!award) {
      return { skipped: true, reason: "Award not found" };
    }

    const { score, matchedSignals, skip } = await scoreAwardForInbox(award);

    if (skip) {
      return { skipped: true, reason: "Score below threshold", score, awardId: data.awardId };
    }

    const inboxItem = await prisma.inboxItem.upsert({
      where: {
        source_awardId: {
          source,
          awardId: data.awardId,
        },
      },
      update: {
        acquisitionPath: data.acquisitionPath ?? AcquisitionPath.OPEN_MARKET,
        type: data.type ?? Type.OTHER,
        tag: data.tag ?? OppTag.GENERAL,
        title: data.title ?? null,
        summary: data.summary ?? null,
        buyingOrganizationId: data.buyingOrganizationId ?? null,
        attachmentScore: score,
        matchedSignals,
      },
      create: {
        source,
        acquisitionPath: data.acquisitionPath ?? AcquisitionPath.OPEN_MARKET,
        type: data.type ?? Type.OTHER,
        tag: data.tag ?? OppTag.GENERAL,
        title: data.title ?? null,
        summary: data.summary ?? null,
        buyingOrganizationId: data.buyingOrganizationId ?? null,
        awardId: data.awardId,
        attachmentScore: score,
        matchedSignals,
      },
    });

    return {
      ok: true,
      inboxItemId: inboxItem.id,
      source,
      awardId: data.awardId,
      score,
      op: data.op ?? "UPSERTED",
    };
  },
);

// CRON JOBS
// Every day at 12:15 AM EST, run a cron job to deactivate expired opportunities
export const deactivateExpiredOpportunitiesDaily = inngest.createFunction(
  {
    id: "deactivate-expired-opportunities-daily",
    name: "Deactivate Expired Opportunities Daily",
    description: "Cron job to deactivate expired opportunities every day at 12:15 AM EST",
  },
  { cron: "15 5 * * *" }, // Every day at 12:15 AM EST (5:15 am UTC)
  async () => {
    return await withSyncLog(
      "deactivate-expired-opportunities",
      "Deactivate Expired Opportunities",
      () => changeExpiredOpportunitiesToInactive(),
      (r) => r?.count ?? null,
    );
  },
);

export const getOpportunityDescriptionsFromSamDaily = inngest.createFunction(
  {
    id: "get-opportunity-descriptions-from-sam-daily",
    name: "Get Opportunity Descriptions from SAM Daily",
    description: "Cron job to update null opportunity descriptions from SAM.gov every day at 12:30 AM EST",
  },
  { cron: "30 5 * * *" }, // Every day at 12:30am EST (5:30am UTC)
  async () => {
    return await withSyncLog(
      "backfill-opportunity-descriptions",
      "Backfill Opportunity Descriptions",
      () => runBackfillNullOpportunityDescriptionsFromSam(),
      (r) => r?.results?.updated ?? null,
      (r) => {
        const n = r?.results?.failed ?? 0;
        return n > 0 ? `${n} description fetch error(s)` : null;
      },
    );
  },
);

export const syncCurrentSamOpportunitiesDaily = inngest.createFunction(
  {
    id: "sync-current-sam-opportunities-daily",
    name: "Sync Current SAM Opportunities Daily",
    description:
      "Daily cron to sync SAM current opportunities to the database every day at 12:00 AM EST",
  },
  { cron: "0 5 * * *" }, // 12:00am EST / 5:00am UTC
  async () => {
    return await withSyncLog(
      "sync-current-sam-opportunities",
      "Sync SAM Opportunities",
      () => runCurrentOpportunitiesSyncFromSam(),
      (r) => r?.db?.upserted ?? null,
      (r) => {
        const msg = [];
        if (r?.meta?.partial) msg.push("incomplete fetch (SAM.gov 504 errors)");
        const dbErrors = r?.db?.errors?.length ?? 0;
        if (dbErrors > 0) msg.push(`${dbErrors} opportunity upsert error(s)`);
        return msg.length > 0 ? msg.join("; ") : null;
      },
    );
  },
);

// Daily sync of industry day opportunities from SAM.gov to DB
export const syncIndustryDaysFromSamDaily = inngest.createFunction(
  {
    id: "sync-industry-days-from-sam-daily",
    name: "Sync Industry Days from SAM Daily",
    description:
      "Daily cron to sync SAM industry day opportunities to the database every day at 12:45 AM EST",
  },
  { cron: "45 5 * * *" }, // 12:45am EST / 5:45am UTC
  async () => {
    return await withSyncLog(
      "sync-sam-industry-days",
      "Sync SAM Industry Days",
      () => runIndustryDaySyncFromSam(),
      (r) => r?.db?.upserted ?? null,
      (r) => {
        const msg = [];
        if (r?.meta?.partial) msg.push("incomplete fetch (SAM.gov 504 errors)");
        const dbErrors = r?.db?.errors?.length ?? 0;
        if (dbErrors > 0) msg.push(`${dbErrors} industry day upsert error(s)`);
        return msg.length > 0 ? msg.join("; ") : null;
      },
    );
  },
);

// Mark industry days whose event date has passed as PAST_EVENT
export const markPastIndustryDaysDaily = inngest.createFunction(
  {
    id: "mark-past-industry-days-daily",
    name: "Mark Past Industry Days Daily",
    description:
      "Daily cron to mark industry days as PAST_EVENT once their event date has passed, runs at 12:20 AM EST",
  },
  { cron: "20 5 * * *" }, // 12:20am EST / 5:20am UTC
  async () => {
    return await withSyncLog(
      "mark-past-industry-days",
      "Mark Past Industry Days",
      // If there are errors, we want to know how many industry days failed to update, but the error structure can be variable so we defensively check for the length of the errors array in the db result
      () => markPastIndustryDays(),
      (r) => r?.count ?? null,
    );
  },
);

// Sync awards from USASpending every 3 days
export const syncAwardsFromUsaspendingBiWeekly = inngest.createFunction(
  {
    id: "sync-awards-from-usaspending-biweekly",
    name: "Sync USASpending Awards Bi-Weekly",
    description:
      "Cron job to sync awards from USASpending.gov to the database every 3 days at 1:00 AM EST",
  },
  { cron: "0 6 */3 * *" }, // Every 3 days at 1:00am EST (6:00am UTC)
  async () => {
    return await withSyncLog(
      "sync-usaspending-awards",
      "Sync USASpending Awards",
      () => runAwardsSyncFromUsaspending(),
      (r) => {
        if (!r?.presets) return null;
        return Object.values(r.presets).reduce((sum, p) => sum + (p?.upserted ?? 0), 0);
      },
      (r) => {
        const n = Object.values(r?.presets ?? {}).reduce((sum, p) => sum + (p?.db?.errors?.length ?? 0), 0);
        return n > 0 ? `${n} award upsert error(s)` : null;
      },
    );
  },
);

// Daily backfill of attachment metadata from SAM.gov /resources endpoint
export const backfillAttachmentMetadataDaily = inngest.createFunction(
  {
    id: "backfill-attachment-metadata-daily",
    name: "Backfill Attachment Metadata Daily",
    description:
      "Daily cron to fetch attachment metadata for opportunities with resourceLinks, runs at 1:00 AM EST",
  },
  { cron: "0 6 * * *" }, // 1:00 AM EST / 6:00 AM UTC
  async () => {
    return await withSyncLog(
      "backfill-opportunity-attachments",
      "Backfill Attachment Metadata",
      () => runBackfillOpportunityAttachments(),
      (r) => r?.results?.upserted ?? null,
      (r) => {
        const n = r?.results?.failed ?? 0;
        return n > 0 ? `${n} attachment fetch error(s)` : null;
      },
    );
  },
);

// Re-score opportunity using FLIS pipeline when attachment text is saved; update linked InboxItem
const scoreAttachmentOnParsed = inngest.createFunction(
  {
    id: "score-attachment-on-parsed",
    name: "Score Attachment on Parsed",
    description: "Re-runs FLIS inbox scoring when attachment text is saved and updates the linked InboxItem's attachmentScore and matchedSignals",
  },
  { event: "internal/attachment.parsed" },
  async ({ event }) => {
    const { opportunityId } = event?.data ?? {};

    if (!opportunityId) {
      return { skipped: true, reason: "Missing opportunityId" };
    }

    const [filterConfig, flisItems, opportunity] = await Promise.all([
      loadFilterConfig(prisma),
      prisma.federalLogisticsInformationSystem.findMany({
        where: { pscCode: { in: FLIS_PSC } },
        select: { nsn: true, itemName: true, commonName: true },
      }),
      prisma.opportunity.findUnique({
        where: { id: opportunityId },
        select: {
          id: true,
          title: true,
          description: true,
          naicsCodes: true,
          pscCode: true,
          responseDeadline: true,
          buyingOrganizationId: true,
          attachments: {
            select: { id: true, downloadUrl: true, size: true, mimeType: true, name: true, parsedText: true },
          },
        },
      }),
    ]);

    if (!opportunity) {
      return { skipped: true, reason: "Opportunity not found" };
    }

    const { score, matchedSignals } = await scoreOpportunityForInbox(opportunity, flisItems, filterConfig);

    const inboxItem = await prisma.inboxItem.findFirst({
      where: { opportunityId },
      select: { id: true },
    });

    if (!inboxItem) {
      return { skipped: true, reason: "No InboxItem for opportunity", opportunityId, score };
    }

    await prisma.inboxItem.update({
      where: { id: inboxItem.id },
      data: { attachmentScore: score, matchedSignals },
    });

    return { ok: true, opportunityId, score, signalCount: matchedSignals.length };
  },
);

// Weekly batch job to score all parsed attachments that haven't been scored yet
export const scoreAllParsedAttachmentsWeekly = inngest.createFunction(
  {
    id: "score-all-parsed-attachments-weekly",
    name: "Score All Parsed Attachments Weekly",
    description: "Weekly cron to score parsed attachments missing a score result, runs Sundays at 2:00 AM EST",
  },
  { cron: "0 7 * * 0" }, // 2:00 AM EST / 7:00 AM UTC on Sundays
  async () => {
    return await withSyncLog(
      "score-parsed-attachments",
      "Score Parsed Attachments",
      () => runScoreAllParsedAttachments(),
      (r) => r?.results?.scored ?? null,
      (r) => {
        const n = r?.results?.failed ?? 0;
        return n > 0 ? `${n} attachment scoring error(s)` : null;
      },
    );
  },
);

// Daily scoring job: score new PSC-matching opportunities against FLIS + signals
export const scoreNewOpportunityAttachmentsDaily = inngest.createFunction(
  {
    id: "score-new-opportunity-attachments-daily",
    name: "Score New Opportunity Attachments Daily",
    description:
      "Daily cron to score new opportunities matching configured PSC or NAICS codes using FLIS item matching and keyword signals, runs at 1:15 AM EST",
  },
  { cron: "15 6 * * *" }, // 1:15 AM EST / 6:15 AM UTC — after attachment metadata backfill at 1:00 AM
  async () => {
    return await withSyncLog(
      "score-new-opportunity-attachments",
      "Score New Opportunity Attachments",
      () => runScoreNewOpportunityAttachments(),
      (r) => r?.results?.scored ?? null,
      (r) => {
        const n = r?.results?.errors ?? 0;
        return n > 0 ? `${n} scoring error(s)` : null;
      },
    );
  },
);

// Daily cleanup of expired/stale ScoringQueue PENDING items
export const cleanupExpiredScoringQueueDaily = inngest.createFunction(
  {
    id: "cleanup-expired-scoring-queue-daily",
    name: "Cleanup Expired Scoring Queue Daily",
    description: "Daily cron to delete expired PENDING ScoringQueue items, runs at 4:00 AM UTC",
  },
  { cron: "0 4 * * *" }, // Daily at 4:00 AM UTC
  async () => {
    return await withSyncLog(
      "cleanup-expired-scoring-queue",
      "Cleanup Expired Scoring Queue",
      () => runCleanupExpiredScoringQueue(),
      (r) => r?.count ?? null,
    );
  },
);

// Daily cleanup of expired chat conversations (14-day retention)
export const cleanupExpiredChats = inngest.createFunction(
  {
    id: "cleanup-expired-chats",
    name: "Cleanup Expired Chat Conversations",
    description: "Daily cron to delete chat conversations older than 14 days at 3:00 AM UTC",
  },
  { cron: "0 3 * * *" }, // Daily at 3 AM UTC
  async () => {
    const deleted = await prisma.chatConversation.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    return { deletedCount: deleted.count };
  },
);

export const functions = [
  syncUser,
  updateUserInDB,
  deleteUserInDB,
  upsertInboxItemFromOpportunityEvent,
  upsertInboxItemFromAwardEvent,
  deactivateExpiredOpportunitiesDaily,
  syncCurrentSamOpportunitiesDaily,
  getOpportunityDescriptionsFromSamDaily,
  syncIndustryDaysFromSamDaily,
  markPastIndustryDaysDaily,
  syncAwardsFromUsaspendingBiWeekly,
  backfillAttachmentMetadataDaily,
  scoreAttachmentOnParsed,
  scoreAllParsedAttachmentsWeekly,
  scoreNewOpportunityAttachmentsDaily,
  cleanupExpiredScoringQueueDaily,
  cleanupExpiredChats,
];
