import OpenAI from "openai";
import type { MemoryClient } from "../memory/client.js";
import { MEMORY_TOOLS } from "./tools.js";
import { SYSTEM_PROMPT } from "./prompt.js";

const MAX_ITERATIONS = 10;

export interface LoopOptions {
  /** OpenAI client instance */
  openai: OpenAI;
  /** Model to use (e.g. "gpt-4o") */
  model: string;
  /** Memory database client */
  memory: MemoryClient;
  /** Callback for observing each step of the loop (for logging/debugging) */
  onStep?: (step: LoopStep) => void;
}

export type LoopStep =
  | { type: "thought"; content: string }
  | { type: "tool_call"; name: string; arguments: Record<string, unknown> }
  | { type: "tool_result"; name: string; result: unknown }
  | { type: "response"; content: string }
  | { type: "error"; message: string };

/**
 * Run the ReAct loop for a single user message.
 *
 * The loop calls the LLM with the conversation history and tool definitions.
 * When the LLM returns tool calls, we execute them and feed results back.
 * When the LLM returns a text response (no tool calls), the loop ends.
 */
export async function runReactLoop(
  userMessage: string,
  conversationHistory: OpenAI.ChatCompletionMessageParam[],
  options: LoopOptions,
): Promise<string> {
  const { openai, model, memory, onStep } = options;

  // Build messages: system + history + new user message
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...conversationHistory,
    { role: "user", content: userMessage },
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await openai.chat.completions.create({
      model,
      messages,
      tools: MEMORY_TOOLS,
    });

    const choice = response.choices[0];
    if (!choice) {
      throw new Error("No response from LLM");
    }

    const assistantMessage = choice.message;

    // Add assistant message to conversation
    messages.push(assistantMessage);

    // If there are no tool calls, we have our final response
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      const content = assistantMessage.content ?? "";
      onStep?.({ type: "response", content });
      return content;
    }

    // Process each tool call
    for (const toolCall of assistantMessage.tool_calls) {
      if (toolCall.type !== "function") continue;
      const fnName = toolCall.function.name;
      let args: Record<string, unknown>;
      try {
        args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
      } catch {
        args = {};
      }

      onStep?.({ type: "tool_call", name: fnName, arguments: args });

      let result: unknown;
      try {
        result = await executeTool(fnName, args, memory);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        result = { error: errorMessage };
        onStep?.({ type: "error", message: `Tool ${fnName} failed: ${errorMessage}` });
      }

      onStep?.({ type: "tool_result", name: fnName, result });

      // Add tool result to conversation
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  // If we hit the iteration limit, ask for a final response without tools
  const finalResponse = await openai.chat.completions.create({
    model,
    messages: [
      ...messages,
      {
        role: "user",
        content: "(You have used many tool calls. Please provide your final response now.)",
      },
    ],
  });

  const content = finalResponse.choices[0]?.message?.content ?? "(no response)";
  onStep?.({ type: "response", content });
  return content;
}

/**
 * Execute a single tool call and return the result.
 */
async function executeTool(
  name: string,
  args: Record<string, unknown>,
  memory: MemoryClient,
): Promise<unknown> {
  switch (name) {
    case "memory_query": {
      const cypher = args["cypher"] as string;
      const params = (args["params"] as Record<string, unknown>) ?? {};
      return await memory.query(cypher, params);
    }
    case "memory_write": {
      const cypher = args["cypher"] as string;
      const params = (args["params"] as Record<string, unknown>) ?? {};
      return await memory.write(cypher, params);
    }
    case "memory_schema": {
      return await memory.schema();
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
