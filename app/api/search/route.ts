import { NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { z } from "zod";

import { getAIProvider } from "@/lib/ai-provider";
import { processRawContent } from "@/lib/content-processor";
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
      const contentToUse = result.fullContent || result.content;
      return `[${index + 1}] ${result.title}\nURL: ${result.url}\nContent: ${contentToUse}\n`;
    })
    .join("\n");

  return `You are a helpful AI assistant that provides concise, well-sourced answers based on search results.

User Query: ${query}

Search Results:
${sourcesContext}

Instructions:
- Provide a CONCISE answer (2-3 sentences maximum) using ONLY the information from the search results above
- Use inline citations in the format [1], [2], etc. to reference the sources
- Use AT LEAST 2 citations if the sources contain similar or complementary information
- If the search results don't contain enough information, state this briefly
- Match citation numbers to the source numbers provided above
- Keep your response brief and to the point

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

      // Process raw content for each result to create richer context
      searchResults = searchResults.map((result) => {
        try {
          const fullContent = result.raw_content
            ? processRawContent(result.raw_content)
            : result.content;
          return {
            ...result,
            fullContent,
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error occurred";
          console.error(
            `Failed to process raw_content for source "${result.title}". Error: ${errorMessage}. Falling back to snippet.`
          );
          return {
            ...result,
            fullContent: result.content,
          };
        }
      });
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

    // Step 4: Stream AI response with sources prepended (using Gemini)
    try {
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

      if (!apiKey) {
        throw new Error(
          "GOOGLE_GENERATIVE_AI_API_KEY is not configured. Please add it to your .env.local file."
        );
      }

      // Create a custom stream that first sends sources, then the AI response
      const encoder = new TextEncoder();
      const customStream = new ReadableStream({
        async start(controller) {
          try {
            // Send sources as the first chunk (as JSON)
            const sourcesChunk = JSON.stringify({
              type: "sources",
              sources: searchResults,
            });
            controller.enqueue(encoder.encode(`data: ${sourcesChunk}\n\n`));

            // Make direct fetch to Gemini
            const response = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  contents: [
                    {
                      parts: [
                        {
                          text: prompt,
                        },
                      ],
                    },
                  ],
                  generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 500,
                  },
                }),
              }
            );

            if (!response.ok) {
              const errorText = await response.text();
              console.error("Gemini API error:", {
                status: response.status,
                statusText: response.statusText,
                body: errorText,
              });
              throw new Error(
                `Gemini API returned status ${response.status}: ${errorText}`
              );
            }

            console.log("Gemini API response OK, starting to stream...");

            if (!response.body) {
              throw new Error("No response body from Gemini");
            }

            // Stream the response - Gemini returns formatted JSON array or NDJSON
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });

              // Try to extract complete JSON objects from the buffer
              // Gemini may send: [{...},{...}] or {...}\n{...}\n
              let processedSomething = true;
              while (processedSomething && buffer.length > 0) {
                processedSomething = false;
                const trimmed = buffer.trimStart();

                // Skip empty buffer
                if (trimmed.length === 0) break;

                // Handle array start
                if (trimmed.startsWith('[')) {
                  buffer = trimmed.substring(1);
                  continue;
                }

                // Handle array end or trailing comma
                if (trimmed.startsWith(']') || trimmed.startsWith(',')) {
                  buffer = trimmed.substring(1);
                  processedSomething = true;
                  continue;
                }

                // Try to find a complete JSON object
                if (trimmed.startsWith('{')) {
                  let braceCount = 0;
                  let inString = false;
                  let escaped = false;
                  let endIndex = -1;

                  for (let i = 0; i < trimmed.length; i++) {
                    const char = trimmed[i];

                    if (escaped) {
                      escaped = false;
                      continue;
                    }

                    if (char === '\\') {
                      escaped = true;
                      continue;
                    }

                    if (char === '"') {
                      inString = !inString;
                      continue;
                    }

                    if (!inString) {
                      if (char === '{') braceCount++;
                      if (char === '}') {
                        braceCount--;
                        if (braceCount === 0) {
                          endIndex = i + 1;
                          break;
                        }
                      }
                    }
                  }

                  if (endIndex > 0) {
                    const jsonStr = trimmed.substring(0, endIndex);
                    buffer = trimmed.substring(endIndex);
                    processedSomething = true;

                    try {
                      const parsed = JSON.parse(jsonStr);

                      // Check if there's an error in the response
                      if (parsed.error) {
                        console.error("Gemini returned an error:", parsed.error);
                        throw new Error(parsed.error.message || "Gemini API error");
                      }

                      const content =
                        parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";

                      if (content) {
                        // Convert to SSE format for frontend
                        const textChunk = JSON.stringify({
                          type: "text",
                          content,
                        });
                        controller.enqueue(
                          encoder.encode(`data: ${textChunk}\n\n`)
                        );
                      }
                    } catch (e) {
                      if (e instanceof Error) {
                        console.error("Failed to parse Gemini JSON object:", {
                          json: jsonStr.substring(0, 200),
                          error: e.message,
                        });
                      }
                    }
                  } else {
                    // Incomplete object, wait for more data
                    break;
                  }
                } else {
                  // Unexpected format, skip this character
                  buffer = trimmed.substring(1);
                  processedSomething = true;
                }
              }
            }

            // Send done signal when streaming completes successfully
            const doneChunk = JSON.stringify({ type: "done" });
            controller.enqueue(encoder.encode(`data: ${doneChunk}\n\n`));
          } catch (error) {
            const errorMessage =
              error instanceof Error
                ? error.message
                : "Unknown streaming error";
            console.error("Streaming error details:", {
              error: errorMessage,
              stack: error instanceof Error ? error.stack : undefined,
            });
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
