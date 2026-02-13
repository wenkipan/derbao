/**
 * nakari interactive CLI.
 *
 * A REPL interface for conversing with nakari.
 * Shows tool calls, result summaries, and final responses.
 *
 * Prerequisites:
 *   1. Neo4j running at bolt://localhost:7687 (use: docker compose up -d)
 *   2. OPENAI_API_KEY set in .env
 *
 * Run:
 *   pnpm cli
 *   # or
 *   node dist/cli.js
 */
import OpenAI from "openai";
import readline from "readline";
import { loadConfig } from "./config/index.js";
import { MemoryClient } from "./memory/client.js";
import { createSerperClient } from "./search/client.js";
import { runReactLoop, type LoopStep } from "./agent/loop.js";

// ── Logging helpers ─────────────────────────────────────────────

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
  bold: "\x1b[1m",
  gray: "\x1b[90m",
};

function log(color: string, prefix: string, message: string): void {
  console.log(`${color}[${prefix}]${COLORS.reset} ${message}`);
}

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + "...";
}

function formatResultSummary(result: unknown): string {
  if (result === null || result === undefined) {
    return COLORS.dim + "(empty)" + COLORS.reset;
  }
  if (typeof result === "string") {
    return truncate(result, 150);
  }
  if (typeof result === "object") {
    const obj = result as Record<string, unknown>;
    // Handle error
    if ("error" in obj) {
      return COLORS.red + "Error: " + String(obj.error) + COLORS.reset;
    }
    // Handle memory_query result
    if ("records" in obj && Array.isArray(obj.records)) {
      const count = obj.records.length;
      return count > 0
        ? COLORS.green + `${count} record(s)` + COLORS.reset
        : COLORS.dim + "(no records)" + COLORS.reset;
    }
    // Handle memory_write result
    if ("stats" in obj) {
      const stats = obj.stats as Record<string, number>;
      const parts: string[] = [];
      if (stats.nodesCreated) parts.push(`${stats.nodesCreated} nodes`);
      if (stats.relationshipsCreated) parts.push(`${stats.relationshipsCreated} rels`);
      if (stats.propertiesSet) parts.push(`${stats.propertiesSet} props`);
      return parts.length > 0
        ? COLORS.green + parts.join(", ") + COLORS.reset
        : COLORS.dim + "(no changes)" + COLORS.reset;
    }
    // Handle memory_schema result
    if ("labels" in obj || "relationshipTypes" in obj) {
      const labels = (obj.labels as string[])?.length ?? 0;
      const rels = (obj.relationshipTypes as string[])?.length ?? 0;
      const props = (obj.propertyKeys as string[])?.length ?? 0;
      return `${labels} labels, ${rels} rel types, ${props} props`;
    }
    // Handle embedding result
    if ("vector" in obj && Array.isArray(obj.vector)) {
      return COLORS.green + `vector[${obj.vector.length}]` + COLORS.reset;
    }
    // Handle web_search result
    if ("results" in obj && Array.isArray(obj.results)) {
      const count = obj.results.length;
      const query = (obj.query as string) ?? "";
      return count > 0
        ? COLORS.green + `${count} result(s) for "${truncate(query, 30)}"` + COLORS.reset
        : COLORS.dim + "(no results)" + COLORS.reset;
    }
    // Generic object
    const str = JSON.stringify(result);
    return truncate(str, 150);
  }
  return String(result);
}

function logStep(step: LoopStep): void {
  switch (step.type) {
    case "tool_call": {
      const icon = getToolIcon(step.name);
      console.log(`  ${icon} ${COLORS.yellow}${step.name}${COLORS.reset}`);
      // Show relevant arguments
      const args = step.arguments;
      if (step.name === "memory_query" || step.name === "memory_write") {
        const cypher = String(args["cypher"] ?? "");
        console.log(`    ${COLORS.dim}Cypher: ${compactCypher(cypher)}${COLORS.reset}`);
        const params = args["params"] as Record<string, unknown> | undefined;
        if (params && Object.keys(params).length > 0) {
          console.log(`    ${COLORS.dim}Params: ${JSON.stringify(params)}${COLORS.reset}`);
        }
      } else if (step.name === "embedding") {
        const text = String(args["text"] ?? "");
        console.log(`    ${COLORS.dim}Text: "${truncate(text, 50)}"${COLORS.reset}`);
      } else if (step.name === "web_search") {
        const query = String(args["query"] ?? "");
        const numResults = args["numResults"] as number | undefined;
        const type = args["type"] as string | undefined;
        const meta = [type, numResults ? `n=${numResults}` : undefined].filter(Boolean).join(", ");
        console.log(`    ${COLORS.dim}Query: "${query}"${meta ? ` (${meta})` : ""}${COLORS.reset}`);
      } else if (step.name === "memory_schema") {
        console.log(`    ${COLORS.dim}Inspecting database schema${COLORS.reset}`);
      }
      break;
    }
    case "tool_result":
      console.log(`    ${COLORS.magenta}→ ${formatResultSummary(step.result)}${COLORS.reset}`);
      break;
    case "error":
      console.log(`    ${COLORS.red}✗ ${step.message}${COLORS.reset}`);
      break;
  }
}

function getToolIcon(name: string): string {
  const icons: Record<string, string> = {
    memory_query: "🔍",
    memory_write: "✏️",
    memory_schema: "📋",
    embedding: "🔢",
    web_search: "🌐",
  };
  return icons[name] ?? "🔧";
}

function compactCypher(cypher: string): string {
  // Remove extra whitespace and newlines for compact display
  return cypher.replace(/\s+/g, " ").trim();
}

// ── CLI ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const config = loadConfig();

  // Connect to Neo4j
  const memory = new MemoryClient(config.neo4j.uri, config.neo4j.user, config.neo4j.password);
  try {
    await memory.verifyConnectivity();
    log(COLORS.green, "INIT", "Neo4j connected");
  } catch (err) {
    log(COLORS.red, "ERROR", `Neo4j connection failed: ${err instanceof Error ? err.message : err}`);
    log(COLORS.dim, "", "Make sure Neo4j is running: docker compose up -d");
    process.exit(1);
  }

  // Initialize search client if configured
  let search;
  if (config.search) {
    search = createSerperClient({
      apiKey: config.search.apiKey,
      baseUrl: config.search.baseUrl,
      timeout: config.search.timeout,
    });
    try {
      await search.verifyConnectivity();
      log(COLORS.green, "INIT", `Search connected (${config.search.provider})`);
    } catch (err) {
      log(COLORS.yellow, "WARN", `Search connection failed: ${err instanceof Error ? err.message : err}`);
      search = undefined;
    }
  }

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: config.openai.apiKey,
    baseURL: config.openai.baseURL,
  });
  log(COLORS.green, "INIT", `LLM: ${config.openai.model}${config.openai.baseURL ? ` via ${config.openai.baseURL}` : ""}`);

  const loopOptions = {
    openai,
    model: config.openai.model,
    embeddingModel: config.openai.embeddingModel,
    memory,
    search,
    onStep: logStep,
  };

  const history: OpenAI.ChatCompletionMessageParam[] = [];

  // Print header
  console.log();
  console.log(`${COLORS.bold}${COLORS.cyan}╔═══════════════════════════════════════════════════════════╗${COLORS.reset}`);
  console.log(`${COLORS.bold}${COLORS.cyan}║${COLORS.reset}  ${COLORS.bold}nakari${COLORS.reset} ${COLORS.dim}— interactive mode${COLORS.reset}                      ${COLORS.bold}${COLORS.cyan}║${COLORS.reset}`);
  console.log(`${COLORS.bold}${COLORS.cyan}║${COLORS.reset}  ${COLORS.dim}Type your message and press Enter. Type /quit to exit.${COLORS.reset}  ${COLORS.bold}${COLORS.cyan}║${COLORS.reset}`);
  console.log(`${COLORS.bold}${COLORS.cyan}╚═══════════════════════════════════════════════════════════╝${COLORS.reset}`);
  console.log();

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${COLORS.bold}${COLORS.blue}>${COLORS.reset} `,
  });

  const promptUser = (): Promise<string> =>
    new Promise((resolve) => {
      rl.prompt();
      rl.once("line", (line) => resolve(line.trim()));
    });

  // Main REPL loop
  while (true) {
    const input = await promptUser();

    // Handle empty input
    if (!input) continue;

    // Handle commands
    if (input === "/quit" || input === "/exit" || input === ":q") {
      console.log();
      log(COLORS.dim, "", "Goodbye!");
      break;
    }

    if (input === "/help" || input === "/?") {
      console.log();
      console.log(`${COLORS.bold}Commands:${COLORS.reset}`);
      console.log(`  /quit, /exit, :q  - Exit the CLI`);
      console.log(`  /help, /?        - Show this help`);
      console.log();
      continue;
    }

    if (input === "/schema") {
      try {
        const schema = await memory.schema();
        console.log();
        console.log(`${COLORS.bold}Database Schema:${COLORS.reset}`);
        console.log(`  Labels:    ${schema.labels.join(", ") || COLORS.dim + "(none)" + COLORS.reset}`);
        console.log(`  Relations: ${schema.relationshipTypes.join(", ") || COLORS.dim + "(none)" + COLORS.reset}`);
        console.log(`  Properties: ${schema.propertyKeys.join(", ") || COLORS.dim + "(none)" + COLORS.reset}`);
        console.log();
      } catch (err) {
        console.log(`${COLORS.red}Error: ${err instanceof Error ? err.message : err}${COLORS.reset}`);
      }
      continue;
    }

    // Regular message - process through ReAct loop
    console.log();
    const response = await runReactLoop(input, history, loopOptions);

    // Update history
    history.push({ role: "user", content: input });
    history.push({ role: "assistant", content: response });

    // Print response
    console.log();
    console.log(`${COLORS.bold}${COLORS.green}nakari:${COLORS.reset}`);
    console.log(response);
    console.log();
  }

  // Cleanup
  rl.close();
  await memory.close();
}

main().catch((err) => {
  console.error(`${COLORS.red}Fatal error:${COLORS.reset}`, err);
  process.exit(1);
});
