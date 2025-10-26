import { NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { z } from "zod";

import { getAIProvider } from "@/lib/ai-provider";
import { searchTavily } from "@/lib/search";

import type { APIError, SearchResult } from "@/types";

/**
 * Zod schema for validating search request payload
 */
const searchRequestSchema = z.object({
  query: z.string().min(1, "Query cannot be empty").trim(),
});

/**
 * Build a context prompt from search results for the AI to use
 * @param query - The user's search query
 * @param results - Array of search results from Tavily
 * @returns Formatted prompt string with search context
 */
function buildContextPrompt(query: string, results: SearchResult[]): string {
  const sourcesContext = results
    .map((result, index) => {
      return `[${index + 1}] ${result.title}\nURL: ${result.url}\nContent: ${result.content}\n`;
    })
    .join("\n");

  return `You are a helpful AI assistant that answers questions based on provided search results.

User Query: ${query}

Search Results:
${sourcesContext}

Instructions:
- Answer the user's query using ONLY the information from the search results above
- Use inline citations in the format [1], [2], etc. to reference the sources
- If the search results don't contain enough information, say so
- Be concise but comprehensive
- Match citation numbers to the source numbers provided above

Answer:`;
}

/**
 * POST /api/search
 * Handles search queries: validates input, fetches search results from Tavily,
 * and streams an AI-generated response with citations
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Step 1: Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to parse request body";
      return NextResponse.json(
        {
          error: "Invalid JSON in request body",
          details: errorMessage,
        } as APIError,
        { status: 400 }
      );
    }

    const validationResult = searchRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request: query is required and cannot be empty",
          details: validationResult.error.format(),
        } as APIError,
        { status: 400 }
      );
    }

    const { query } = validationResult.data;

    // Step 2: Fetch search results from Tavily
    let searchResults: SearchResult[];
    try {
      searchResults = await searchTavily(query);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      return NextResponse.json(
        {
          error: `Failed to fetch search results for query: "${query}"`,
          details: errorMessage,
        } as APIError,
        { status: 500 }
      );
    }

    // Validate that we got results
    if (!searchResults || searchResults.length === 0) {
      return NextResponse.json(
        {
          error: `No search results found for query: "${query}"`,
          details: "Tavily returned an empty result set",
        } as APIError,
        { status: 404 }
      );
    }

    // Step 3: Build context prompt from search results
    const prompt = buildContextPrompt(query, searchResults);

    // Step 4: Get AI provider and stream response
    let aiProvider;
    try {
      aiProvider = getAIProvider();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      return NextResponse.json(
        {
          error: "Failed to initialize AI provider",
          details: errorMessage,
        } as APIError,
        { status: 500 }
      );
    }

    // Step 5: Stream AI response with sources prepended
    try {
      const result = await streamText({
        model: aiProvider,
        prompt,
        temperature: 0.7,
      });

      // Create a custom stream that first sends sources, then the AI response
      const encoder = new TextEncoder();
      const customStream = new ReadableStream({
        async start(controller) {
          // Send sources as the first chunk (as JSON)
          const sourcesChunk = JSON.stringify({
            type: "sources",
            sources: searchResults,
          });
          controller.enqueue(encoder.encode(`data: ${sourcesChunk}\n\n`));

          // Now stream the AI response
          const reader = result.textStream.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              // Stream text chunks
              const textChunk = JSON.stringify({
                type: "text",
                content: value,
              });
              controller.enqueue(encoder.encode(`data: ${textChunk}\n\n`));
            }
          } catch (error) {
            const errorMessage =
              error instanceof Error
                ? error.message
                : "Unknown streaming error";
            const errorChunk = JSON.stringify({
              type: "error",
              error: "Error while streaming AI response",
              details: errorMessage,
            });
            controller.enqueue(encoder.encode(`data: ${errorChunk}\n\n`));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(customStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      return NextResponse.json(
        {
          error: `Failed to generate AI response for query: "${query}"`,
          details: errorMessage,
        } as APIError,
        { status: 500 }
      );
    }
  } catch (error) {
    // Catch-all error handler for unexpected errors
    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json(
      {
        error: "Internal server error while processing search request",
        details: errorMessage,
      } as APIError,
      { status: 500 }
    );
  }
}
