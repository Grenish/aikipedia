"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ArrowLeft } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { WikiMarkdown } from "@/components/wiki/WikiMarkdown";
import { Separator } from "@/components/ui/separator";
import { Streamdown } from "streamdown";

interface WikiData {
  title: string;
  summary: string;
  content: string;
  images: string[];
  thumbnail: string | null;
  pageId: number;
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
            <h2 className="text-base sm:text-lg md:text-xl font-semibold truncate flex-1">{data.title}</h2>
          </nav>
        </header>
        <div className="w-full sm:w-11/12 md:w-9/12 mx-auto py-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 grid-rows-2 gap-2 sm:gap-4 h-[300px] sm:h-[400px] md:h-[500px]">
            {/* Main large item - takes 2 columns and 2 rows on desktop, full width on mobile */}
            <div className="col-span-2 row-span-2 rounded-2xl overflow-hidden bg-muted relative">
              {displayImages[0] ? (
                <Image
                  src={displayImages[0]}
                  alt={data.title}
                  fill
                  className="object-cover"
                />
              ) : (
                <div
                  className={`w-full h-full bg-linear-to-br ${imageColors[0]}`}
                ></div>
              )}
            </div>

            {/* Top right item - hidden on mobile */}
            <div className="hidden sm:block col-span-2 row-span-1 rounded-2xl overflow-hidden bg-muted relative">
              {displayImages[1] ? (
                <Image
                  src={displayImages[1]}
                  alt={data.title}
                  fill
                  className="object-cover"
                />
              ) : (
                <div
                  className={`w-full h-full bg-linear-to-br ${imageColors[1]}`}
                ></div>
              )}
            </div>

            {/* Bottom right first item - hidden on mobile */}
            <div className="hidden sm:block col-span-1 row-span-1 rounded-2xl overflow-hidden bg-muted relative">
              {displayImages[2] ? (
                <Image
                  src={displayImages[2]}
                  alt={data.title}
                  fill
                  className="object-cover"
                />
              ) : (
                <div
                  className={`w-full h-full bg-linear-to-br ${imageColors[2]}`}
                ></div>
              )}
            </div>

            {/* Bottom right second item - hidden on mobile */}
            <div className="hidden sm:block col-span-1 row-span-1 rounded-2xl overflow-hidden bg-muted relative">
              {displayImages[3] ? (
                <Image
                  src={displayImages[3]}
                  alt={data.title}
                  fill
                  className="object-cover"
                />
              ) : (
                <div
                  className={`w-full h-full bg-linear-to-br ${imageColors[3]}`}
                ></div>
              )}
            </div>
          </div>
          <div className="mt-5">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold">{data.title}</h2>
            {/* summary below */}
            <p className="text-muted-foreground text-xs sm:text-sm mt-2">{data.summary}</p>
          </div>
          <div className="mt-5">
            <Button
              size={"sm"}
              onClick={generateOverview}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Spinner />
                  Generating...
                </>
              ) : (
                "Generate Overview"
              )}
            </Button>
            {overview && (
              <div className="mt-4 p-3 sm:p-4 rounded-lg bg-muted/50 border border-border">
                <h3 className="text-xs sm:text-sm font-semibold mb-2 flex items-center gap-2">
                  AI Overview
                </h3>
                <Streamdown className="text-xs sm:text-sm leading-relaxed text-foreground/90">
                  {overview}
                </Streamdown>
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
