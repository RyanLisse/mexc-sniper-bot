import { put } from "@vercel/blob";
import { inngest } from "./client";
// Removed uuid as slug should be unique enough with date and topics

const NEWSLETTER_READ_WRITE_TOKEN =
  process.env.NEWSLETTER_READ_WRITE_TOKEN || "dummy-token-for-build";

// Define data structure for the initial event
interface NewsletterGenerateRequestedData {
  slug: string;
  blobKey: string;
  topics: string[];
}

// Main Inngest function with multi-step workflow
export const generateNewsletter = inngest.createFunction(
  { id: "generate-newsletter" },
  { event: "newsletter/generate.requested" },
  async ({ event, step }: { event: { data: NewsletterGenerateRequestedData }; step: unknown }) => {
    const { topics, slug, blobKey } = event.data;
    if (!topics || !slug || !blobKey) {
      throw new Error("Missing topics, slug, or blobKey in event data.");
    }

    function assertStepHasRun(
      s: unknown
    ): asserts s is { run: (name: string, fn: () => Promise<unknown>) => Promise<unknown> } {
      if (!s || typeof s !== "object" || typeof (s as { run?: unknown }).run !== "function") {
        throw new Error("step.run is not available");
      }
    }
    assertStepHasRun(step);

    // Step 1: Call Python Agent
    const rawAgentContentUnknown = await step.run("call-python-agent", () =>
      callPythonAgent(topics, slug)
    );
    if (typeof rawAgentContentUnknown !== "string") {
      throw new Error("Python agent did not return a string");
    }
    const rawAgentContent = rawAgentContentUnknown;

    // Step 2: Format Newsletter with Markdown Agent
    const formattedContentUnknown = await step.run("format-newsletter", () =>
      formatNewsletter(rawAgentContent, topics, slug)
    );
    if (typeof formattedContentUnknown !== "string") {
      throw new Error("Formatting agent did not return a string");
    }
    const formattedContent = formattedContentUnknown;

    // Step 3: Save Newsletter to Blob
    const finalBlobUnknown = await step.run("save-to-blob", () =>
      saveNewsletterToBlob(blobKey, formattedContent, slug)
    );
    if (
      !finalBlobUnknown ||
      typeof finalBlobUnknown !== "object" ||
      typeof (finalBlobUnknown as { url?: unknown }).url !== "string"
    ) {
      throw new Error("Blob result missing url");
    }
    const finalBlob = finalBlobUnknown as { url: string };

    return { url: finalBlob.url, message: `Newsletter generated and saved for ${slug}` };
  }
);

// --- Step implementations below ---

// Helper function to get the Python agent URL
function getPythonAgentUrl(): string {
  // Use custom APP_URL if set (recommended approach)
  if (process.env.APP_URL) {
    return `${process.env.APP_URL}/api/agents`;
  }

  // For local development
  if (!process.env.VERCEL) {
    return "http://localhost:8000";
  }

  // For production, use the production URL
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/api/agents`;
  }

  // For preview deployments, use branch URL
  if (process.env.VERCEL_BRANCH_URL) {
    return `https://${process.env.VERCEL_BRANCH_URL}/api/agents`;
  }

  // Fallback
  console.warn("[Inngest] No suitable URL found for Python agent, using deployment URL");
  return `https://${process.env.VERCEL_URL}/api/agents`;
}

async function callPythonAgent(topics: string[], slug: string) {
  const pythonAgentUrl = getPythonAgentUrl();

  try {
    const response = await fetch(`${pythonAgentUrl}/research`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ topics }),
    });

    if (!response.ok) {
      console.error(
        `[Inngest] Research agent request failed for slug ${slug}. Status: ${response.status}`
      );
      throw new Error(`Research agent request failed with status ${response.status}`);
    }

    const data = await response.json();
    const content = data.content;

    if (!content) {
      throw new Error("Research agent returned no content");
    }

    return content;
  } catch (error) {
    console.error(`[Inngest] Research agent error for slug ${slug}:`, error);
    throw error;
  }
}

async function formatNewsletter(rawContent: string, topics: string[], slug: string) {
  // Build the appropriate URL based on environment
  let pythonAgentUrl: string;
  if (!process.env.VERCEL) {
    // Local development
    pythonAgentUrl = "http://localhost:8000";
  } else if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    // Production environment - use the production URL
    pythonAgentUrl = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/api/agents`;
  } else if (process.env.VERCEL_BRANCH_URL) {
    // Preview environment - use the branch URL which is more stable than VERCEL_URL
    pythonAgentUrl = `https://${process.env.VERCEL_BRANCH_URL}/api/agents`;
  } else {
    // Fallback to deployment URL if nothing else is available
    pythonAgentUrl = `https://${process.env.VERCEL_URL}/api/agents`;
  }

  try {
    const response = await fetch(`${pythonAgentUrl}/format`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw_content: rawContent,
        topics: topics,
      }),
    });

    if (!response.ok) {
      console.error(
        `[Inngest] Formatting agent request failed for slug ${slug}. Status: ${response.status}`
      );
      throw new Error(`Formatting agent request failed with status ${response.status}`);
    }

    const data = await response.json();
    const content = data.content;

    if (!content) {
      throw new Error("Formatting agent returned no content");
    }

    return content;
  } catch (error) {
    console.error(`[Inngest] Formatting agent error for slug ${slug}:`, error);
    throw error;
  }
}

async function saveNewsletterToBlob(blobKey: string, rawAgentContent: string, slug: string) {
  if (typeof rawAgentContent !== "string") {
    console.error(
      `[Inngest] Invalid content type for slug ${slug}. Expected string, got ${typeof rawAgentContent}`
    );
    throw new Error("Invalid content type from agent for saving to blob.");
  }
  try {
    const blob = await put(blobKey, rawAgentContent, {
      access: "public",
      contentType: "text/markdown",
      token: NEWSLETTER_READ_WRITE_TOKEN,
      allowOverwrite: true,
    });
    return blob;
  } catch (error) {
    console.error(`[Inngest] Error saving to blob for slug ${slug}:`, error);
    throw error;
  }
}
