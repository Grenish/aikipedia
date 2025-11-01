import { NextRequest, NextResponse } from "next/server";
import wiki from "wikipedia";

interface ImageResult {
  url: string;
}

// Helper function to add timeout to promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), timeoutMs),
    ),
  ]);
}

// Helper function to retry failed requests with exponential backoff
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
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter is required" },
        { status: 400 },
      );
    }

    // Get the exact page with timeout and retry logic
    const page = await retryWithBackoff(async () => {
      return await withTimeout(
        wiki.page(query, { autoSuggest: false }),
        10000, // 10 second timeout for page fetch
      );
    });

    // Get summary, images, and content in parallel with timeout and retry
    const [summary, images, content] = await retryWithBackoff(async () => {
      return await withTimeout(
        Promise.all([page.summary(), page.images(), page.content()]),
        15000, // 15 second timeout for parallel operations
      );
    });

    // Get the first 4 unique images
    const imageUrls = (images as ImageResult[] | string[])
      .map((img) => (typeof img === "string" ? img : img.url))
      .filter((url: string) => {
        const lower = url.toLowerCase();
        // Only exclude SVGs, icons, and small logos
        const isExcluded =
          lower.includes(".svg") ||
          lower.includes("icon") ||
          lower.includes("logo.") ||
          lower.includes("button");

        // Include common image formats
        const isValidFormat =
          lower.includes(".jpg") ||
          lower.includes(".jpeg") ||
          lower.includes(".png") ||
          lower.includes(".webp");

        return !isExcluded && isValidFormat;
      })
      .slice(0, 4);

    return NextResponse.json({
      title: summary.title,
      summary: summary.extract,
      content: content,
      images: imageUrls,
      thumbnail: summary.thumbnail?.source || null,
      pageId: summary.pageid,
    });
  } catch (error: unknown) {
    console.error("Wikipedia API Error:", error);

    // Provide more specific error messages
    if (error instanceof Error) {
      // Handle timeout errors
      if (error.message === "Request timeout") {
        return NextResponse.json(
          { error: "Wikipedia request timed out. Please try again." },
          { status: 504 },
        );
      }

      // Handle page not found errors
      if (error.message?.includes("not found")) {
        return NextResponse.json({ error: "Page not found" }, { status: 404 });
      }

      // Handle network/connection errors
      if (
        error.message.includes("network") ||
        error.message.includes("fetch") ||
        error.message.includes("ENOTFOUND") ||
        error.message.includes("ECONNREFUSED")
      ) {
        return NextResponse.json(
          {
            error:
              "Network error while connecting to Wikipedia. Please try again.",
          },
          { status: 503 },
        );
      }

      // Handle aggregate errors (common with the wikipedia package)
      if (
        error.name === "AggregateError" ||
        error.message.includes("AggregateError")
      ) {
        return NextResponse.json(
          {
            error:
              "Unable to fetch data from Wikipedia. Please try again later.",
          },
          { status: 503 },
        );
      }
    }

    // Generic error fallback
    return NextResponse.json(
      { error: "Failed to fetch Wikipedia data. Please try again." },
      { status: 500 },
    );
  }
}
