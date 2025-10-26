# Perplexity Clone

A conversational search engine built with Next.js that combines web search with AI-powered answers and citations.

## Features

### Core Functionality
- **AI-Powered Search**: Combines Tavily web search with Google Gemini to generate concise, cited answers
- **Conversation History**: Multi-turn conversations with context-aware follow-up queries
- **Smart Query Reformulation**: Automatically enhances follow-up questions using previous context
- **Dual Search Strategy**: Searches with both original and reformulated queries, merging results for comprehensive coverage

### Citations & Sources
- **Clickable Citations**: Click citation numbers to visit source URLs directly
- **Hover Tooltips**: Preview source title and URL on hover
- **Source Display**: Expandable source list with full details
- **Citation Highlighting**: Click citations to scroll and highlight sources

### UI/UX
- **Streaming Responses**: Token-by-token answer display for real-time feedback
- **Chat-Like Interface**: Search input at bottom, conversation history above
- **Auto-Clear Input**: Input clears after submission for seamless follow-ups
- **Refined Query Display**: Shows AI-improved search queries when applicable

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI Model**: Google Gemini 2.5 Flash
- **Search API**: Tavily
- **Deployment**: Vercel-ready

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Google Gemini API key
- Tavily API key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd perplexity-clone
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file:
```bash
cp .env.example .env.local
```

4. Add your API keys to `.env.local`:
```env
TAVILY_API_KEY=your_tavily_api_key
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key
GEMINI_MODEL=gemini-2.5-flash
AI_PROVIDER=gemini
```

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use the application.

### Building for Production

```bash
npm run build
npm start
```

## How It Works

1. **User Query**: User enters a search query
2. **Query Reformulation** (for follow-ups): If there's conversation history, Gemini reformulates the query using previous context
3. **Dual Search**: Searches Tavily with both original and reformulated queries
4. **Result Merging**: Deduplicates and merges search results by URL
5. **Content Processing**: Extracts and processes full webpage content
6. **AI Generation**: Gemini generates a concise answer with inline citations
7. **Streaming Response**: Answer streams token-by-token to the frontend
8. **History Update**: Query and answer are added to conversation history

## Project Structure

```
perplexity-clone/
├── app/
│   ├── api/
│   │   └── search/
│   │       └── route.ts          # Search API endpoint
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Main search interface
│   └── globals.css               # Global styles
├── lib/
│   ├── search.ts                 # Tavily search utilities
│   ├── content-processor.ts      # HTML content processing
│   └── ai-provider.ts            # AI provider configuration
├── types/
│   └── index.ts                  # TypeScript type definitions
└── .env.local                    # Environment variables
```

## Key Features Explained

### Context-Aware Follow-ups

When you ask a follow-up question like "tell me more about that", the system:
1. Takes your previous query as context
2. Reformulates the vague follow-up into a specific, standalone query
3. Searches with both queries to ensure comprehensive results
4. Includes conversation history in the AI prompt for coherent answers

### Citation System

Citations are displayed as superscript numbers [1] [2] that:
- Open the source URL when clicked
- Show source preview on hover
- Support both single [1] and multi-citation [2, 7] formats
- Are limited to 1 per sentence in new responses for clarity

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TAVILY_API_KEY` | Tavily search API key | Yes |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Gemini API key | Yes |
| `GEMINI_MODEL` | Gemini model name (default: gemini-2.5-flash) | No |
| `AI_PROVIDER` | AI provider to use (gemini or ollama) | No |

## License

ISC

---

🤖 Built with [Claude Code](https://claude.com/claude-code)
