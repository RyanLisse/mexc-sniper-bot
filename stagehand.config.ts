import { ConstructorParams } from "@browserbasehq/stagehand";

const config: ConstructorParams = {
  env: process.env.STAGEHAND_ENV === "BROWSERBASE" ? "BROWSERBASE" : "LOCAL",
  apiKey: process.env.BROWSERBASE_API_KEY,
  projectId: process.env.BROWSERBASE_PROJECT_ID,
  verbose: process.env.STAGEHAND_VERBOSE === "true" ? 2 : 0,
  modelName: process.env.STAGEHAND_MODEL || "gpt-4o-mini",
  modelClientOptions: {
    apiKey: process.env.OPENAI_API_KEY || "",
  },
  enableCaching: process.env.STAGEHAND_CACHE !== "false",
  domSettleTimeoutMs: parseInt(process.env.STAGEHAND_TIMEOUT || "30000"),
  ...(process.env.BROWSERBASE_PROJECT_ID && {
    browserbaseSessionCreateParams: {
      projectId: process.env.BROWSERBASE_PROJECT_ID,
    },
  }),
};

export default config;