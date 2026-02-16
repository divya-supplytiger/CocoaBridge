import { Inngest } from "inngest";
import {ENV } from "../config/env.js";
import { createUser, updateUser, deleteUser } from "../controllers/db.controller.js";

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
export const functions = [syncUser, updateUserInDB, deleteUserInDB];