# Perplexity Clone - Implementation TODO

## Phase 1: Foundation ✅

**Goal:** Type definitions for the entire application

### Tasks

- [x] Create `/types/index.ts`
  - [x] `SearchResult` interface (Tavily response)
  - [x] `Citation` interface (source with index)
  - [x] `APISearchRequest` interface (query validation)
  - [x] `APISearchResponse` interface (sources + answer)
  - [x] `APIError` interface (structured errors)

### Verification Commands

```bash
# Should compile without errors
npm run build

# Check file exists and has exports
cat types/index.ts
```

### Success Criteria

- ✓ No TypeScript compilation errors
- ✓ All 5 interfaces exported
- ✓ No `any` types used

---

## Phase 2: Search Integration ✅

**Goal:** Working Tavily API integration

### Tasks

- [x] Create `/lib/search.ts`
  - [x] `searchTavily()` function with error handling
  - [x] Type-safe return (SearchResult[])
  - [x] Verbose error messages with context
  - [x] Request 5-7 results from Tavily

### Verification Commands

```bash
# Test with sample query
curl "http://localhost:3000/api/test-tavily?q=What+is+Next.js"
```

### Success Criteria

- ✅ Function returns 7 SearchResult objects
- ✅ Error messages include query context
- ✅ Handles missing API key gracefully

---

## Phase 3: AI Provider Setup ✅

**Goal:** Flexible AI provider abstraction

### Tasks

- [x] Create `/lib/ai-provider.ts`
  - [x] `getAIProvider()` factory function
  - [x] Ollama support (OpenAI-compatible, default for testing)
  - [x] Gemini support (for production)
  - [x] Environment-based switching (AI_PROVIDER env var)
- [x] Configure `.env.local` with Ollama settings (gemma2:2b model)
- [x] Create `.env.example` with all required variables

### Verification Commands

```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# Verify TypeScript compilation
npm run build
```

### Success Criteria

- ✅ Returns correct provider based on AI_PROVIDER env var
- ✅ Ollama uses OpenAI-compatible endpoint
- ✅ Gemini uses Google AI SDK
- ✅ Fails gracefully with clear error if provider unavailable
- ✅ TypeScript compiles without errors

---

## Phase 4: API Route ✅

**Goal:** Working search endpoint that streams AI responses

### Tasks

- [x] Create `/app/api/search/route.ts`
  - [x] POST handler with Zod validation
  - [x] Call `searchTavily()` and return sources
  - [x] Build context prompt from search results
  - [x] Stream AI response using Vercel AI SDK
  - [x] Verbose error handling at each step

### Verification Commands

```bash
# Start dev server
npm run dev

# Test basic query
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"What is TypeScript?"}'

# Test empty query (should return validation error)
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":""}'
```

### Success Criteria

- ✓ Returns streaming response with sources
- ✓ Validates query with Zod
- ✓ Error responses include context (query, error details)
- ✓ Sources returned before AI response starts

---

## Phase 5: UI Implementation ⬜

**Goal:** Interactive search interface with streaming

### Tasks

- [ ] Convert `/app/page.tsx` to Client Component
  - [ ] Add "use client" directive
  - [ ] Setup state: query, sources, answer, loading, error
- [ ] Implement search input form
  - [ ] Controlled input with onChange handler
  - [ ] Submit handler to fetch `/api/search`
  - [ ] Disable submit while processing
- [ ] Parse SSE stream from API
  - [ ] Use fetch() with manual SSE parsing
  - [ ] Handle "sources" type → set sources state
  - [ ] Handle "text" type → accumulate answer text
  - [ ] Handle "error" type → display error
- [ ] Display sources as cards
  - [ ] Grid/list layout above answer
  - [ ] Show title, URL, and snippet (truncated to ~150 chars)
  - [ ] Make URLs clickable links
- [ ] Stream AI answer display
  - [ ] Render below sources
  - [ ] Display citations [1], [2] inline (trust AI)
  - [ ] Accumulate text token-by-token
- [ ] Loading states
  - [ ] "Searching..." while fetching sources
  - [ ] "Generating answer..." while streaming
- [ ] Error handling
  - [ ] Inline error display below search input
  - [ ] Clear errors on new search

### Verification Commands

```bash
# Start dev server (if not already running)
npm run dev

# Open browser
open http://localhost:3000
```

### Manual Testing Steps

1. Type query: "What is Next.js?"
2. Submit and observe:
   - Loading state appears
   - Source cards display with title, URL
   - AI response streams below
   - Citations [1], [2] appear inline
3. Test error handling:
   - Submit empty query → should show validation error
   - Disconnect internet → should show fetch error

### Success Criteria

- ✓ Sources appear immediately after search
- ✓ AI response streams smoothly token by token
- ✓ Citations [1], [2] appear inline in answer
- ✓ Source cards show title + URL + snippet
- ✓ Loading states ("Searching..." → "Generating answer...")
- ✓ Errors display inline with clear messages
- ✓ Submit disabled during processing

---

## Phase 6: Polish & Testing ⬜

**Goal:** Production-ready with all requirements met

### Tasks

- [ ] Review all error messages are verbose
- [ ] Verify code follows style guide:
  - [ ] Imports grouped (external → internal → types)
  - [ ] Naming: camelCase (vars/funcs), PascalCase (components/types)
  - [ ] Explicit return types on all functions
  - [ ] JSDoc comments on public functions
- [ ] Test full flow end-to-end
- [ ] Final build and lint check

### Verification Commands

```bash
# Lint check
npm run lint

# Production build
npm run build

# Start production server
npm start
```

### End-to-End Test Queries

1. "What is TypeScript?"
2. "How does React Server Components work?"
3. "Explain the Next.js App Router"

### Success Criteria

- ✓ No lint errors
- ✓ Production build succeeds
- ✓ All 3 test queries return results with citations
- ✓ Citations match sources correctly
- ✓ Code follows all style conventions
- ✓ All error messages include context

---

## Notes

- Using Ollama during development for fast iteration
- Switch to Gemini (`gemini-1.5-flash`) for production
- Each phase builds on previous - verify before continuing
- Commit after each phase completion
