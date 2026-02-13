# nakari

**nakari** is a unique AI agent designed to develop a distinct personality through accumulated experiences, rather than role-playing a predefined character.

## Design Philosophy

> "I don't play a character, I am."

The core principle: nakari does not perform role-play. Instead, she:
1. Gathers information through iterative **ReAct loops**
2. Forms her own insights and understanding
3. Writes experiences to her **memory library** (Neo4j graph database)
4. Uses the memory library to form unique perspectives

Over time, the accumulated memories become unique to each nakari instance, reflecting her individual characteristics.

## Installation

```bash
# Install dependencies
pip install -e .

# Or install from requirements.txt
pip install -r requirements.txt
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

## Usage

```bash
# Run the interactive CLI
nakari

# Or using Python module
python -m nakari.cli
```

### CLI Commands

- `/quit` or `/exit` - Exit the conversation
- `/help` - Show help message
- `/schema` - Display database schema

## Architecture

### ReAct Loop Pattern

The agent operates using a ReAct (Reasoning + Acting) loop:

```
User Input
    │
    ▼
┌──────────────────────────────────────┐
│            ReAct Loop                 │
│  (max 10 iterations)              │
│                                   │
│  Thought ─► Action ─► Observation│
│      ▲                    │        │
│      └─────────────────────┘        │
│                                   │
│  Actions can be:                    │
│   - memory_query (read Cypher)     │
│   - memory_write (write Cypher)    │
│   - memory_schema (inspect DB)     │
│   - embedding (generate vector)     │
│   - web_search (search internet)   │
└──────────────────────────────────────┘
    │
    ▼
Final Response
```

**Key modules:**
- `nakari/agent/loop.py` - ReAct loop engine with `MAX_ITERATIONS = 10`
- `nakari/agent/prompt.py` - System prompt (schema-free philosophy)
- `nakari/agent/tools.py` - OpenAI function-calling tool definitions
- `nakari/cli.py` - Interactive REPL interface

### Memory System (Neo4j)

Uses **Neo4j graph database** for memory storage.

**Why Neo4j:** Graph databases provide strong relational capabilities, allowing nakari to freely explore and traverse connections within her memory library, enabling more organic and associative thinking.

**Key module:**
- `nakari/memory/` - `MemoryClient` class with `query()`, `write()`, `schema()`, `verify_connectivity()`, `close()`

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
nakari/
├── __init__.py
├── cli.py            # Interactive CLI
├── config/           # Environment-based config
│   └── __init__.py
├── agent/            # ReAct loop implementation
│   ├── __init__.py
│   ├── loop.py       # ReAct loop engine
│   ├── prompt.py     # System prompt
│   └── tools.py      # OpenAI tool definitions
├── memory/           # Neo4j memory client
│   └── __init__.py
└── search/           # Web search module
    ├── __init__.py
    ├── client.py
    ├── providers.py
    ├── types.py
    └── errors.py
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Python 3.12+ |
| Database | Neo4j 5 |
| Search API | Serper.dev (Google Search) |
| LLM Interface | OpenAI SDK (supports OpenAI-compatible APIs) |
| CLI UI | Rich |
| Async Runtime | asyncio |

## License

MIT
