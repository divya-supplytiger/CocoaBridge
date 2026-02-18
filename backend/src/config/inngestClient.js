import { Inngest } from "inngest";
import { ENV } from "./env.js";

// Shared Inngest client used by both emitters and function handlers.
export const inngestClient = new Inngest({
  name: "SupplyTigerGOA Inngest Client",
  id: ENV.INNGEST_ID,
});

export const emitInternalEventSafe = async (name, data) => {
  try {
    await inngestClient.send({ name, data });
  } catch (error) {
    console.error(`[Inngest] Failed to emit ${name}:`, error?.message ?? error);
  }
};