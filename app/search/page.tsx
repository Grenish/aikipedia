"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ArrowLeft, ArrowUp, ChevronRight, Search } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

interface Suggestion {
  title: string;
  snippet: string;
  pageid: number;
}

interface SuggestionsData {
  query: string;
  suggestions: Suggestion[];
}

function SearchContent() {
  const router = useRouter();
  const pathname = usePathname();
  // Read query from window.location.search on the client so updating the URL
  // doesn't trigger the App Router to navigate. We keep the query in state
  // and update it with history.pushState / popstate.
  const [query, setQuery] = useState(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return params.get("q") || "";
  });
  const [data, setData] = useState<SuggestionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(query);
  const [isEnhancing, setIsEnhancing] = useState(false);

  useEffect(() => {
    if (!query) {
      router.push("/");
      return;
    }

    fetchSuggestionsForQuery(query);
  }, [query, router]);

  // Update page title when data loads
  useEffect(() => {
    if (data?.query) {
      document.title = `Search: ${data.query} - AikiPedia`;
    }
    return () => {
      document.title = "AikiPedia";
    };
  }, [data?.query]);

  // Update input when query changes
  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  // Listen to browser navigation (back/forward). When the user navigates
  // via history, update local query state and let the existing effect
  // that watches `query` re-fetch suggestions. This avoids using
  // next/navigation search params which can cause App Router navigation.
  useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      const q = params.get("q") || "";
      setQuery(q);
      setSearchInput(q);
      // fetch will be triggered by the effect watching `query`
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const handleSearchSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    if (!trimmed || trimmed === query) return;

    try {
      setIsEnhancing(true);

      // Enhance query with AI
      const response = await fetch("/api/enhance-query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: trimmed }),
      });

      const { enhancedQuery } = await response.json();

      // Update URL using history API without triggering App Router navigation
      const params = new URLSearchParams(window.location.search);
      params.set("q", enhancedQuery);
      window.history.pushState(null, "", `${pathname}?${params.toString()}`);

      // Update local query state so effects re-run and suggestions fetch
      setQuery(enhancedQuery);
    } catch (error) {
      console.error("Enhancement error:", error);
      // Fallback to original query if enhancement fails
      const params = new URLSearchParams(window.location.search);
      params.set("q", trimmed);
      window.history.pushState(null, "", `${pathname}?${params.toString()}`);
      setQuery(trimmed);
    } finally {
      setIsEnhancing(false);
    }
  };

  const fetchSuggestionsForQuery = async (searchQuery: string) => {
    if (!searchQuery) return;

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/suggestions?q=${encodeURIComponent(searchQuery)}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch suggestions");
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError("Failed to load suggestions. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.push("/");
  };

  const handleSelectSuggestion = (title: string) => {
    router.push(`/search/${encodeURIComponent(title)}`);
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
        <div className="text-center space-y-3">
          <h2 className="text-2xl font-semibold">Oops!</h2>
          <p className="text-muted-foreground text-sm">
            {error || "No data found"}
          </p>
          <Button onClick={handleBack} variant="outline" className="mt-4">
            Go Back Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen">
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
            <div className="flex flex-col min-w-0 flex-1">
              <p className="text-xs">Search result for</p>
              <h2 className="text-base sm:text-lg font-semibold truncate">
                {data.query}
              </h2>
            </div>
          </nav>
        </header>

        <div className="w-full sm:w-11/12 md:w-9/12 mx-auto py-5">
          <form onSubmit={handleSearchSubmit} className="mb-5">
            <div className="relative flex items-center bg-background border rounded-full">
              <Search className="absolute left-3 sm:left-5 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground pointer-events-none" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
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
          </form>
          {data.suggestions.length === 0 ? (
            <div className="text-center py-12">
              <Search className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg sm:text-xl font-semibold mb-2">
                No results found
              </h3>
              <p className="text-muted-foreground text-sm">
                Try searching for something else
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs mb-4">
                {data.suggestions.length} results found for {data.query}
              </p>
              {data.suggestions.map((suggestion) => (
                <Button
                  key={suggestion.pageid}
                  onClick={() => handleSelectSuggestion(suggestion.title)}
                  variant={"ghost"}
                  className="w-full h-auto flex items-center justify-between px-3 sm:px-4 py-3 text-foreground text-left"
                >
                  <span className="truncate flex-1">{suggestion.title}</span>
                  <ChevronRight className="flex-shrink-0 ml-2" />
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SearchTerms() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
