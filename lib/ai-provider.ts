import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

/**
 * Supported AI provider types
 */
export type AIProviderType = "ollama" | "gemini";

/**
 * Configuration for Ollama provider (OpenAI-compatible)
 */
interface OllamaConfig {
  baseURL: string;
  model: string;
  apiKey?: string;
}

/**
 * Configuration for Gemini provider
 */
interface GeminiConfig {
  apiKey: string;
  model: string;
}

/**
 * Get the configured AI provider based on environment variables
 *
 * Environment variables:
 * - AI_PROVIDER: "ollama" | "gemini" (defaults to "ollama" for development)
 * - OLLAMA_BASE_URL: Ollama API endpoint (e.g., "http://localhost:11434/v1")
 * - OLLAMA_MODEL: Model name for Ollama (e.g., "llama3.2")
 * - OLLAMA_API_KEY: Optional API key for Ollama (defaults to "ollama")
 * - GOOGLE_GENERATIVE_AI_API_KEY: API key for Gemini
 * - GEMINI_MODEL: Model name for Gemini (defaults to "gemini-1.5-flash")
 *
 * @returns Configured LanguageModel instance
 * @throws Error if provider configuration is invalid or missing
 */
export function getAIProvider(): LanguageModel {
  const providerType = (process.env.AI_PROVIDER || "ollama") as AIProviderType;

  switch (providerType) {
    case "ollama":
      return getOllamaProvider();
    case "gemini":
      return getGeminiProvider();
    default:
      throw new Error(
        `Invalid AI_PROVIDER: "${providerType}". Must be "ollama" or "gemini".`
      );
  }
}

/**
 * Create Ollama provider using OpenAI-compatible API
 *
 * @returns Configured Ollama LanguageModel
 * @throws Error if Ollama configuration is missing or invalid
 */
function getOllamaProvider(): LanguageModel {
  const baseURL = process.env.OLLAMA_BASE_URL;
  const model = process.env.OLLAMA_MODEL;
  const apiKey = process.env.OLLAMA_API_KEY || "ollama";

  if (!baseURL) {
    throw new Error(
      "OLLAMA_BASE_URL is not configured. Please add it to your .env.local file. " +
      "Example: OLLAMA_BASE_URL=http://localhost:11434/v1"
    );
  }

  if (!model) {
    throw new Error(
      "OLLAMA_MODEL is not configured. Please add it to your .env.local file. " +
      "Example: OLLAMA_MODEL=llama3.2"
    );
  }

  try {
    const ollama = createOpenAI({
      baseURL,
      apiKey,
    });

    return ollama(model);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to initialize Ollama provider with base URL "${baseURL}" and model "${model}". ` +
        `Error: ${error.message}`
      );
    }
    throw new Error(
      `Failed to initialize Ollama provider with base URL "${baseURL}" and model "${model}". ` +
      `Unknown error occurred.`
    );
  }
}

/**
 * Create Gemini provider using Google AI SDK
 *
 * @returns Configured Gemini LanguageModel
 * @throws Error if Gemini configuration is missing or invalid
 */
function getGeminiProvider(): LanguageModel {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";

  if (!apiKey) {
    throw new Error(
      "GOOGLE_GENERATIVE_AI_API_KEY is not configured. Please add it to your .env.local file. " +
      "Get your API key from: https://aistudio.google.com/app/apikey"
    );
  }

  try {
    const google = createGoogleGenerativeAI({
      apiKey,
    });

    return google(model);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to initialize Gemini provider with model "${model}". ` +
        `Error: ${error.message}`
      );
    }
    throw new Error(
      `Failed to initialize Gemini provider with model "${model}". ` +
      `Unknown error occurred.`
    );
  }
}
