"use client";

import { useState, FormEvent, useRef, type ReactElement } from "react";
import type { SearchResult } from "@/types";

export default function Home() {
  const [query, setQuery] = useState("");
  const [sources, setSources] = useState<SearchResult[]>([]);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingState, setLoadingState] = useState<"searching" | "generating" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [highlightedSource, setHighlightedSource] = useState<number | null>(null);
  const sourcesContainerRef = useRef<HTMLDivElement>(null);

  const handleCitationClick = (citationIndex: number): void => {
    // Expand sources if collapsed
    if (!sourcesExpanded) {
      setSourcesExpanded(true);
    }

    // Wait for DOM update if we just expanded
    setTimeout(() => {
      const sourceElement = document.querySelector(
        `[data-source-index="${citationIndex}"]`
      );
      if (sourceElement) {
        sourceElement.scrollIntoView({ behavior: "smooth", block: "center" });

        // Highlight the source
        setHighlightedSource(citationIndex);
        setTimeout(() => setHighlightedSource(null), 2000);
      }
    }, sourcesExpanded ? 0 : 100);
  };

  const renderAnswerWithCitations = (text: string): ReactElement[] => {
    const parts: ReactElement[] = [];
    const citationRegex = /\[(\d+)\]/g;
    let lastIndex = 0;
    let match;

    while ((match = citationRegex.exec(text)) !== null) {
      const fullMatch = match[0];
      const citationNumber = parseInt(match[1] || "0", 10);
      const matchIndex = match.index;

      // Add text before the citation
      if (matchIndex > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {text.slice(lastIndex, matchIndex)}
          </span>
        );
      }

      // Add the citation as a clickable element
      parts.push(
        <sup key={`citation-${matchIndex}`}>
          <button
            onClick={() => handleCitationClick(citationNumber - 1)}
            className="citation-link inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 mx-0.5 bg-blue-100 text-blue-700 rounded text-xs font-semibold hover:bg-blue-200 hover:text-blue-900 transition-colors cursor-pointer border border-blue-300"
            aria-label={`View source ${citationNumber}`}
          >
            {citationNumber}
          </button>
        </sup>
      );

      lastIndex = matchIndex + fullMatch.length;
    }

    // Add remaining text after last citation
    if (lastIndex < text.length) {
      parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>);
    }

    return parts;
  };

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
              } else if (parsed.type === "done") {
                // Stream completed successfully
                break;
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
          <div className="mb-8" ref={sourcesContainerRef}>
            {!sourcesExpanded ? (
              <div className="flex items-center gap-3">
                <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                  📚 {sources.length} source{sources.length !== 1 ? "s" : ""}
                </span>
                <button
                  onClick={() => setSourcesExpanded(true)}
                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline font-medium"
                >
                  Show sources
                </button>
              </div>
            ) : (
              <div className="transition-all duration-300 ease-in-out">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Sources</h2>
                  <button
                    onClick={() => setSourcesExpanded(false)}
                    className="text-sm text-blue-600 hover:text-blue-700 hover:underline font-medium"
                  >
                    Hide sources
                  </button>
                </div>
                <div className="grid gap-4">
                  {sources.map((source, index) => (
                    <div
                      key={index}
                      data-source-index={index}
                      className={`p-4 border border-gray-200 rounded-lg hover:shadow-md transition-all bg-white ${
                        highlightedSource === index
                          ? "ring-2 ring-blue-500 shadow-lg"
                          : ""
                      }`}
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
                {renderAnswerWithCitations(answer)}
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
