import { Inngest } from "inngest";
import {ENV } from "../config/env.js";

// Initialize Inngest with your account's unique identifier to link events and functions
export const inngest = new Inngest({
  name: "SupplyTigerGOA Inngest Client",
  id: ENV.INNGEST_ID,
});

export const functions = [];