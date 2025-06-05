import { inngest } from "@/inngest/client";
import { generateNewsletter } from "@/inngest/functions";
import { serve } from "inngest/next";

// Export HTTP handlers for Inngest API (including PUT for syncing)
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateNewsletter],
});
