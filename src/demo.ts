/**
 * nakari end-to-end demo.
 *
 * Sends a sequence of messages to nakari and observes how she uses her memory database.
 * This demonstrates the full ReAct loop: LLM reasoning → tool calls → Neo4j → response.
 *
 * Prerequisites:
 *   1. Neo4j running at bolt://localhost:7687 (use: docker compose up -d)
 *   2. OPENAI_API_KEY set in .env
 *
 * Run:
 *   pnpm demo
 */
import OpenAI from "openai";
import { loadConfig } from "./config/index.js";
import { MemoryClient } from "./memory/client.js";
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
  bold: "\x1b[1m",
};

function log(color: string, prefix: string, message: string): void {
  console.log(`${color}[${prefix}]${COLORS.reset} ${message}`);
}

function logStep(step: LoopStep): void {
  switch (step.type) {
    case "tool_call":
      log(COLORS.yellow, "TOOL CALL", `${step.name}`);
      if (step.name === "memory_query" || step.name === "memory_write") {
        const args = step.arguments;
        log(COLORS.dim, "  CYPHER", String(args["cypher"] ?? ""));
        if (args["params"] && Object.keys(args["params"] as object).length > 0) {
          log(COLORS.dim, "  PARAMS", JSON.stringify(args["params"]));
        }
      }
      break;
    case "tool_result":
      log(COLORS.magenta, "RESULT", truncate(JSON.stringify(step.result), 200));
      break;
    case "response":
      // Logged separately after the loop
      break;
    case "error":
      log(COLORS.red, "ERROR", step.message);
      break;
  }
}

function truncate(s: string, maxLen: number): string {
  return s.length > maxLen ? s.slice(0, maxLen) + "..." : s;
}

// ── Main ────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const config = loadConfig();

  // Connect to Neo4j
  const memory = new MemoryClient(config.neo4j.uri, config.neo4j.user, config.neo4j.password);
  try {
    await memory.verifyConnectivity();
    log(COLORS.green, "NEO4J", "Connected successfully");
  } catch (err) {
    log(COLORS.red, "NEO4J", `Connection failed: ${err instanceof Error ? err.message : err}`);
    log(COLORS.red, "NEO4J", "Make sure Neo4j is running. Try: docker compose up -d");
    process.exit(1);
  }

  // Initialize OpenAI-compatible client (works with OpenAI, Zhipu, etc.)
  const openai = new OpenAI({
    apiKey: config.openai.apiKey,
    baseURL: config.openai.baseURL,
  });
  log(COLORS.green, "LLM", `Model: ${config.openai.model}` +
    (config.openai.baseURL ? ` | Base URL: ${config.openai.baseURL}` : ""));

  const loopOptions = {
    openai,
    model: config.openai.model,
    memory,
    onStep: logStep,
  };

  // Conversation history accumulates across messages
  const history: OpenAI.ChatCompletionMessageParam[] = [];

  // ── Demo conversation ──

  const demoMessages = [
    "你好！我叫小明，我是一个程序员，最近在学 Rust。",
    "你还记得我叫什么吗？我在学什么语言？",
    "我今天在学 Rust 的所有权机制，觉得很有意思但也有点难理解。你能帮我理解一下吗？",
  ];

  console.log("\n" + "=".repeat(60));
  console.log(
    `${COLORS.bold}  nakari end-to-end demo — ${demoMessages.length} messages${COLORS.reset}`,
  );
  console.log("=".repeat(60) + "\n");

  for (const userMsg of demoMessages) {
    log(COLORS.cyan, "USER", userMsg);
    console.log("");

    const response = await runReactLoop(userMsg, history, loopOptions);

    // Update history
    history.push({ role: "user", content: userMsg });
    history.push({ role: "assistant", content: response });

    console.log("");
    log(COLORS.green, "NAKARI", response);
    console.log("\n" + "-".repeat(60) + "\n");
  }

  // ── Show final memory state ──

  console.log(`${COLORS.bold}Final memory database state:${COLORS.reset}\n`);
  try {
    const schema = await memory.schema();
    log(COLORS.cyan, "LABELS", schema.labels.join(", ") || "(none)");
    log(COLORS.cyan, "REL TYPES", schema.relationshipTypes.join(", ") || "(none)");
    log(COLORS.cyan, "PROPERTIES", schema.propertyKeys.join(", ") || "(none)");

    // Dump all nodes
    const allNodes = await memory.query("MATCH (n) RETURN n LIMIT 20");
    if (allNodes.records.length > 0) {
      console.log(`\n${COLORS.bold}All nodes:${COLORS.reset}`);
      for (const record of allNodes.records) {
        console.log(COLORS.dim + JSON.stringify(record, null, 2) + COLORS.reset);
      }
    }

    // Dump all relationships
    const allRels = await memory.query(
      "MATCH (a)-[r]->(b) RETURN labels(a) AS from_labels, type(r) AS rel_type, " +
        "properties(r) AS rel_props, labels(b) AS to_labels LIMIT 20",
    );
    if (allRels.records.length > 0) {
      console.log(`\n${COLORS.bold}All relationships:${COLORS.reset}`);
      for (const record of allRels.records) {
        console.log(COLORS.dim + JSON.stringify(record) + COLORS.reset);
      }
    }
  } catch (err) {
    log(COLORS.red, "ERROR", `Failed to dump memory: ${err instanceof Error ? err.message : err}`);
  }

  await memory.close();
  log(COLORS.green, "DONE", "Demo complete.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
