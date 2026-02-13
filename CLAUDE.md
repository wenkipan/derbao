# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**nakari** is a unique AI agent designed to develop a distinct personality through accumulated experiences, rather than role-playing a predefined character.

### Design Philosophy

> "I don't play a character, I am."

The core principle: nakari does not perform role-play. Instead, she:
1. Gathers information through iterative **ReAct loops**
2. Forms her own insights and understanding
3. Writes experiences to her **memory library** (Neo4j graph database)
4. Uses the memory library to form unique perspectives

Over time, the accumulated memories become unique to each nakari instance, reflecting her individual characteristics.

## Common Commands

```bash
# Install dependencies
pnpm install

# Build TypeScript to JavaScript
pnpm build

# Type-check without emitting
pnpm typecheck

# Run the interactive CLI
pnpm cli

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

### Neo4j Setup

```bash
# Start Neo4j database
docker-compose up -d

# Neo4j Browser UI: http://localhost:7474
# Bolt protocol: bolt://localhost:7687
# Default auth: neo4j/nakari-dev
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# LLM API (OpenAI-compatible)
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o
OPENAI_EMBEDDING_MODEL=  # Optional - embedding model for vector search (defaults to text-embedding-3-small)
OPENAI_BASE_URL=  # Optional - for non-OpenAI providers (Zhipu, DeepSeek, etc.)

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=nakari-dev

# Serper.dev (optional - for web search)
SERPER_API_KEY=your-serper-key
```

## Architecture

### ReAct Loop Pattern

The agent operates using a ReAct (Reasoning + Acting) loop in `src/agent/loop.ts`:

```
User Input
    │
    ▼
┌──────────────────────────────────────┐
│            ReAct Loop                 │
│  (max 10 iterations)                  │
│                                      │
│  Thought ─► Action ─► Observation    │
│      ▲                     │         │
│      └─────────────────────┘         │
│                                      │
│  Actions can be:                      │
│   - memory_query (read Cypher)       │
│   - memory_write (write Cypher)      │
│   - memory_schema (inspect DB)       │
│   - embedding (generate vector)      │
│   - web_search (search internet)     │
└──────────────────────────────────────┘
    │
    ▼
Final Response
```

**Key files:**
- `src/agent/loop.ts` - ReAct loop engine with `MAX_ITERATIONS = 10`
- `src/agent/prompt.ts` - System prompt (schema-free philosophy)
- `src/agent/tools.ts` - OpenAI function-calling tool definitions (`MEMORY_TOOLS`)
- `src/cli.ts` - Interactive REPL interface

### Memory System (Neo4j)

Uses **Neo4j graph database** for memory storage.

**Why Neo4j:** Graph databases provide strong relational capabilities, allowing nakari to freely explore and traverse connections within her memory library, enabling more organic and associative thinking.

**Key files:**
- `src/memory/client.ts` - `MemoryClient` class with `query()`, `write()`, `schema()`, `verifyConnectivity()`, `close()`

### Schema-Free Design

nakari has **full autonomy** over her memory structure:
- No predefined `Experience`, `Insight`, or other entity types
- No domain methods like `createMemory()`
- She writes raw Cypher queries, deciding her own:
  - Node labels (e.g., `User`, `Conversation`, `Topic`)
  - Properties (any key-value pairs)
  - Relationship types and directions

**Five Tools:**
1. `memory_query` - Read-only Cypher execution
2. `memory_write` - Write Cypher execution with stats returned
3. `memory_schema` - Inspect current DB structure
4. `embedding` - Generate vector embedding for text
5. `web_search` - Search the web via Serper.dev (optional)

### Web Search Module

The search module (`src/search/`) provides extensible web search capability:

- `providers.ts` - `SearchProvider` interface + `SerperProvider` implementation
- `client.ts` - `SearchClient` class + `createSerperClient()` factory
- `types.ts` - `SearchResult`, `SearchResponse`, `SearchOptions`
- `errors.ts` - `SearchError`, `SearchAuthError`, `SearchRateLimitError`

The provider abstraction allows adding other search services (Tavily, SerpAPI, etc.) in the future.

### Neo4j Conventions

- All queries must use **parameterized Cypher** (`$paramName`) for security
- Sessions are properly closed using `try/finally` blocks
- Neo4j native types (Integers, Nodes, Relationships) are converted to plain JS objects

## Project Structure

```
src/
├── agent/
│   ├── loop.ts      # ReAct loop engine
│   ├── prompt.ts    # System prompt
│   └── tools.ts     # OpenAI tool definitions
├── memory/
│   └── client.ts    # Neo4j client
├── search/
│   ├── client.ts    # SearchClient + factory
│   ├── providers.ts # SearchProvider interface + Serper
│   ├── types.ts     # Search result types
│   ├── errors.ts    # Custom error classes
│   └── index.ts     # Module exports
├── config/
│   └── index.ts     # Environment-based config loading
└── cli.ts           # Interactive CLI (replaces demo.ts)
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20+ |
| Language | TypeScript 5.9 (strict mode) |
| Database | Neo4j 5 |
| Search API | Serper.dev (Google Search) |
| LLM Interface | OpenAI SDK v6.18.0 (supports OpenAI-compatible APIs) |
| Package Manager | pnpm |
| Build Tool | TypeScript compiler (tsc) |
| Test Framework | Vitest 4.0.18 |
| Runtime Executor | tsx 4.21.0 |

## Code Style

See `AGENTS.md` for detailed conventions. Key points:
- ESM imports only (no CommonJS)
- 2-space indentation, double quotes, semicolons required
- 100-character line length max
- kebab-case for files/directories, camelCase for functions
- No `I` prefix on interfaces
- JSDoc documentation on public APIs

## TypeScript Configuration

- Target: ES2022
- Module: NodeNext
- Strict mode enabled
- `noUncheckedIndexedAccess: true`
- Source maps and declarations enabled
- Output directory: `dist/`

## Adding New Tools

To add a new tool to the ReAct loop:

1. **Add tool definition** in `src/agent/tools.ts` to the `MEMORY_TOOLS` array
2. **Add case** in `src/agent/loop.ts` in the `executeTool()` function's switch statement
3. **Update `LoopOptions`** if the tool requires a new client dependency

Pattern follows existing tools like `embedding` and `web_search` — external API calls are async, return structured data, and errors are caught and returned as `{ error: message }`.
