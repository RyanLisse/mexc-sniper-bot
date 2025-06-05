"use client";

import { markdownComponents } from "@/lib/markdown-components";
import { newsletterStyles } from "@/lib/newsletter-styles";
import { Bot } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const NEWSLETTER_PLACEHOLDER = "__GENERATING_NEWSLETTER_CONTENT__";

// Simple SVG Spinner
const Spinner = () => (
  <svg
    className="animate-spin -ml-1 mr-3 h-8 w-8 text-pink-500"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

// Circular Progress Component
const CircularProgress = ({ progress, size = 24 }: { progress: number; size?: number }) => {
  const radius = (size - 4) / 2;
  const circumference = radius * 2 * Math.PI;
  // Round progress to nearest 20% for chunky animation
  const chunkyProgress = Math.floor(progress / 20) * 20;
  const strokeDashoffset = circumference - (chunkyProgress / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        className="text-pink-900/30"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        className="text-pink-500 transition-all duration-300 ease-in-out"
      />
    </svg>
  );
};

export default function NewsletterPage() {
  const params = useParams();
  const slug = params?.slug as string | undefined;
  const [newsletterContent, setNewsletterContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchNewsletterStatus = useCallback(async () => {
    if (!slug) return;
    setIsLoading(true);
    setError(null);
    setNewsletterContent(null);
    setIsGenerating(false);
    setIsCountingDown(false);
    setCountdown(5);

    // Clear any existing countdown
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    try {
      const res = await fetch(`/api/newsletter/${slug}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `Failed to initiate newsletter generation.`);
      }
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setIsLoading(false);
      } else if (data.status === "generating" && data.blobUrl) {
        setIsGenerating(true);
        setIsLoading(false);
        // Start countdown only if not already running
        if (!countdownIntervalRef.current) {
          setIsCountingDown(true);
          setCountdown(5);
          let secondsElapsed = 0;
          countdownIntervalRef.current = setInterval(() => {
            secondsElapsed += 1;
            setCountdown(5 - secondsElapsed);

            if (secondsElapsed >= 5) {
              // Clear interval and do hard refresh
              if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = null;
              }
              // Hard refresh the entire page
              window.location.reload();
            }
          }, 1000);
        }
      } else if (data.status === "completed" && data.blobUrl) {
        // Fetch the content from the blob URL
        try {
          const blobRes = await fetch(data.blobUrl);
          if (!blobRes.ok) throw new Error("Failed to fetch newsletter content from blob.");
          const content = await blobRes.text();

          // Check if content is still placeholder
          if (content === NEWSLETTER_PLACEHOLDER) {
            setIsGenerating(true);
            setIsLoading(false);
            // Start countdown for placeholder case too, only if not already running
            if (!countdownIntervalRef.current) {
              setIsCountingDown(true);
              setCountdown(5);
              let secondsElapsed = 0;
              countdownIntervalRef.current = setInterval(() => {
                secondsElapsed += 1;
                setCountdown(5 - secondsElapsed);

                if (secondsElapsed >= 5) {
                  // Clear interval and do hard refresh
                  if (countdownIntervalRef.current) {
                    clearInterval(countdownIntervalRef.current);
                    countdownIntervalRef.current = null;
                  }
                  // Hard refresh the entire page
                  window.location.reload();
                }
              }, 1000);
            }
          } else {
            setNewsletterContent(content);
            setIsLoading(false);
          }
        } catch (fetchError) {
          console.error("Error fetching blob content:", fetchError);
          throw new Error(
            `Failed to fetch blob content: ${fetchError instanceof Error ? fetchError.message : "Unknown error"}`
          );
        }
      } else {
        throw new Error("Unexpected response from API.");
      }
    } catch (err: unknown) {
      console.error("Fetch error:", err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to retrieve newsletter due to an unknown error.");
      }
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchNewsletterStatus();

    // Cleanup countdown on unmount
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [fetchNewsletterStatus]);

  // Extract topics from slug for display
  const getTopicsFromSlug = (currentSlug?: string) => {
    if (!currentSlug) return "your topics";
    // First, decode the URL-encoded slug
    const decodedSlug = decodeURIComponent(currentSlug);
    const datePattern = /^(\d{4}-\d{2}-\d{2})-/;
    const dateMatch = decodedSlug.match(datePattern);
    let topicsDisplayString = "your topics";
    if (dateMatch?.[1]) {
      const encodedTopicsPart = decodedSlug.substring(dateMatch[0].length);
      if (encodedTopicsPart) {
        // Split by topic separator and replace plus signs with spaces
        const decodedTopics = encodedTopicsPart
          .split("~")
          .map((t) => t.replace(/\+/g, " "))
          .filter((topic) => topic !== "");
        if (decodedTopics.length > 0) {
          topicsDisplayString = decodedTopics.join(", ");
        }
      }
    } else {
      // Fallback for slugs not matching the new date-prefixed format
      console.warn("Display slug does not match expected date-prefix format:", decodedSlug);
      topicsDisplayString = decodedSlug
        .replace(/-/g, ", ")
        .split(",")
        .map((topic) => topic.trim())
        .filter(Boolean)
        .join(", ");
    }
    return topicsDisplayString;
  };
  const topicsDisplay = getTopicsFromSlug(slug);

  // Extract the generated title from the newsletter content
  const extractTitle = (content: string | null): string | null => {
    if (!content) return null;
    // The title is the first line that starts with **
    const lines = content.split("\n");
    for (const line of lines) {
      if (line.trim().startsWith("**") && line.trim().endsWith("**")) {
        // Remove the ** markers
        return line.trim().slice(2, -2);
      }
    }
    return null;
  };

  const generatedTitle = extractTitle(newsletterContent);

  // Remove the title from the content so it's not duplicated
  const contentWithoutTitle = (content: string | null): string => {
    if (!content) return "";
    const lines = content.split("\n");
    const filteredLines = [];
    let titleFound = false;

    for (const line of lines) {
      if (!titleFound && line.trim().startsWith("**") && line.trim().endsWith("**")) {
        titleFound = true;
        // Skip this line and the next empty line if it exists
        continue;
      }
      if (titleFound && filteredLines.length === 0 && line.trim() === "") {
        // Skip empty line after title
        continue;
      }
      filteredLines.push(line);
    }

    return filteredLines.join("\n");
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-950 to-slate-800 text-white">
      <style jsx global>
        {newsletterStyles}
      </style>
      <header className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sticky top-0 bg-slate-950/80 backdrop-blur-md z-10 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bot className="h-8 w-8 text-pink-400" />
            <h1 className="text-2xl font-bold">Serverless Agents</h1>
          </div>
          <Link href="/" className="text-pink-400 hover:text-pink-300">
            Back to Home
          </Link>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        {isLoading && (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <Spinner />
            <p className="mt-4 text-xl text-slate-300">
              Checking status for:{" "}
              <span className="font-semibold text-pink-400">{topicsDisplay}</span>...
            </p>
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center justify-center text-center py-20 bg-red-900/20 border border-red-700 rounded-lg p-8">
            <h2 className="text-2xl font-semibold text-red-400 mb-4">
              Oops! Something went wrong.
            </h2>
            <p className="text-slate-300">{error}</p>
            <Link
              href="/"
              className="mt-6 px-6 py-2 bg-pink-500 hover:bg-pink-600 rounded-md text-white font-medium"
            >
              Try Again
            </Link>
          </div>
        )}
        {!isLoading && !error && isGenerating && (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <Spinner />
            <p className="mt-4 text-xl text-slate-300">
              Generating your newsletter for:{" "}
              <span className="font-semibold text-pink-400">{topicsDisplay}</span>...
            </p>
            <p className="text-sm text-slate-500 mb-4">
              This might take a moment. We&apos;ll auto-refresh in 5 seconds to see if it&apos;s
              ready.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-6 py-3 bg-pink-500 hover:bg-pink-600 rounded-md text-white font-medium relative flex items-center justify-center gap-3 transition-colors"
              disabled={isLoading}
            >
              <span>Refresh</span>
              {isCountingDown && (
                <div className="relative w-6 h-6">
                  <CircularProgress progress={((5 - countdown) / 5) * 100} size={24} />
                </div>
              )}
            </button>
          </div>
        )}
        {!isLoading && !error && newsletterContent && (
          <div className="max-w-7xl mx-auto">
            <article className="bg-slate-800/60 rounded-xl shadow-2xl border border-slate-700/50 overflow-hidden">
              {/* Header Section */}
              <div className="bg-slate-900/80 p-6 sm:p-8 md:p-10 border-b border-slate-700">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-pink-400 leading-tight">
                  {generatedTitle || `Your Newsletter on: ${topicsDisplay}`}
                </h1>
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:gap-4 text-sm text-slate-400">
                  <div>
                    <span className="font-medium">Topics:</span>{" "}
                    <span className="text-slate-300">{topicsDisplay}</span>
                  </div>
                  <span className="hidden sm:block">•</span>
                  <time dateTime={new Date().toISOString()}>
                    {new Date().toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </time>
                </div>
              </div>

              {/* Content Section with responsive columns */}
              <div className="p-6 sm:p-8 md:p-10 lg:p-12">
                <div className="newsletter-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {contentWithoutTitle(newsletterContent)}
                  </ReactMarkdown>
                </div>

                {/* Footer with CTA */}
                <div className="mt-12 pt-8 border-t border-slate-700">
                  <Link
                    href="/"
                    className="inline-block px-8 py-3 bg-pink-500 hover:bg-pink-600 rounded-md text-white font-medium text-lg transition-colors"
                  >
                    Create New Newsletter
                  </Link>
                </div>
              </div>
            </article>
          </div>
        )}
        {!isLoading && !error && !newsletterContent && !isGenerating && (
          <div className="text-center py-20">
            <h2 className="text-2xl font-semibold text-slate-400">
              No content found for this newsletter.
            </h2>
            <Link
              href="/"
              className="mt-6 px-6 py-2 bg-pink-500 hover:bg-pink-600 rounded-md text-white font-medium"
            >
              Generate New Newsletter
            </Link>
          </div>
        )}
      </main>

      <footer className="py-8 text-center border-t border-slate-700/50 mt-auto">
        <p className="text-slate-500">
          &copy; {new Date().getFullYear()} Serverless Agents. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
