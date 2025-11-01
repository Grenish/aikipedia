import { NextRequest, NextResponse } from "next/server";
import wiki from "wikipedia";

// Helper function to add timeout to promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), timeoutMs),
    ),
  ]);
}

// Helper function to retry failed requests
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  baseDelay: number = 1000,
): Promise<T> {
  let lastError: Error | unknown;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        // Wait with exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, baseDelay * Math.pow(2, i)),
        );
      }
    }
  }

  throw lastError;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json(
      { error: "Query parameter is required" },
      { status: 400 },
    );
  }

  try {
    // Get search results from Wikipedia with timeout and retry logic
    let searchResults;
    try {
      searchResults = await retryWithBackoff(
        async () => {
          return await withTimeout(
            wiki.search(query, { limit: 10 }),
            15000, // 15 second timeout
          );
        },
        3, // Increase retries to 3
        500, // Reduce base delay to 500ms for faster retries
      );
    } catch (retryError) {
      // If all retries fail, return empty suggestions with a warning
      console.error("All retry attempts failed:", retryError);
      return NextResponse.json({
        query: query,
        suggestions: [],
        warning: "Unable to fetch suggestions. Please try searching directly.",
      });
    }

    return NextResponse.json({
      query: query,
      suggestions: searchResults.results.map((result) => ({
        title: result.title,
        snippet: result.snippet || "",
        pageid: result.pageid,
      })),
    });
  } catch (error: unknown) {
    console.error("Wikipedia Suggestions API Error:", error);

    // Return empty suggestions with warning instead of error status
    // This allows the UI to continue functioning even if suggestions fail
    return NextResponse.json({
      query: query,
      suggestions: [],
      warning: "Unable to load suggestions. You can still search directly.",
    });
  }
}
