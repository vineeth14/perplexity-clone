# Perplexity Clone - Technical Specification

## Project Overview
TypeScript-based Perplexity clone: user submits query → fetch search results (Tavily) → AI generates response with citations → display sources + answer with inline citations [1], [2].

## Architecture & Structure
- **Framework**: Next.js 14 App Router (TypeScript, React Server Components)
- **AI Layer**: Vercel AI SDK with provider abstraction (Gemini default, OpenAI-compatible for Ollama)
- **Search**: Tavily Search API (5-7 results per query)
- **Structure**:
  - `/app/page.tsx` - Main UI (search input, results display)
  - `/app/api/search/route.ts` - API route handling query → Tavily → AI streaming
  - `/lib/ai-provider.ts` - Provider abstraction (Gemini/Ollama)
  - `/lib/search.ts` - Tavily integration
  - `/types/` - TypeScript interfaces (SearchResult, Citation, etc.)

## Code Style & Conventions
- **Imports**: Group by external → internal → types, alphabetically within groups
- **Naming**: camelCase for variables/functions, PascalCase for components/types, UPPER_SNAKE for constants
- **Types**: Explicit return types on all functions, strict TypeScript, no `any`
- **Error Handling**: Try-catch all API calls, verbose error messages with context (e.g., "Failed to fetch Tavily results for query: {query}. Error: {details}"), return structured errors `{error: string, details?: any}`
- **Async**: Prefer async/await over promises, handle loading/error states explicitly
- **Comments**: JSDoc for public functions, inline comments for complex logic only
