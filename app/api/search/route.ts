import { NextRequest, NextResponse } from "next/server";

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), timeoutMs),
    ),
  ]);
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 1,
  baseDelay: number = 500,
): Promise<T> {
  let lastError: Error | unknown;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, baseDelay * Math.pow(2, i)),
        );
      }
    }
  }
  throw lastError;
}

// 1. Search for Title
async function searchWikipediaPage(query: string) {
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: "1",
    format: "json",
    origin: "*",
  });

  const response = await fetch(
    `https://en.wikipedia.org/w/api.php?${params.toString()}`,
    { headers: { "User-Agent": "AikiPedia/1.0" } },
  );

  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();

  if (!data.query?.search?.[0]) throw new Error("Page not found");
  return data.query.search[0].title;
}

// 2. Get Summary & Metadata
async function getPageData(title: string) {
  const params = new URLSearchParams({
    action: "query",
    prop: "extracts|pageimages",
    titles: title,
    exintro: "1",
    explaintext: "1",
    piprop: "thumbnail|original",
    pithumbsize: "600",
    format: "json",
    origin: "*",
    redirects: "1",
  });

  const response = await fetch(
    `https://en.wikipedia.org/w/api.php?${params.toString()}`,
  );

  if (!response.ok) throw new Error("Failed metadata fetch");
  const data = await response.json();
  const pages = data.query.pages;
  const page = pages[Object.keys(pages)[0]];

  if (page.missing) throw new Error("Page not found");
  return page;
}

// 3. Get Wikitext Content (Truncated)
async function getPageContent(title: string) {
  const params = new URLSearchParams({
    action: "parse",
    page: title,
    prop: "wikitext",
    format: "json",
    origin: "*",
    redirects: "1",
  });

  const response = await fetch(
    `https://en.wikipedia.org/w/api.php?${params.toString()}`,
  );

  if (!response.ok) throw new Error("Failed content fetch");
  const data = await response.json();

  if (data.error) throw new Error(data.error.info);

  const raw = data.parse.wikitext["*"];
  // SAFETY: Limit content size to prevent client browser crash on regex
  // 150,000 chars is roughly 25-30 pages of text.
  // if (raw && raw.length > 75000) {
  //   return raw.slice(0, 75000) + "\n\n... (Content truncated for performance)";
  // }
  return raw;
}

// 4. Get Images (Optimized)
async function getPageImages(title: string) {
  const params = new URLSearchParams({
    action: "query",
    titles: title,
    generator: "images",
    gimlimit: "10",
    prop: "imageinfo",
    iiprop: "url",
    format: "json",
    origin: "*",
    redirects: "1",
  });

  const response = await fetch(
    `https://en.wikipedia.org/w/api.php?${params.toString()}`,
  );

  if (!response.ok) return [];
  const data = await response.json();

  const pages = data.query?.pages;
  if (!pages) return [];

  return (
    Object.values(pages)
      // @ts-ignore
      .map((p: any) => p.imageinfo?.[0]?.url)
      .filter(Boolean)
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query)
      return NextResponse.json({ error: "Query required" }, { status: 400 });

    const pageTitle = await retryWithBackoff(() =>
      withTimeout(searchWikipediaPage(query), 5000),
    );

    const [dataResult, contentResult, imagesResult] = await Promise.allSettled([
      retryWithBackoff(() => withTimeout(getPageData(pageTitle), 8000)),
      retryWithBackoff(() => withTimeout(getPageContent(pageTitle), 10000)),
      withTimeout(getPageImages(pageTitle), 5000),
    ]);

    if (dataResult.status === "rejected") throw dataResult.reason;
    if (contentResult.status === "rejected") throw contentResult.reason;

    const pageData = dataResult.value;
    const wikitext = contentResult.value;
    const rawImages =
      imagesResult.status === "fulfilled" ? imagesResult.value : [];

    const filteredImages = rawImages
      .filter((url: string) => {
        const lower = url.toLowerCase();
        return (
          !lower.includes(".svg") &&
          !lower.includes("icon") &&
          !lower.includes("logo") &&
          !lower.includes("resture") &&
          (lower.includes(".jpg") ||
            lower.includes(".png") ||
            lower.includes(".webp"))
        );
      })
      .slice(0, 4);

    return NextResponse.json({
      title: pageData.title,
      summary: pageData.extract || "",
      content: wikitext,
      images: filteredImages,
      thumbnail: pageData.thumbnail?.source || null,
      pageId: pageData.pageid,
    });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch data" },
      { status: error.message?.includes("not found") ? 404 : 500 },
    );
  }
}
