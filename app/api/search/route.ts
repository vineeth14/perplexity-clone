import { NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { z } from "zod";

import { getAIProvider } from "@/lib/ai-provider";
import { processRawContent } from "@/lib/content-processor";
import { searchTavily, mergeSearchResults } from "@/lib/search";

import type { APIError, SearchResult, ConversationEntry } from "@/types";

/**
 * Zod schema for validating search request payload
 */
const conversationEntrySchema = z.object({
  query: z.string(),
  answer: z.string(),
  sources: z.array(z.any()),
  reformulatedQuery: z.string().optional(),
});

const searchRequestSchema = z.object({
  query: z.string().min(1, "Query cannot be empty").trim(),
  conversationHistory: z.array(conversationEntrySchema).optional(),
});

/**
 * Reformulate a query based on the previous query using Gemini
 * @param query - The user's current query
 * @param history - Array of previous conversation entries
 * @param apiKey - Gemini API key
 * @param model - Gemini model name
 * @returns Reformulated query string
 */
async function reformulateQuery(
  query: string,
  history: ConversationEntry[],
  apiKey: string,
  model: string
): Promise<string> {
  // Only use the most recent query for context
  const previousQuery = history[history.length - 1]?.query || "";

  const reformulationPrompt = `You are a search query optimization assistant. Your task is to reformulate follow-up questions into comprehensive, standalone search queries.

Previous query: "${previousQuery}"
Follow-up query: "${query}"

Instructions:
- If the follow-up query references the previous query (uses words like "it", "that", "more", "they", "this"), reformulate it to be specific and standalone
- Incorporate the key subject/topic from the previous query into the new query
- Make the query optimized for web search (clear, specific, complete)
- If the follow-up query is already standalone and complete, return it as-is
- Return ONLY the reformulated query text, no explanations

Reformulated search query:`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
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
                text: reformulationPrompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 100,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const reformulated =
    data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || query;

  return reformulated;
}

/**
 * Build a context prompt from search results for the AI to use
 * @param query - The user's search query
 * @param results - Array of search results from Tavily
 * @param conversationHistory - Optional array of previous conversation entries
 * @returns Formatted prompt string with search context
 */
function buildContextPrompt(
  query: string,
  results: SearchResult[],
  conversationHistory?: ConversationEntry[]
): string {
  const sourcesContext = results
    .map((result, index) => {
      const contentToUse = result.fullContent || result.content;
      return `[${index + 1}] ${result.title}\nURL: ${result.url}\nContent: ${contentToUse}\n`;
    })
    .join("\n");

  let conversationContext = "";
  if (conversationHistory && conversationHistory.length > 0) {
    conversationContext = `\n\nPrevious Conversation:\n${conversationHistory
      .map((entry, i) => {
        return `Q${i + 1}: ${entry.query}\nA${i + 1}: ${entry.answer}`;
      })
      .join("\n\n")}\n`;
  }

  return `You are a helpful AI assistant that provides concise, well-sourced answers based on search results.${conversationContext}

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
${conversationHistory && conversationHistory.length > 0 ? "- Consider the conversation context when formulating your answer" : ""}

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

    const { query, conversationHistory } = validationResult.data;

    // Step 2: Reformulate query if conversation history exists
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "GOOGLE_GENERATIVE_AI_API_KEY is not configured",
          details: "Please add it to your .env.local file.",
        } as APIError,
        { status: 500 }
      );
    }

    let reformulatedQuery: string | null = null;
    if (conversationHistory && conversationHistory.length > 0) {
      try {
        reformulatedQuery = await reformulateQuery(
          query,
          conversationHistory,
          apiKey,
          model
        );
      } catch (error) {
        console.error("Failed to reformulate query:", error);
        // Continue with original query if reformulation fails
      }
    }

    // Step 3: Fetch search results from Tavily
    let searchResults: SearchResult[];
    try {
      if (reformulatedQuery) {
        // Search with both queries and merge results
        const [originalResults, reformulatedResults] = await Promise.all([
          searchTavily(query),
          searchTavily(reformulatedQuery),
        ]);
        searchResults = mergeSearchResults(originalResults, reformulatedResults);
      } else {
        searchResults = await searchTavily(query);
      }

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

    // Step 4: Build context prompt from search results
    const prompt = buildContextPrompt(query, searchResults, conversationHistory);

    // Step 5: Stream AI response with sources prepended (using Gemini)
    try {
      // Create a custom stream that first sends sources, then the AI response
      const encoder = new TextEncoder();
      const customStream = new ReadableStream({
        async start(controller) {
          try {
            // Send reformulated query if it exists
            if (reformulatedQuery) {
              const reformulatedChunk = JSON.stringify({
                type: "reformulated_query",
                query: reformulatedQuery,
              });
              controller.enqueue(
                encoder.encode(`data: ${reformulatedChunk}\n\n`)
              );
            }

            // Send sources as the second chunk (as JSON)
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
                    maxOutputTokens: 2048,
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
