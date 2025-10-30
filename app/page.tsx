"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUp, Search, Loader2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [query, setQuery] = useState("");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const router = useRouter();

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
      <div className="mb-8 text-center space-y-2">
        <div className="flex flex-col items-center justify-center gap-2 mb-3">
          <h1 className="text-5xl font-bold">AikiPedia</h1>
          <p className="text-muted-foreground text-sm w-1/2">
            Your AI-glorified Wikipedia that roasts the same boring facts
            you&apos;d scroll past on the real one-but now with zero patience
            for the dry-ass nonsense.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-2xl px-4">
        <div className="relative group">
          <div className="relative flex items-center bg-background border rounded-full">
            <Search className="absolute left-5 h-5 w-5 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-14 pr-16 py-6 text-base border-0 rounded-full outline-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
              placeholder="Ask me anything..."
            />
            <Button
              type="submit"
              disabled={isEnhancing}
              className="rounded-full absolute right-2 h-10 w-10 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
              size="icon"
            >
              {isEnhancing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ArrowUp className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
