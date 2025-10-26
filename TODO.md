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

## Phase 3: AI Provider Setup ⬜

**Goal:** Flexible AI provider abstraction

### Tasks

- [ ] Create `/lib/ai-provider.ts`
  - [ ] `getAIProvider()` factory function
  - [ ] Ollama support (OpenAI-compatible, default for testing)
  - [ ] Gemini support (for production)
  - [ ] Environment-based switching (AI_PROVIDER env var)

### Verification Commands

```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# Will provide test endpoint after implementation
```

### Success Criteria

- ✓ Returns correct provider based on AI_PROVIDER env var
- ✓ Ollama uses OpenAI-compatible endpoint
- ✓ Gemini uses Google AI SDK
- ✓ Fails gracefully with clear error if provider unavailable

---

## Phase 4: API Route ⬜

**Goal:** Working search endpoint that streams AI responses

### Tasks

- [ ] Create `/app/api/search/route.ts`
  - [ ] POST handler with Zod validation
  - [ ] Call `searchTavily()` and return sources
  - [ ] Build context prompt from search results
  - [ ] Stream AI response using Vercel AI SDK
  - [ ] Verbose error handling at each step

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

- [ ] Update `/app/page.tsx` to Client Component
  - [ ] Search input with submit handler
  - [ ] Fetch to `/api/search` endpoint
  - [ ] Display sources immediately (cards with title, URL, snippet)
  - [ ] Stream AI response below sources
  - [ ] Render inline citations [1], [2], etc.
  - [ ] Loading states (searching, generating)
  - [ ] Error display with details

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

- ✓ Sources appear before AI response
- ✓ AI response streams token by token
- ✓ Citations [1], [2] match source indices
- ✓ Source cards are clickable links
- ✓ Loading states provide feedback
- ✓ Errors display with helpful messages

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
