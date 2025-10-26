"use client";

import { useState, FormEvent } from "react";
import type { SearchResult } from "@/types";

export default function Home() {
  const [query, setQuery] = useState("");
  const [sources, setSources] = useState<SearchResult[]>([]);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingState, setLoadingState] = useState<"searching" | "generating" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!query.trim()) {
      setError("Please enter a search query");
      return;
    }

    // Reset state
    setError(null);
    setSources([]);
    setAnswer("");
    setLoading(true);
    setLoadingState("searching");

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch search results");
      }

      if (!response.body) {
        throw new Error("No response body received");
      }

      // Parse SSE stream manually
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");

        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);

              if (parsed.type === "sources") {
                setSources(parsed.sources);
                setLoadingState("generating");
              } else if (parsed.type === "text") {
                setAnswer((prev) => prev + parsed.content);
              } else if (parsed.type === "error") {
                throw new Error(parsed.error || "Streaming error occurred");
              }
            } catch (err) {
              console.error("Failed to parse SSE message:", err);
            }
          }
        }
      }

      setLoadingState(null);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoadingState(null);
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">Perplexity Clone</h1>

        {/* Search Form */}
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything..."
              disabled={loading}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Search
            </button>
          </div>
        </form>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Loading States */}
        {loadingState === "searching" && (
          <div className="text-center text-gray-600 py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
            <p>Searching...</p>
          </div>
        )}

        {/* Sources Display */}
        {sources.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Sources</h2>
            <div className="grid gap-4">
              {sources.map((source, index) => (
                <div
                  key={index}
                  className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow bg-white"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 mb-1">
                        {source.title}
                      </h3>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline block mb-2 truncate"
                      >
                        {source.url}
                      </a>
                      <p className="text-sm text-gray-600">
                        {source.content.length > 150
                          ? `${source.content.slice(0, 150)}...`
                          : source.content}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading State for Answer Generation */}
        {loadingState === "generating" && !answer && (
          <div className="text-center text-gray-600 py-4">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-2"></div>
            <p>Generating answer...</p>
          </div>
        )}

        {/* AI Answer Display */}
        {answer && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Answer</h2>
            <div className="prose prose-blue max-w-none p-6 bg-white border border-gray-200 rounded-lg">
              <p className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                {answer}
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
