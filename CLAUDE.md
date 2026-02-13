# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**nakari** is a unique AI agent designed to develop a distinct personality through accumulated experiences, rather than role-playing a predefined character.

This is the **Python implementation** of nakari. The original TypeScript version has been replaced.

## Common Commands

```bash
# Install dependencies
pip install -e .

# Run the interactive CLI
nakari

# Or run with Python module
python -m nakari.cli

# Run tests
pytest
```

### Neo4j Setup

```bash
# Start Neo4j database
docker compose up -d

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

The agent operates using a ReAct (Reasoning + Acting) loop in `nakari/agent/loop.py`:

```
User Input
    │
    ▼
┌───────────────────────────────────────┐
│            ReAct Loop                 │
│  (max 10 iterations)              │
│                                      │
│  Thought ─► Action ─► Observation│
│      ▲                    │         │
│      └─────────────────────┘         │
│                                      │
│  Actions can be:                      │
│   - memory_query (read Cypher)       │
│   - memory_write (write Cypher)      │
│   - memory_schema (inspect DB)       │
│   - embedding (generate vector)      │
│   - web_search (search internet)   │
└───────────────────────────────────────┘
    │
    ▼
Final Response
```

**Key files:**
- `nakari/agent/loop.py` - ReAct loop engine with `MAX_ITERATIONS = 10`
- `nakari/agent/prompt.py` - System prompt (schema-free philosophy)
- `nakari/agent/tools.py` - OpenAI function-calling tool definitions
- `nakari/cli.py` - Interactive REPL interface

### Memory System (Neo4j)

Uses **Neo4j graph database** for memory storage.

**Why Neo4j:** Graph databases provide strong relational capabilities, allowing nakari to freely explore and traverse connections within her memory library, enabling more organic and associative thinking.

**Key module:**
- `nakari/memory` - `MemoryClient` class with `query()`, `write()`, `schema()`, `verify_connectivity()`, `close()`

### Schema-Free Design

nakari has **full autonomy** over her memory structure:
- No predefined `Experience`, `Insight`, or other entity types
- No domain methods like `create_memory()`
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

The search module (`nakari/search/`) provides extensible web search capability:

- `providers.py` - `SearchProvider` interface + `SerperProvider` implementation
- `client.py` - `SearchClient` class + `create_serper_client()` factory
- `types.py` - `SearchResult`, `SearchResponse`, `SearchOptions`
- `errors.py` - `SearchError`, `SearchAuthError`, `SearchRateLimitError`

## Project Structure

```
derbao/
├── nakari/            # Package and code
│   ├── agent/         # ReAct loop implementation
│   ├── cli.py          # Interactive CLI
│   ├── config/         # Environment-based config
│   ├── memory/         # Neo4j memory client
│   └── search/         # Web search module
├── pyproject.toml     # Python project config
├── requirements.txt   # Python dependencies
├── README.md         # Project documentation
├── docker-compose.yml # Neo4j Docker config
└── ...
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Python 3.12+ |
| Database | Neo4j 5 |
| Search API | Serper.dev (Google Search) |
| LLM Interface | OpenAI SDK (supports OpenAI-compatible APIs) |
| Package Manager | pip / pyproject |
| Build Tool | Hatchling |
| CLI UI | Rich |
| Async Runtime | asyncio |

## Code Style

- 2-space indentation, double quotes, semicolons required
- 100-character line length max
- snake_case for files/directories, functions, and variables
- PascalCase for classes
- Type hints required on all public APIs
- Docstrings on public APIs
- async/await for I/O operations

## Adding New Tools

To add a new tool to the ReAct loop:

1. **Add tool definition** in `nakari/agent/tools.py` to the `get_memory_tools()` function
2. **Add case** in `nakari/agent/loop.py` in the `_execute_tool()` function's match statement
3. **Update `LoopOptions`** if the tool requires a new client dependency

Pattern follows existing tools like `embedding` and `web_search` — external API calls are async, return structured data, and errors are caught and returned as `{ error: message }`.
