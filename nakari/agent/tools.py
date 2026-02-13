"""Tool definitions for the ReAct loop agent."""

from openai.types.chat import (
    ChatCompletionToolParam,
)


def get_memory_tools() -> list[ChatCompletionToolParam]:
    """Return the list of available memory tools.

    These tools are registered with OpenAI's function calling API.
    Each tool definition includes name, description, and parameter schema.

    Returns:
        List of tool definitions for function calling
    """
    return [
        {
            "type": "function",
            "function": {
                "name": "memory_query",
                "description": (
                    "Execute a read-only Cypher query on your memory database. "
                    "Use this to retrieve memories, experiences, and knowledge. "
                    "Always use parameterized queries with $paramName syntax."
                ),
                "strict": True,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "cypher": {
                            "type": "string",
                            "description": "Parameterized Cypher query string",
                        },
                        "params": {
                            "type": "object",
                            "description": "Query parameters for the $paramName placeholders",
                        },
                    },
                    "required": ["cypher", "params"],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "memory_write",
                "description": (
                    "Execute a write Cypher query on your memory database. "
                    "Use this to create, update, or delete nodes, relationships, "
                    "and properties. Always use parameterized queries with $paramName syntax."
                ),
                "strict": True,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "cypher": {
                            "type": "string",
                            "description": "Parameterized Cypher query string",
                        },
                        "params": {
                            "type": "object",
                            "description": "Query parameters for the $paramName placeholders",
                        },
                    },
                    "required": ["cypher", "params"],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "memory_schema",
                "description": (
                    "Inspect the current structure of your memory database. "
                    "Returns all node labels, relationship types, and property keys "
                    "currently in use. Use this to understand what you've stored so far."
                ),
                "strict": True,
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "embedding",
                "description": (
                    "Generate a vector embedding for the given text. "
                    "Useful for semantic search and similarity comparisons."
                ),
                "strict": True,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "text": {
                            "type": "string",
                            "description": "Text to generate embedding for",
                        },
                    },
                    "required": ["text"],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "web_search",
                "description": (
                    "Search the internet for current information. "
                    "Use this when you need up-to-date facts, news, or external knowledge."
                ),
                "strict": True,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Search query string",
                        },
                        "num_results": {
                            "type": "number",
                            "description": "Number of results to return (optional)",
                        },
                        "type": {
                            "type": "string",
                            "enum": ["search", "news", "images", "videos"],
                            "description": "Type of search to perform",
                        },
                    },
                    "required": ["query"],
                    "additionalProperties": False,
                },
            },
        },
    ]
