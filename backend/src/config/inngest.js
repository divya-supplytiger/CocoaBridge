import { Inngest } from "inngest";
import {ENV } from "../config/env.js";
import { createUser, updateUser, deleteUser, changeExpiredOpportunitiesToInactive } from "../controllers/db.controller.js";
import prisma from "./db.js";
// Initialize Inngest with your account's unique identifier to link events and functions
export const inngest = new Inngest({
  name: "SupplyTigerGOA Inngest Client",
  id: ENV.INNGEST_ID,
});

// Every time a new user is created in Clerk, sync them to our database
const syncUser = inngest.createFunction(
  {
    id: "sync-user-to-db",
    name: "Sync New User",
    description: "Sync new users to the database from Clerk",
  },
  { event: "clerk/user.created" },
  // todo: implement function logic
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

// CRON JOBS
// Every day at midnight, run a cron job to deactivate expired opportunities
export const deactivateExpiredOpportunities = inngest.createFunction(
  {
    id: "deactivate-expired-opportunities",
    name: "Deactivate Expired Opportunities",
    description: "Cron job to deactivate expired opportunities every day at midnight",
    cron: "0 5 * * *", // Every day at midnight EST (5 am UTC)
}, {}, async () => {
    await changeExpiredOpportunitiesToInactive();
}
);
export const functions = [syncUser, updateUserInDB, deleteUserInDB, deactivateExpiredOpportunities];