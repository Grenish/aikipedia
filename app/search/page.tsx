"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ArrowLeft, ChevronRight, Search, ArrowUp } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState, Suspense, FormEvent, useCallback } from "react";

interface Suggestion {
  title: string;
  snippet: string;
  pageid: number;
}

interface SuggestionsData {
  query: string;
  suggestions: Suggestion[];
  warning?: string;
}

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const initialQuery = searchParams.get("q") || "";

  const [data, setData] = useState<SuggestionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [currentQuery, setCurrentQuery] = useState(initialQuery);

  const fetchSuggestions = useCallback(
    async (query: string) => {
      if (!query) {
        router.push("/");
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setWarning(null);

        const response = await fetch(
          `/api/suggestions?q=${encodeURIComponent(query)}`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch suggestions");
        }

        const result = await response.json();
        setData(result);

        if (result.warning) {
          setWarning(result.warning);
        }
      } catch (err) {
        setError("Failed to load suggestions. Please try again.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  // Only fetch when URL query parameter changes
  useEffect(() => {
    const urlQuery = searchParams.get("q") || "";
    if (urlQuery && urlQuery !== currentQuery) {
      setCurrentQuery(urlQuery);
      setSearchQuery(urlQuery);
      fetchSuggestions(urlQuery);
    }
  }, [searchParams, currentQuery, fetchSuggestions]);

  // Initial load
  useEffect(() => {
    if (initialQuery) {
      fetchSuggestions(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Update page title when data loads
  useEffect(() => {
    if (data?.query) {
      document.title = `Search: ${data.query} - AikiPedia`;
    }
    return () => {
      document.title = "AikiPedia";
    };
  }, [data?.query]);

  const handleBack = () => {
    router.push("/");
  };

  const handleSelectSuggestion = (title: string) => {
    router.push(`/search/${encodeURIComponent(title)}`);
  };

  const handleSearchSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (searchQuery.trim() && searchQuery.trim() !== currentQuery) {
      try {
        setIsEnhancing(true);

        // Enhance query with AI
        const enhanceResponse = await fetch("/api/enhance-query", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: searchQuery.trim() }),
        });

        const { enhancedQuery } = await enhanceResponse.json();

        // Update URL which will trigger the useEffect
        const params = new URLSearchParams();
        params.set("q", enhancedQuery);
        router.push(`${pathname}?${params.toString()}`);
      } catch (error) {
        console.error("Enhancement error:", error);
        // Fallback to original query if enhancement fails
        const params = new URLSearchParams();
        params.set("q", searchQuery.trim());
        router.push(`${pathname}?${params.toString()}`);
      } finally {
        setIsEnhancing(false);
      }
    }
  };

  if (loading && !data) {
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
        <header className="py-3 sm:py-4 sticky top-0 bg-background/80 backdrop-blur-sm z-10">
          <div className="flex flex-col gap-3">
            <nav className="flex items-center gap-2">
              <Button
                onClick={handleBack}
                size={"icon-sm"}
                className="rounded-full"
              >
                <ArrowLeft />
              </Button>
              <div className="flex flex-col min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">
                  Search result for
                </p>
                <h2 className="text-base sm:text-lg font-semibold truncate">
                  {data.query}
                </h2>
              </div>
            </nav>

            <form
              onSubmit={handleSearchSubmit}
              className="w-full flex flex-col items-center"
            >
              <div className="relative group w-full sm:w-11/12 md:w-9/12">
                <div className="relative flex items-center bg-background border rounded-full">
                  <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 text-sm border-0 rounded-full outline-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
                    placeholder="Search again..."
                    disabled={isEnhancing}
                  />
                  <Button
                    type="submit"
                    disabled={
                      isEnhancing || searchQuery.trim() === currentQuery
                    }
                    className="rounded-full absolute right-1.5 h-8 w-8 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
                    size="icon"
                  >
                    {isEnhancing ? (
                      <Spinner />
                    ) : (
                      <ArrowUp className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </header>

        <div className="w-full sm:w-11/12 md:w-9/12 mx-auto py-5">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          )}

          {!loading && warning && (
            <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-sm text-yellow-600 dark:text-yellow-500">
                {warning}
              </p>
            </div>
          )}

          {!loading && data.suggestions.length === 0 ? (
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
            !loading && (
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
                    <ChevronRight className="shrink-0 ml-2" />
                  </Button>
                ))}
              </div>
            )
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
