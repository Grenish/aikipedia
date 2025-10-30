import { NextRequest, NextResponse } from "next/server";
import wiki from "wikipedia";

interface ImageResult {
  url: string;
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

    // Get the exact page (no auto-suggest since we show suggestions first)
    const page = await wiki.page(query);

    // Get summary, images, and content in parallel
    const [summary, images, content] = await Promise.all([
      page.summary(),
      page.images(),
      page.content(),
    ]);

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

    if (error instanceof Error && error.message?.includes("not found")) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to fetch Wikipedia data" },
      { status: 500 },
    );
  }
}
