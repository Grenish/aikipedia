"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ArrowLeft, Bookmark, BookmarkCheck, Share2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { WikiMarkdown } from "@/components/wiki/WikiMarkdown";
import { Separator } from "@/components/ui/separator";
import { Streamdown } from "streamdown";
import { ShareCard } from "@/components/ShareCard";
import { ImageGallery } from "@/components/ImageGallery";

interface WikiData {
  title: string;
  summary: string;
  content: string;
  images: string[];
  thumbnail: string | null;
  pageId: number;
}

interface BookmarkedArticle {
  title: string;
  link: string;
  thumbnail: string | null;
  savedAt: number;
}

export default function SearchedPage() {
  const params = useParams();
  const router = useRouter();
  const title = params.title as string;
  const [data, setData] = useState<WikiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [isOverviewCollapsed, setIsOverviewCollapsed] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(decodeURIComponent(title))}`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch data");
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError("Failed to load content. Please try again.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (title) {
      fetchData();
    }
  }, [title]);

  // Update page title when data loads
  useEffect(() => {
    if (data?.title) {
      document.title = `${data.title} - AikiPedia`;
    }
    return () => {
      document.title = "AikiPedia";
    };
  }, [data?.title]);

  // Check if article is already bookmarked
  useEffect(() => {
    if (data?.title) {
      const bookmarks = getBookmarks();
      const exists = bookmarks.some(
        (bookmark) => bookmark.title === data.title,
      );
      setIsBookmarked(exists);
    }
  }, [data?.title]);

  const getBookmarks = (): BookmarkedArticle[] => {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem("aikipedia-bookmarks");
    return stored ? JSON.parse(stored) : [];
  };

  const saveBookmarks = (bookmarks: BookmarkedArticle[]) => {
    if (typeof window === "undefined") return;
    localStorage.setItem("aikipedia-bookmarks", JSON.stringify(bookmarks));
  };

  const handleBookmark = () => {
    if (!data) return;

    const bookmarks = getBookmarks();
    const existingIndex = bookmarks.findIndex(
      (bookmark) => bookmark.title === data.title,
    );

    if (existingIndex !== -1) {
      // Remove bookmark
      bookmarks.splice(existingIndex, 1);
      setIsBookmarked(false);
    } else {
      // Add bookmark
      const newBookmark: BookmarkedArticle = {
        title: data.title,
        link: `/search/${encodeURIComponent(data.title)}`,
        thumbnail: data.thumbnail,
        savedAt: Date.now(),
      };
      bookmarks.unshift(newBookmark); // Add to beginning
      setIsBookmarked(true);
    }

    saveBookmarks(bookmarks);
  };

  const handleBack = () => {
    router.push("/");
  };

  const generateOverview = async () => {
    if (!data) return;

    try {
      setIsGenerating(true);
      setOverview("");

      const response = await fetch("/api/generate-overview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: data.title,
          summary: data.summary,
          content: data.content,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate overview");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let accumulatedText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        accumulatedText += chunk;
        setOverview(accumulatedText);
      }
    } catch (error) {
      console.error("Overview generation error:", error);
      setOverview("Failed to generate overview. Please try again.");
    } finally {
      setIsGenerating(false);
      setHasGenerated(true);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Oops!</h2>
          <p className="text-muted-foreground">{error || "No data found"}</p>
          <Button onClick={handleBack} className="mt-4">
            Go Back Home
          </Button>
        </div>
      </div>
    );
  }

  // Ensure we have exactly 4 images, use thumbnail or placeholder if needed
  const displayImages = [...data.images];
  if (data.thumbnail && displayImages.length < 4) {
    displayImages.unshift(data.thumbnail);
  }

  // Fill remaining slots with gradient placeholders
  while (displayImages.length < 4) {
    displayImages.push("");
  }

  const imageColors = [
    "from-primary/30 to-primary/10",
    "from-blue-400/20 to-blue-600/20",
    "from-purple-400/20 to-purple-600/20",
    "from-green-400/20 to-green-600/20",
  ];

  return (
    <div className="w-full min-h-screen relative">
      <div className="w-full sm:w-11/12 md:w-10/12 mx-auto px-4 sm:px-0">
        <header className="py-3 sm:p-2 sticky top-0 bg-background/80 backdrop-blur-sm z-10">
          <nav className="flex items-center gap-2">
            <Button
              onClick={handleBack}
              size={"icon-sm"}
              className="rounded-full"
            >
              <ArrowLeft />
            </Button>
            <h2 className="text-base sm:text-lg md:text-xl font-semibold truncate flex-1">
              {data.title}
            </h2>
          </nav>
        </header>
        <div className="w-full sm:w-11/12 md:w-9/12 mx-auto py-5">
          <ImageGallery
            images={displayImages}
            title={data.title}
            imageColors={imageColors}
          />
          <div className="mt-5">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold">
              {data.title}
            </h2>
            {/* summary below */}
            <p className="text-muted-foreground text-xs sm:text-sm mt-2">
              {data.summary}
            </p>
          </div>
          <div className="mt-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  size={"sm"}
                  onClick={generateOverview}
                  disabled={isGenerating || hasGenerated}
                  className={
                    hasGenerated ? "opacity-50 cursor-not-allowed" : ""
                  }
                >
                  {isGenerating ? (
                    <>
                      <Spinner />
                      Generating...
                    </>
                  ) : hasGenerated ? (
                    "Generated"
                  ) : (
                    "Generate Overview"
                  )}
                </Button>
                {hasGenerated && overview && (
                  <Button
                    size={"sm"}
                    variant="outline"
                    onClick={() => setIsOverviewCollapsed(!isOverviewCollapsed)}
                  >
                    {isOverviewCollapsed ? "Show" : "Hide"}
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <ShareCard title={data.title} description={data.summary}>
                  <Button size={"icon-sm"} variant="ghost" className="">
                    <Share2 className="h-4 w-4" />
                  </Button>
                </ShareCard>
                <Button
                  size={"icon-sm"}
                  variant="ghost"
                  onClick={handleBookmark}
                  className={isBookmarked ? "text-primary" : ""}
                >
                  {isBookmarked ? (
                    <BookmarkCheck className="h-4 w-4" />
                  ) : (
                    <Bookmark className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            {overview && (
              <div className="mt-4 p-3 sm:p-4 rounded-lg bg-muted/50 border border-border transition-all duration-300 ease-in-out overflow-hidden">
                <h3 className="text-xs sm:text-sm font-semibold mb-2 flex items-center gap-2">
                  AI Overview
                </h3>
                <div
                  className={`transition-all duration-300 ease-in-out ${
                    isOverviewCollapsed
                      ? "max-h-6 overflow-hidden"
                      : "max-h-[2000px]"
                  }`}
                >
                  <Streamdown
                    className={`text-xs sm:text-sm leading-relaxed text-foreground/90 transition-all duration-300 ${
                      isOverviewCollapsed ? "line-clamp-1" : ""
                    }`}
                  >
                    {overview}
                  </Streamdown>
                </div>
              </div>
            )}
          </div>
          <Separator className="mt-5" />
          <div className="mt-5 space-y-4">
            {/* content */}
            <WikiMarkdown>{data.content}</WikiMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
