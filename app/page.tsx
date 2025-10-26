"use client";

import { useState, FormEvent, useRef, type ReactElement } from "react";
import type { SearchResult, ConversationEntry } from "@/types";

export default function Home() {
  const [query, setQuery] = useState("");
  const [sources, setSources] = useState<SearchResult[]>([]);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingState, setLoadingState] = useState<"searching" | "generating" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [highlightedSource, setHighlightedSource] = useState<number | null>(null);
  const [hoveredCitation, setHoveredCitation] = useState<number | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ConversationEntry[]>([]);
  const [currentReformulatedQuery, setCurrentReformulatedQuery] = useState<string | null>(null);
  const [currentQuery, setCurrentQuery] = useState<string>("");
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

  const renderAnswerWithCitations = (text: string, citationSources?: SearchResult[]): ReactElement[] => {
    if (!text) return [];

    const parts: ReactElement[] = [];
    // Match both single citations [1] and comma-separated lists [1, 2, 3]
    const citationRegex = /\[(\d+(?:,\s*\d+)*)\]/g;
    let lastIndex = 0;
    let match;

    // Use provided sources or fall back to current sources state
    const sourcesToUse = citationSources || sources;

    while ((match = citationRegex.exec(text)) !== null) {
      const fullMatch = match[0];
      const matchIndex = match.index;

      // Parse citation numbers (could be comma-separated like "2, 7")
      const citationNumbers = (match[1] || "").split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));

      // Add text before the citation
      if (matchIndex > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}-${matchIndex}`}>
            {text.slice(lastIndex, matchIndex)}
          </span>
        );
      }

      // Add citations as separate clickable elements
      parts.push(
        <sup key={`citation-group-${matchIndex}`} className="inline-flex gap-0.5">
          {citationNumbers.map((citationNumber, idx) => {
            const source = sourcesToUse[citationNumber - 1];
            return (
              <span key={`citation-${matchIndex}-${citationNumber}`} className="relative inline-block">
                <a
                  href={source?.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onMouseEnter={() => setHoveredCitation(citationNumber - 1)}
                  onMouseLeave={() => setHoveredCitation(null)}
                  className="citation-link inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 mx-0.5 bg-blue-100 text-blue-700 rounded text-xs font-semibold hover:bg-blue-200 hover:text-blue-900 transition-colors cursor-pointer border border-blue-300 no-underline"
                  aria-label={`View source ${citationNumber}`}
                >
                  {citationNumber}
                </a>
                {hoveredCitation === citationNumber - 1 && source && (
                  <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg pointer-events-none">
                    <div className="font-semibold mb-1 break-words">
                      {source.title}
                    </div>
                    <div className="text-gray-300 break-all text-[10px]">
                      {source.url}
                    </div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                  </div>
                )}
              </span>
            );
          })}
        </sup>
      );

      lastIndex = matchIndex + fullMatch.length;
    }

    // Add remaining text after last citation
    if (lastIndex < text.length) {
      parts.push(<span key={`text-end-${lastIndex}`}>{text.slice(lastIndex)}</span>);
    }

    return parts;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!query.trim()) {
      setError("Please enter a search query");
      return;
    }

    const submittedQuery = query.trim();

    // Reset state for new query
    setCurrentQuery(submittedQuery);
    setError(null);
    setSources([]);
    setAnswer("");
    setCurrentReformulatedQuery(null);
    setLoading(true);
    setLoadingState("searching");
    setQuery(""); // Clear input box

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: submittedQuery,
          conversationHistory: conversationHistory.length > 0 ? conversationHistory : undefined,
        }),
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

      // Track values locally for adding to history
      let finalAnswer = "";
      let finalSources: SearchResult[] = [];
      let finalReformulatedQuery: string | null = null;

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

              if (parsed.type === "reformulated_query") {
                finalReformulatedQuery = parsed.query;
                setCurrentReformulatedQuery(parsed.query);
              } else if (parsed.type === "sources") {
                finalSources = parsed.sources;
                setSources(parsed.sources);
                setLoadingState("generating");
              } else if (parsed.type === "text") {
                finalAnswer += parsed.content;
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

      // After successful completion, add to conversation history
      setConversationHistory((prev) => [
        ...prev,
        {
          query: submittedQuery,
          answer: finalAnswer,
          sources: finalSources,
          reformulatedQuery: finalReformulatedQuery || undefined,
        },
      ]);

      // Clear current state after adding to history
      setCurrentQuery("");
      setAnswer("");
      setSources([]);
      setCurrentReformulatedQuery(null);

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
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-center flex-1">Perplexity</h1>
          {conversationHistory.length > 0 && (
            <button
              onClick={() => {
                setConversationHistory([]);
                setSources([]);
                setAnswer("");
                setCurrentReformulatedQuery(null);
                setCurrentQuery("");
                setQuery("");
              }}
              className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Clear conversation
            </button>
          )}
        </div>

        {/* Conversation History */}
        {conversationHistory.length > 0 && (
          <div className="mb-8 space-y-8">
            {conversationHistory.map((entry, index) => (
              <div key={index}>
                {/* Previous Query */}
                <div className="mb-4">
                  <div className="text-lg font-semibold text-gray-900 mb-1">{entry.query}</div>
                  {entry.reformulatedQuery && (
                    <div className="text-xs text-gray-500 italic">
                      Refined: {entry.reformulatedQuery}
                    </div>
                  )}
                </div>

                {/* Previous Sources (collapsed) */}
                {entry.sources.length > 0 && (
                  <div className="mb-4">
                    <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                      📚 {entry.sources.length} source{entry.sources.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}

                {/* Previous Answer */}
                <div className="prose prose-blue max-w-none p-6 bg-white border border-gray-200 rounded-lg overflow-visible">
                  <div className="text-gray-800 leading-relaxed overflow-visible">
                    {renderAnswerWithCitations(entry.answer, entry.sources)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Current Query and Answer Section */}
        {currentQuery && (loading || sources.length > 0 || answer) && (
          <div className="mb-8">
            {/* Current Query Display */}
            <div className="mb-4">
              <div className="text-lg font-semibold text-gray-900 mb-1">{currentQuery}</div>
              {currentReformulatedQuery && (
                <div className="text-xs text-gray-500 italic">
                  Refined: {currentReformulatedQuery}
                </div>
              )}
            </div>

            {/* Loading States */}
            {loadingState === "searching" && (
              <div className="text-center text-gray-600 py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                <p>Searching...</p>
              </div>
            )}

            {/* Sources Display */}
            {sources.length > 0 && (
              <div className="mb-4" ref={sourcesContainerRef}>
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
              <div>
                <div className="prose prose-blue max-w-none p-6 bg-white border border-gray-200 rounded-lg overflow-visible">
                  <div className="text-gray-800 leading-relaxed overflow-visible">
                    {renderAnswerWithCitations(answer)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Search Form - At Bottom */}
        <form onSubmit={handleSubmit} className="mt-8">
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
      </div>
    </main>
  );
}
