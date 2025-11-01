"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowUp,
  Search,
  Loader2,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  Trash2,
} from "lucide-react";
import { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";

interface BookmarkedArticle {
  title: string;
  link: string;
  thumbnail: string | null;
  savedAt: number;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [bookmarks, setBookmarks] = useState<BookmarkedArticle[]>([]);
  const [showBookmarks, setShowBookmarks] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Load bookmarks from localStorage
    const loadBookmarks = () => {
      const stored = localStorage.getItem("aikipedia-bookmarks");
      if (stored) {
        const parsedBookmarks: BookmarkedArticle[] = JSON.parse(stored);
        setBookmarks(parsedBookmarks);
      }
    };

    loadBookmarks();

    // Listen for storage changes (when bookmarks are added/removed)
    const handleStorageChange = () => {
      loadBookmarks();
    };

    window.addEventListener("storage", handleStorageChange);

    // Also listen for custom event when bookmark is toggled on same page
    window.addEventListener("focus", loadBookmarks);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", loadBookmarks);
    };
  }, []);

  const handleDeleteBookmark = (title: string) => {
    const updatedBookmarks = bookmarks.filter(
      (bookmark) => bookmark.title !== title,
    );
    setBookmarks(updatedBookmarks);
    localStorage.setItem(
      "aikipedia-bookmarks",
      JSON.stringify(updatedBookmarks),
    );
  };

  const handleVisitBookmark = (link: string) => {
    router.push(link);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (query.trim()) {
      try {
        setIsEnhancing(true);

        // Enhance query with AI
        const response = await fetch("/api/enhance-query", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: query.trim() }),
        });

        const { enhancedQuery } = await response.json();

        // Navigate with enhanced query
        router.push(`/search?q=${encodeURIComponent(enhancedQuery)}`);
      } catch (error) {
        console.error("Enhancement error:", error);
        // Fallback to original query if enhancement fails
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      } finally {
        setIsEnhancing(false);
      }
    }
  };

  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center">
      <div className="mb-8 text-center space-y-2 px-4">
        <div className="flex flex-col items-center justify-center gap-2 mb-3">
          <div className="flex gap-2 items-center">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black font-magent">
              AikiPedia
            </h1>
            <Badge>v0.2</Badge>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm w-full sm:w-3/4 md:w-2/3 lg:w-1/2">
            Your AI-glorified Wikipedia that roasts the same boring facts
            you&apos;d scroll past on the real one-but now with zero patience
            for the dry-ass nonsense.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-2xl px-4 sm:px-6">
        <div className="relative group">
          <div className="relative flex items-center bg-background border rounded-full">
            <Search className="absolute left-3 sm:left-5 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 sm:pl-14 pr-12 sm:pr-16 py-4 sm:py-6 text-sm sm:text-base border-0 rounded-full outline-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
              placeholder="Ask me anything..."
            />
            <Button
              type="submit"
              disabled={isEnhancing}
              className="rounded-full absolute right-1.5 sm:right-2 h-8 w-8 sm:h-10 sm:w-10 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
              size="icon"
            >
              {isEnhancing ? (
                <Spinner />
              ) : (
                <ArrowUp className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </Button>
          </div>
        </div>
      </form>

      {/* Saved Content from localStorage */}
      {bookmarks.length > 0 && (
        <div className="mt-8 w-full max-w-3xl px-4 sm:px-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg sm:text-xl font-semibold">Saved Wikis</h2>
            <Button
              size={"icon-sm"}
              variant={"ghost"}
              onClick={() => setShowBookmarks(!showBookmarks)}
            >
              {showBookmarks ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>

          {showBookmarks && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {bookmarks.map((bookmark) => (
                <div
                  key={bookmark.savedAt}
                  className="border flex flex-col items-center justify-center p-2 rounded-xl bg-card/50 hover:bg-card transition-colors"
                >
                  <div className="w-full aspect-4/3 overflow-hidden relative rounded-lg bg-muted">
                    {bookmark.thumbnail ? (
                      <Image
                        src={bookmark.thumbnail}
                        alt={bookmark.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Search className="h-12 w-12" />
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex flex-col w-full">
                    <h3 className="font-semibold text-sm truncate">
                      {bookmark.title}
                    </h3>
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        onClick={() => handleDeleteBookmark(bookmark.title)}
                        className="flex bg-transparent hover:bg-destructive text-foreground hover:text-background"
                        variant={"default"}
                        size={"icon-sm"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => handleVisitBookmark(bookmark.link)}
                        className="flex-1"
                        variant={"outline"}
                        size={"sm"}
                      >
                        Visit <ArrowUpRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
