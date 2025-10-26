/**
 * Tavily search API response structure
 */
export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  raw_content?: string;
}

/**
 * Citation reference with index for inline display
 */
export interface Citation {
  index: number;
  title: string;
  url: string;
  snippet: string;
}

/**
 * Request payload for search API endpoint
 */
export interface APISearchRequest {
  query: string;
}

/**
 * Success response from search API endpoint
 */
export interface APISearchResponse {
  sources: SearchResult[];
  answer: string;
}

/**
 * Error response structure with context
 */
export interface APIError {
  error: string;
  details?: unknown;
}

/**
 * Combined response type for API endpoint
 */
export type APIResponse = APISearchResponse | APIError;

/**
 * Type guard to check if response is an error
 */
export function isAPIError(response: APIResponse): response is APIError {
  return 'error' in response;
}
