import { Inngest } from "inngest";

// Initialize the Inngest client for MEXC Sniper Bot
export const inngest = new Inngest({
  id: "mexc-sniper-bot",
  name: "MEXC Sniper Bot - AI Trading Platform",
  eventKey: process.env.INNGEST_EVENT_KEY || "dev_key_for_local_development",
});
