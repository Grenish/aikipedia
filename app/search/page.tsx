"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ArrowLeft, ChevronRight, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const [data, setData] = useState<SuggestionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!query) {
        router.push("/");
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          `/api/suggestions?q=${encodeURIComponent(query)}`,
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

    fetchSuggestions();
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
      <div className="w-10/12 mx-auto">
        <header className="p-2 sticky top-0 bg-background/80 backdrop-blur-sm z-10">
          <nav className="flex items-center gap-2">
            <Button
              onClick={handleBack}
              size={"icon-sm"}
              className="rounded-full"
            >
              <ArrowLeft />
            </Button>
            <div className="flex flex-col">
              <p className="text-xs">Search result for</p>
              <h2 className="text-lg font-semibold">{data.query}</h2>
            </div>
          </nav>
        </header>

        <div className="w-9/12 mx-auto p-5">
          {data.suggestions.length === 0 ? (
            <div className="text-center py-12">
              <Search className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No results found</h3>
              <p className="text-muted-foreground">
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
                  className="w-full h-auto flex items-center justify-between px-4 py-3 text-foreground"
                >
                  {suggestion.title}
                  <ChevronRight />
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
