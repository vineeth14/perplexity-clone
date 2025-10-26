import type { SearchResult } from "@/types";

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
        include_raw_content: false,
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
