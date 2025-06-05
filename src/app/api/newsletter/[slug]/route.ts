import { inngest } from "@/inngest/client";
import { head, put } from "@vercel/blob"; // Removed 'del'
import { NextResponse } from "next/server";

const NEWSLETTER_PLACEHOLDER = "__GENERATING_NEWSLETTER_CONTENT__";

interface CachedApiResponse {
  status?: "generating" | "completed" | "error"; // Added 'error' to status
  content?: string;
  source?: "blob" | "cache"; // Source of the content if present
  blobUrl?: string;
  message?: string;
  error?: string;
}

// In-memory cache for API responses
const apiResponseCache = new Map<string, { timestamp: number; data: CachedApiResponse }>();

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!slug) {
    return NextResponse.json({ error: "Slug is required" }, { status: 400 });
  }

  const NEWSLETTER_READ_WRITE_TOKEN = process.env.NEWSLETTER_READ_WRITE_TOKEN;
  if (!NEWSLETTER_READ_WRITE_TOKEN) {
    console.error("NEWSLETTER_READ_WRITE_TOKEN environment variable is not set");
    return NextResponse.json(
      { error: "Server configuration error: NEWSLETTER_READ_WRITE_TOKEN not configured" },
      { status: 500 }
    );
  }

  const blobKey = `newsletters/${slug}.md`;
  // const blobUrl = process.env.BLOB_URL_PREFIX ? `${process.env.BLOB_URL_PREFIX}/${blobKey}` : `/${blobKey}`; // This was unused here, actual blobUrl comes from blob operations

  const cachedApiResponse = apiResponseCache.get(slug);
  if (cachedApiResponse && Date.now() - cachedApiResponse.timestamp < 60000) {
    if (cachedApiResponse.data.status === "generating") {
      return NextResponse.json(cachedApiResponse.data);
    }
  }

  try {
    const existingBlob = await head(blobKey, { token: NEWSLETTER_READ_WRITE_TOKEN }).catch(
      () => null
    );

    if (existingBlob) {
      // Do not fetch blob content server-side. Just return the blob URL and let the client fetch it.
      const responseData: CachedApiResponse = { status: "completed", blobUrl: existingBlob.url };
      apiResponseCache.set(slug, { timestamp: Date.now(), data: responseData });
      return NextResponse.json(responseData);
    }

    let topics: string[] = [];
    const datePattern = /^(\d{4}-\d{2}-\d{2})-/;
    const dateMatch = slug.match(datePattern);
    if (dateMatch?.[1]) {
      const encodedTopicsPart = slug.substring(dateMatch[0].length);
      if (encodedTopicsPart) {
        topics = encodedTopicsPart
          .split("~")
          .map((t) => decodeURIComponent(t.replace(/\+/g, " ")))
          .filter((topic) => topic !== "");
      }
    }
    if (topics.length === 0) {
      return NextResponse.json(
        { error: "No valid topics found in slug for generation." },
        { status: 400 }
      );
    }

    // 2. Create a placeholder blob first, so the client has a URL to poll immediately.
    // The Inngest function will then overwrite this placeholder.
    const placeholderBlob = await put(blobKey, NEWSLETTER_PLACEHOLDER, {
      access: "public",
      contentType: "text/markdown",
      token: NEWSLETTER_READ_WRITE_TOKEN,
    });

    // 3. Trigger the multi-step Inngest workflow
    await inngest.send({
      name: "newsletter/generate.requested", // Changed event name
      data: { topics, slug: slug, blobKey: placeholderBlob.pathname },
    });

    const responseData: CachedApiResponse = {
      status: "generating",
      blobUrl: placeholderBlob.url,
      message: "Newsletter generation initiated.",
    };
    apiResponseCache.set(slug, { timestamp: Date.now(), data: responseData });
    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Error in newsletter API route:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to process newsletter request.";
    return NextResponse.json(
      {
        error: errorMessage,
        status: "error",
        blobUrl: undefined,
        content: undefined,
        source: undefined,
      },
      { status: 500 }
    );
  }
}

// Specify the runtime - Next.js App Router sometimes needs this
export const runtime = "nodejs";
