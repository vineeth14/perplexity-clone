import type { SearchResult } from "@/types";

/**
 * Merge and deduplicate search results from multiple queries
 * @param results1 - First set of search results
 * @param results2 - Second set of search results
 * @returns Merged array with duplicates removed (by URL) and sorted by score
 */
export function mergeSearchResults(
  results1: SearchResult[],
  results2: SearchResult[]
): SearchResult[] {
  const urlMap = new Map<string, SearchResult>();

  // Add all results from first set
  for (const result of results1) {
    urlMap.set(result.url, result);
  }

  // Add results from second set, keeping higher score if duplicate URL
  for (const result of results2) {
    const existing = urlMap.get(result.url);
    if (!existing || result.score > existing.score) {
      urlMap.set(result.url, result);
    }
  }

  // Convert to array and sort by score (descending)
  return Array.from(urlMap.values()).sort((a, b) => b.score - a.score);
}

/**
 * Search using Tavily API and return formatted results
 * @param query - The search query string
 * @returns Array of search results with title, URL, content, and score
 * @throws Error with context if API call fails
 */
export async function searchTavily(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    throw new Error(
      "TAVILY_API_KEY is not configured. Please add it to your .env.local file."
    );
  }

  if (!query.trim()) {
    throw new Error("Search query cannot be empty");
  }

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query.trim(),
        search_depth: "basic",
        include_answer: false,
        include_raw_content: true,
        max_results: 7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Tavily API returned status ${response.status}: ${errorText}`
      );
    }

    const data = await response.json();

    if (!data.results || !Array.isArray(data.results)) {
      throw new Error(
        `Unexpected Tavily API response format. Expected 'results' array but got: ${JSON.stringify(
          data
        )}`
      );
    }

    // Transform Tavily results to our SearchResult type
    const results: SearchResult[] = data.results.map(
      (result: {
        title: string;
        url: string;
        content: string;
        score: number;
        raw_content?: string;
      }) => ({
        title: result.title,
        url: result.url,
        content: result.content,
        score: result.score,
        raw_content: result.raw_content,
      })
    );

    return results;
  } catch (error) {
    // Re-throw with additional context
    if (error instanceof Error) {
      throw new Error(
        `Failed to fetch Tavily results for query: "${query}". Error: ${error.message}`
      );
    }
    throw new Error(
      `Failed to fetch Tavily results for query: "${query}". Unknown error occurred.`
    );
  }
}
