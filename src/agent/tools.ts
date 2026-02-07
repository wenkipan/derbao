import type OpenAI from "openai";

/**
 * Tool definitions for the OpenAI function calling API.
 * These are the three memory tools nakari uses to interact with her Neo4j memory.
 */
export const MEMORY_TOOLS: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "memory_query",
      description:
        "Execute a read-only Cypher query against your memory database (Neo4j). " +
        "Use this to retrieve memories, explore connections, search for patterns. " +
        "You decide what to query — there is no predefined schema. " +
        "Use memory_schema first if you want to see what labels/relationships exist.",
      parameters: {
        type: "object",
        properties: {
          cypher: {
            type: "string",
            description:
              "A read-only Cypher query (MATCH/RETURN/etc). " +
              "Use $paramName for parameters, never string interpolation.",
          },
          params: {
            type: "object",
            description: "Parameter map for the Cypher query. Keys correspond to $paramName in the cypher.",
            additionalProperties: true,
          },
        },
        required: ["cypher"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "memory_write",
      description:
        "Execute a write Cypher query against your memory database (Neo4j). " +
        "Use this to create nodes, relationships, update properties, or delete data. " +
        "You have full autonomy — you decide what labels, properties, and relationships to use. " +
        "There is no predefined schema. Structure emerges from your usage.",
      parameters: {
        type: "object",
        properties: {
          cypher: {
            type: "string",
            description:
              "A write Cypher query (CREATE/MERGE/SET/DELETE/etc). " +
              "Use $paramName for parameters, never string interpolation.",
          },
          params: {
            type: "object",
            description: "Parameter map for the Cypher query.",
            additionalProperties: true,
          },
        },
        required: ["cypher"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "memory_schema",
      description:
        "Inspect the current shape of your memory database. " +
        "Returns all node labels, relationship types, and property keys that currently exist. " +
        "Use this to understand what structure your memory has developed so far, " +
        "so you can decide whether to reuse existing patterns or create new ones.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
];
