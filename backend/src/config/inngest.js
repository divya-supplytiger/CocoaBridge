import {
  AcquisitionPath,
  OppTag,
  Type,
} from "@prisma/client";
import prisma from "./db.js";
import { inngestClient } from "./inngestClient.js";
import {
  createUser,
  updateUser,
  deleteUser,
  changeExpiredOpportunitiesToInactive,
  runBackfillNullOpportunityDescriptionsFromSam,
} from "../controllers/db.controller.js";
import { runCurrentOpportunitiesSyncFromSam } from "../controllers/sam.controller.js";
import { runAwardsSyncFromUsaspending } from "../controllers/usaspending.controller.js";

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
      },
    });

    return {
      ok: true,
      inboxItemId: inboxItem.id,
      source,
      awardId: data.awardId,
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
    const result = await changeExpiredOpportunitiesToInactive();
    return {
      success: true,
      ...result,
    };
  },
);

export const getOpportunityDescriptionsFromSamDaily = inngest.createFunction(
  {
    id: "get-opportunity-descriptions-from-sam-daily",
    name: "Get Opportunity Descriptions from SAM Daily",
    description: "Cron job to update null opportunity descriptions from SAM.gov every day at 12:30 AM EST",
  
  },
  { cron: "30 5 * * *" }, // Every day at 12:30am EST (5:30am UTC) --- after the sync job runs to give it time to update the db with new opportunities
  async () => {
    const result = await runBackfillNullOpportunityDescriptionsFromSam();
    return {
      success: true,
      ...result,
    };
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
    const result = await runCurrentOpportunitiesSyncFromSam();
    return {
      synced: true,
      ...result,
    };
  },
);

// TODO: SYNC OPPORTUNITIES FROM SAM.GOV TO DB (Industry Day Opportunities)

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
    const result = await runAwardsSyncFromUsaspending();
    return {
      synced: true,
      ...result,
    };
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
  syncAwardsFromUsaspendingBiWeekly,
];
