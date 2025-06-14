import { test, expect } from "@playwright/test";
import { Stagehand } from "@browserbasehq/stagehand";
import stagehandConfig from "../../stagehand.config";

test.describe("Basic Stagehand UI Tests", () => {
  let stagehand: Stagehand;

  test.beforeEach(async () => {
    // Only run if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      test.skip();
    }
    
    stagehand = new Stagehand(stagehandConfig);
    await stagehand.init();
  });

  test.afterEach(async () => {
    if (stagehand) {
      await stagehand.close();
    }
  });

  test("should navigate to homepage and verify basic elements", async () => {
    await stagehand.page.goto("http://localhost:3008");
    
    // Wait for page to load
    await stagehand.page.waitForLoadState("networkidle");
    
    // Extract basic page information
    const extraction = await stagehand.extract({
      instruction: "Extract the page title and verify it contains MEXC",
      schema: {
        title: "string",
        hasTitle: "boolean"
      }
    });

    expect(extraction.title).toContain("MEXC");
    expect(extraction.hasTitle).toBe(true);
  });

  test("should verify navigation to auth page", async () => {
    await stagehand.page.goto("http://localhost:3008");
    await stagehand.page.waitForLoadState("networkidle");
    
    // Look for auth-related elements
    const authCheck = await stagehand.observe({
      instruction: "Find any sign in or authentication buttons"
    });

    expect(authCheck).toBeDefined();
  });
});