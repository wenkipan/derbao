import type OpenAI from "openai";

/**
 * Tool definitions for the OpenAI function calling API.
 * These are the memory tools nakari uses to interact with her Neo4j memory.
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
  {
    type: "function",
    function: {
      name: "embedding",
      description:
        "Generate an embedding vector for the given text. " +
        "Use this to create semantic representations of memories for vector similarity search. " +
        "You decide what to embed — any text that you want to find later by semantic meaning. " +
        "Store the returned vector as a property on nodes using memory_write.",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "The text to generate an embedding for.",
          },
        },
        required: ["text"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web for current information. " +
        "Use this when you need up-to-date facts, recent events, or information " +
        "that may not be in your memory database. Returns structured results " +
        "with titles, snippets, and URLs that you can explore further.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query string. Be specific and concise.",
          },
          numResults: {
            type: "number",
            description:
              "Maximum number of results to return (default: 10, max: 100).",
            minimum: 1,
            maximum: 100,
          },
          type: {
            type: "string",
            enum: ["search", "news", "images", "videos"],
            description:
              "Search type. Use 'news' for recent articles, 'search' for general web results.",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
];
