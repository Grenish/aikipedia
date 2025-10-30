import { NextRequest, NextResponse } from "next/server";
import wiki from "wikipedia";

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

    // Get search results from Wikipedia
    const searchResults = await wiki.search(query, { limit: 10 });

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

    return NextResponse.json(
      { error: "Failed to fetch suggestions" },
      { status: 500 },
    );
  }
}
