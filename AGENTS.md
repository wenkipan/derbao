# AGENTS.md

Guidelines for AI coding agents working in this repository.

## Project Overview

**nakari** is an AI agent that develops a distinct personality through accumulated
experiences rather than role-playing. Core philosophy: "I don't play a character, I am."

Key architecture components:
- **React loop** — iterative information gathering, reasoning, and response generation
- **MCP (Model Context Protocol)** — extensibility and service integration
- **Neo4j graph database** — memory storage with relational traversal

See `CLAUDE.md` and `SPCE.md` for full design philosophy and spec.

## Current Status

Early-stage project. No source code, build system, or dependencies exist yet.
The sections below establish conventions to follow as implementation begins.

## Planned Technology Stack

- **Runtime:** Node.js (LTS)
- **Language:** TypeScript (strict mode)
- **Database:** Neo4j (graph database for memory system)
- **Protocol:** MCP (Model Context Protocol) for service integration
- **Package manager:** pnpm (preferred) or npm

## Build / Lint / Test Commands

> These commands will become available once `package.json` is created.

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run all tests
pnpm test

# Run a single test file
pnpm test -- path/to/file.test.ts

# Run tests matching a name pattern
pnpm test -- -t "pattern"

# Lint
pnpm lint

# Format
pnpm format

# Type-check without emitting
pnpm typecheck
```

When setting up the project, define these scripts in `package.json`:
```jsonc
{
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src/",
    "format": "prettier --write .",
    "typecheck": "tsc --noEmit"
  }
}
```

Recommended test framework: **Vitest** (fast, native TypeScript/ESM support).

## Code Style Guidelines

### TypeScript Configuration

Use strict mode. Recommended `tsconfig.json` base settings:
- `"strict": true`
- `"target": "ES2022"` / `"module": "NodeNext"`
- `"moduleResolution": "NodeNext"`
- `"esModuleInterop": true`
- `"skipLibCheck": true`
- `"forceConsistentCasingInImports": true`
- `"noUncheckedIndexedAccess": true`

### Imports

- Use **ESM** (`import`/`export`), never CommonJS (`require`).
- Order imports in groups, separated by blank lines:
  1. Node built-ins (`node:fs`, `node:path`)
  2. External packages (`neo4j-driver`, `@modelcontextprotocol/sdk`)
  3. Internal modules (`../memory/store`, `./utils`)
- Prefer named exports over default exports.
- Use the `node:` prefix for Node.js built-in modules.

### Formatting

- **Indentation:** 2 spaces
- **Quotes:** double quotes (align with JSON and most TS defaults)
- **Semicolons:** required
- **Trailing commas:** all (ES5+)
- **Line length:** 100 characters max
- **End of line:** LF (Unix-style)
- Configure Prettier for automatic formatting.

### Naming Conventions

| Element             | Convention         | Example                     |
|---------------------|--------------------|-----------------------------|
| Files/directories   | kebab-case         | `memory-store.ts`           |
| Classes             | PascalCase         | `MemoryStore`               |
| Interfaces/Types    | PascalCase         | `MemoryNode`                |
| Functions/methods   | camelCase          | `retrieveMemory()`          |
| Constants           | UPPER_SNAKE_CASE   | `MAX_RETRY_COUNT`           |
| Variables           | camelCase          | `currentContext`             |
| Enum members        | PascalCase         | `NodeType.Experience`       |
| Generic parameters  | Single uppercase   | `T`, `K`, `V`               |

- Do **not** prefix interfaces with `I` (use `MemoryNode`, not `IMemoryNode`).
- Do **not** prefix types with `T` (use `QueryResult`, not `TQueryResult`).

### Types

- Prefer `interface` for object shapes that may be extended; use `type` for unions,
  intersections, and computed types.
- Avoid `any`. Use `unknown` when the type is truly unknown, then narrow.
- Use `readonly` for properties that should not be mutated.
- Prefer `Record<K, V>` over index signatures when key set is known.

### Error Handling

- Use typed custom error classes extending `Error` for domain errors.
- Always include meaningful error messages and context.
- Use `Result<T, E>` pattern or similar for expected failures rather than exceptions.
- Never silently swallow errors. Log or propagate them.
- Wrap external API calls (Neo4j, MCP) in try/catch with proper error mapping.

### Async Patterns

- Use `async`/`await` over raw Promises or callbacks.
- Ensure all async operations are properly awaited — do not create floating promises.
- Use `AbortController` / `AbortSignal` for cancellable operations.

### Project Structure (Recommended)

```
src/
├── index.ts              # Entry point
├── agent/                # React loop and core agent logic
│   ├── loop.ts
│   └── reasoning.ts
├── memory/               # Neo4j memory system
│   ├── client.ts         # Neo4j driver setup
│   ├── store.ts          # Read/write operations
│   └── types.ts          # Memory node/edge types
├── mcp/                  # MCP service integration
│   ├── server.ts
│   └── tools/            # MCP tool definitions
├── config/               # Configuration loading
└── utils/                # Shared utilities
```

### Neo4j Conventions

- Use parameterized Cypher queries — never interpolate values into query strings.
- Close sessions and drivers properly (use `try/finally` or `using`).
- Define node labels and relationship types as constants.
- Keep Cypher queries in dedicated files or constants, not inline in business logic.

### MCP Conventions

- Each tool should be a self-contained module with clear input/output schemas.
- Use JSON Schema for tool parameter validation.
- Tools must return structured results, not free-form text.

### Documentation

- Document public APIs with JSDoc (include `@param`, `@returns`, `@throws`).
- Keep `CLAUDE.md` and `AGENTS.md` updated as the project evolves.
- Write `SPCE.md`-aligned design docs for major features.

### Git Practices

- Write concise commit messages focused on "why" rather than "what".
- Keep commits atomic — one logical change per commit.
- Do not commit secrets, `.env` files, or credentials.
- Add a `.gitignore` covering `node_modules/`, `dist/`, `.env`, and Neo4j data files.
