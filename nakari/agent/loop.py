"""ReAct loop engine for the agent.

Implements the ReAct (Reasoning + Acting) pattern with tool execution.
"""

import json
from dataclasses import dataclass
from datetime import date, time, datetime
from typing import Any, Awaitable, Callable

from openai import AsyncOpenAI
from openai.types.chat import ChatCompletionMessageParam

from .prompt import SYSTEM_PROMPT
from .tools import get_memory_tools
from ..memory import MemoryClient
from ..search import SearchClient, SearchOptions


# Maximum number of ReAct iterations
MAX_ITERATIONS: int = 10


def _json_serializable(obj: Any) -> Any:
    """Convert an object to a JSON-serializable format."""
    # None, bool, int, float, str are already JSON-serializable
    if obj is None or isinstance(obj, (bool, int, float, str)):
        return obj

    # Handle Neo4j Record-like objects
    if hasattr(obj, "__class__") and obj.__class__.__name__ == "Record":
        return {k: _json_serializable(v) for k, v in obj.items()}

    # Handle Neo4j Date/time objects
    if hasattr(obj, "__class__") and "neo4j" in getattr(obj.__class__, "__module__", ""):
        return str(obj)

    # Handle standard datetime objects
    if isinstance(obj, (date, time, datetime)):
        return obj.isoformat()

    # Handle dicts recursively
    if isinstance(obj, dict):
        return {k: _json_serializable(v) for k, v in obj.items()}

    # Handle lists recursively
    if isinstance(obj, list):
        return [_json_serializable(v) for v in obj]

    # Handle tuples (convert to list)
    if isinstance(obj, tuple):
        return [_json_serializable(v) for v in obj]

    # For anything else, try to convert to string
    return str(obj)


@dataclass(frozen=True)
class LoopOptions:
    """Options for the ReAct loop."""

    openai: AsyncOpenAI
    model: str
    memory: MemoryClient
    search: SearchClient | None = None
    embedding_model: str | None = None
    on_step: Callable[["LoopStep"], None] | None = None


class LoopStep:
    """A single step in the ReAct loop."""

    def __init__(
        self,
        step_type: str,
        content: str = "",
        name: str = "",
        arguments: dict[str, Any] | None = None,
        result: Any = None,
    ) -> None:
        """Initialize a loop step.

        Args:
            step_type: Type of step ("thought", "tool_call", "tool_result", "response", "error")
            content: Text content for thought/response/error steps
            name: Tool name for tool_call/tool_result steps
            arguments: Tool arguments for tool_call steps
            result: Tool result for tool_result steps
        """
        self.type = step_type
        self.content = content
        self.name = name
        self.arguments = arguments
        self.result = result

    def to_dict(self) -> dict[str, Any]:
        """Convert step to dictionary representation."""
        return {
            "type": self.type,
            "content": self.content,
            "name": self.name,
            "arguments": self.arguments,
            "result": self.result,
        }


async def run_react_loop(
    user_message: str,
    history: list[ChatCompletionMessageParam],
    options: LoopOptions,
) -> str:
    """Run the ReAct loop to process a user message.

    Args:
        user_message: The user's input message
        history: Conversation history (excluding current message)
        options: Loop configuration options

    Returns:
        The agent's final response
    """
    # Build messages: system + history + user message
    messages: list[ChatCompletionMessageParam] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *history,
        {"role": "user", "content": user_message},
    ]

    tools = get_memory_tools()

    for iteration in range(MAX_ITERATIONS):
        # Call LLM with tools
        response = await options.openai.chat.completions.create(
            model=options.model,
            messages=messages,
            tools=tools,
            parallel_tool_calls=False,
        )

        message = response.choices[0].message

        # Add assistant message to history
        messages.append({
            "role": "assistant",
            "content": message.content,
        })

        # Check for tool calls
        if not message.tool_calls:
            # No tool calls - this is the final response
            final_content = message.content or ""
            _emit_step(options, LoopStep("response", content=final_content))
            return final_content

        # Execute each tool call
        for tool_call in message.tool_calls:
            tool_name = tool_call.function.name
            try:
                args_json = tool_call.function.arguments
                arguments = json.loads(args_json) if args_json else {}
            except json.JSONDecodeError:
                arguments = {}

            _emit_step(
                options,
                LoopStep("tool_call", name=tool_name, arguments=arguments),
            )

            # Execute the tool
            result = await _execute_tool(tool_name, arguments, options)

            # Format result for LLM
            result_content = json.dumps(_json_serializable(result), ensure_ascii=False)
            _emit_step(
                options,
                LoopStep("tool_result", name=tool_name, result=result),
            )

            # Add tool result message
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result_content,
            })

    # Max iterations reached - ask for final response
    messages.append({
        "role": "system",
        "content": (
            "You have reached the maximum number of iterations. "
            "Please provide your final response to the user now."
        ),
    })

    final_response = await options.openai.chat.completions.create(
        model=options.model,
        messages=messages,
    )

    final_content = final_response.choices[0].message.content or ""
    _emit_step(options, LoopStep("response", content=final_content))
    return final_content


async def _execute_tool(
    name: str,
    arguments: dict[str, Any],
    options: LoopOptions,
) -> dict[str, Any]:
    """Execute a single tool.

    Args:
        name: Tool name
        arguments: Tool arguments
        options: Loop options

    Returns:
        Tool result as dictionary
    """
    try:
        match name:
            case "memory_query":
                cypher = arguments.get("cypher", "")
                params = arguments.get("params", {})
                return await options.memory.query(cypher, params)

            case "memory_write":
                cypher = arguments.get("cypher", "")
                params = arguments.get("params", {})
                return await options.memory.write(cypher, params)

            case "memory_schema":
                return await options.memory.schema()

            case "embedding":
                text = arguments.get("text", "")
                return await _generate_embedding(text, options)

            case "web_search":
                query = arguments.get("query", "")
                num_results = arguments.get("num_results")
                search_type = arguments.get("type", "search")
                return await _web_search(query, num_results, search_type, options)

            case _:
                return {"error": f"Unknown tool: {name}"}

    except Exception as e:
        return {"error": str(e)}


async def _generate_embedding(
    text: str,
    options: LoopOptions,
) -> dict[str, Any]:
    """Generate an embedding for text.

    Args:
        text: Text to embed
        options: Loop options containing OpenAI client

    Returns:
        Dictionary with vector embedding
    """
    model = options.embedding_model or "text-embedding-3-small"

    response = await options.openai.embeddings.create(
        model=model,
        input=text,
    )

    return {"vector": response.data[0].embedding}


async def _web_search(
    query: str,
    num_results: int | None,
    search_type: str,
    options: LoopOptions,
) -> dict[str, Any]:
    """Execute a web search.

    Args:
        query: Search query
        num_results: Optional number of results
        search_type: Type of search (search/news/images/videos)
        options: Loop options containing search client

    Returns:
        Dictionary with search results
    """
    if not options.search:
        return {"error": "Search client not configured"}

    opts = SearchOptions(
        type=search_type,  # type: ignore[arg-type]
        num_results=num_results,
    )

    response = await options.search.search(query, opts)

    return {
        "query": response.query,
        "totalResults": response.total_results,
        "results": [
            {
                "title": r.title,
                "link": r.link,
                "snippet": r.snippet,
                "date": r.date,
                "thumbnailUrl": r.thumbnail_url,
                "siteName": r.site_name,
            }
            for r in response.results
        ],
    }


def _emit_step(options: LoopOptions, step: LoopStep) -> None:
    """Emit a step callback if provided.

    Args:
        options: Loop options
        step: The step to emit
    """
    if options.on_step:
        options.on_step(step)
