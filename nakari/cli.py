"""Interactive CLI interface for nakari."""

import asyncio
import os
from datetime import date, time, datetime
from typing import Any

from openai import AsyncOpenAI
from rich.console import Console
from rich.panel import Panel
from rich.syntax import Syntax
from rich.text import Text

from .config import Config
from .agent import LoopOptions, LoopStep, run_react_loop
from .memory import MemoryClient
from .search import create_serper_client


def _json_serializable(obj: Any) -> Any:
    """Convert an object to a JSON-serializable format."""
    if obj is None or isinstance(obj, (bool, int, float, str)):
        return obj

    if hasattr(obj, "__class__") and obj.__class__.__name__ == "Record":
        return {k: _json_serializable(v) for k, v in obj.items()}

    if hasattr(obj, "__class__") and "neo4j" in getattr(obj.__class__, "__module__", ""):
        return str(obj)

    if isinstance(obj, (date, time, datetime)):
        return obj.isoformat()

    if isinstance(obj, dict):
        return {k: _json_serializable(v) for k, v in obj.items()}

    if isinstance(obj, list):
        return [_json_serializable(v) for v in obj]

    if isinstance(obj, tuple):
        return [_json_serializable(v) for v in obj]

    return str(obj)


# ANSI colors for terminal output (fallback for non-rich output)
class Colors:
    """ANSI color codes."""

    HEADER = "\033[95m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    RESET = "\033[0m"
    BOLD = "\033[1m"


# Rich console for styled output
console = Console()


def print_header(text: str) -> None:
    """Print a header with styling."""
    console.print(Panel(text, title="[bold blue]nakari[/bold blue]", border_style="blue"))


def print_thought(content: str) -> None:
    """Print a thought step."""
    console.print(Panel(content, title="[dim]Thought[/dim]", border_style="dim white"))


def print_tool_call(name: str, arguments: dict[str, Any]) -> None:
    """Print a tool call step - simplified format like TypeScript version."""
    # Format: 🔍 memory_query\n    Cypher: ...\n    → ...
    icons = {
        "memory_query": "🔍",
        "memory_write": "✏️",
        "memory_schema": "📋",
        "embedding": "🧮",
        "web_search": "🌐",
    }
    icon = icons.get(name, "🔧")

    # Print tool name with icon
    console.print(f"[dim]{icon} {name}[/dim]")

    # Print arguments in a simplified format
    if arguments:
        for key, value in arguments.items():
            if key == "cypher":
                # Show full Cypher queries
                console.print(f"    [dim]Cypher:[/dim] {value}")
            elif key == "params" and value:
                console.print(f"    [dim]Params:[/dim] {value}")
            elif key == "text":
                text_str = str(value)
                if len(text_str) > 60:
                    text_str = text_str[:60] + "..."
                console.print(f"    [dim]Text:[/dim] {text_str}")
            elif key == "query":
                query_str = str(value)
                if len(query_str) > 60:
                    query_str = query_str[:60] + "..."
                console.print(f"    [dim]Query:[/dim] {query_str}")
            else:
                console.print(f"    [dim]{key}:[/dim] {value}")


def print_tool_result(name: str, result: Any) -> None:
    """Print a tool result step - simplified format like TypeScript version."""
    # Format: → 2 nodes, 1 rels, 5 props
    if isinstance(result, dict):
        if "stats" in result:
            stats = result["stats"]
            parts = []
            if stats.get("nodesCreated", 0) > 0:
                parts.append(f"{stats['nodesCreated']} nodes")
            if stats.get("relationshipsCreated", 0) > 0:
                parts.append(f"{stats['relationshipsCreated']} rels")
            if stats.get("propertiesSet", 0) > 0:
                parts.append(f"{stats['propertiesSet']} props")
            if parts:
                console.print(f"    [dim]→ [/dim]{', '.join(parts)}")
            elif any(stats.values()):
                console.print(f"    [dim]→ {stats}[/dim]")
        elif "labels" in result or "relationshipTypes" in result:
            # Schema result
            labels = result.get("labels", [])
            rels = result.get("relationshipTypes", [])
            props = result.get("propertyKeys", [])
            parts = []
            if labels:
                parts.append(f"{len(labels)} labels")
            if rels:
                parts.append(f"{len(rels)} rel types")
            if props:
                parts.append(f"{len(props)} props")
            console.print(f"    [dim]→ [/dim]{', '.join(parts)}")
        elif "records" in result:
            records = result["records"]
            if records:
                console.print(f"    [dim]→ {len(records)} records[/dim]")
            else:
                console.print(f"    [dim]→ (no records)[/dim]")
        elif "error" in result:
            console.print(f"    [dim]→ [red]Error: {result['error']}[/red][/dim]")
        elif "results" in result:
            # Search result
            results = result.get("results", [])
            total = result.get("totalResults", len(results))
            console.print(f"    [dim]→ {total} results[/dim]")
        else:
            console.print(f"    [dim]→ {result}[/dim]")
    else:
        console.print(f"    [dim]→ {result}[/dim]")


def print_response(content: str) -> None:
    """Print the final response."""
    console.print(
        Panel(
            content,
            title="[bold green]nakari[/bold green]",
            border_style="green",
        )
    )


def print_error(message: str) -> None:
    """Print an error message."""
    console.print(
        Panel(
            message,
            title=f"[bold red]Error[/bold red]",
            border_style="red",
        )
    )


def print_schema(schema: dict[str, Any]) -> None:
    """Print database schema."""
    console.print(
        Panel(
            _format_json(schema),
            title="[bold yellow]Database Schema[/bold yellow]",
            border_style="yellow",
        )
    )


def print_help() -> None:
    """Print help information."""
    help_text = """
[bold cyan]nakari Commands:[/bold cyan]

  [bold]/quit[/bold] or [bold]/exit[/bold]  - Exit the conversation
  [bold]/help[/bold]              - Show this help message
  [bold]/schema[/bold]            - Display database schema

  Any other input will be processed by nakari.
    """
    console.print(help_text)


def _format_json(obj: Any) -> str:
    """Format an object as JSON string.

    Args:
        obj: Object to format

    Returns:
        JSON string representation
    """
    import json

    return json.dumps(_json_serializable(obj), ensure_ascii=False, indent=2)


async def main() -> None:
    """Main entry point for the CLI."""
    # Load configuration
    config = Config.from_env()

    # Validate configuration
    if not config.openai.api_key:
        print_error("OPENAI_API_KEY is required. Please set it in your environment.")
        return

    # Initialize clients
    openai = AsyncOpenAI(
        api_key=config.openai.api_key,
        base_url=config.openai.base_url,
    )

    memory = MemoryClient(
        uri=config.neo4j.uri,
        user=config.neo4j.user,
        password=config.neo4j.password,
    )

    search_client = None
    if config.search and config.search.api_key:
        search_client = create_serper_client(
            api_key=config.search.api_key,
            base_url=config.search.base_url,
            timeout=config.search.timeout,
        )

    try:
        # Verify connectivity
        console.print("[dim]Connecting to Neo4j...[/dim]")
        await memory.verify_connectivity()

        if search_client:
            console.print("[dim]Search client configured.[/dim]")
        else:
            console.print("[dim]Search client not configured (optional).[/dim]")

        console.print("[green]Connected! Starting nakari...[/green]\n")

        # Conversation history
        history: list[dict[str, str]] = []

        # Print welcome
        print_header("I am nakari. I don't play a character, I am.")
        print_help()
        console.print()

        # Main REPL loop
        while True:
            try:
                # Get user input
                user_input = console.input("[bold blue]You:[/bold blue] ")

                if not user_input.strip():
                    continue

                # Handle commands
                match user_input.strip():
                    case "/quit" | "/exit":
                        console.print("[dim]Goodbye![/dim]")
                        break
                    case "/help":
                        print_help()
                        continue
                    case "/schema":
                        schema = await memory.schema()
                        print_schema(schema)
                        continue

                # Create loop options
                loop_options = LoopOptions(
                    openai=openai,
                    model=config.openai.model,
                    embedding_model=config.openai.embedding_model,
                    memory=memory,
                    search=search_client,
                    on_step=lambda step: _handle_step(step),
                )

                # Run ReAct loop
                console.print()
                response = await run_react_loop(user_input, history, loop_options)

                # Update history
                history.append({"role": "user", "content": user_input})
                history.append({"role": "assistant", "content": response})

                console.print()

            except KeyboardInterrupt:
                console.print("\n[dim]Interrupted. Type /quit to exit.[/dim]")
            except EOFError:
                console.print("\n[dim]End of input. Exiting nakari.[/dim]")
                break
            except Exception as e:
                print_error(f"Error: {e}")
                # Exit on repeated errors to avoid error loops
                import traceback
                console.print(traceback.format_exc(), style="dim")
                break

    finally:
        # Clean up
        await memory.close()
        if search_client:
            await search_client._provider.close()  # type: ignore[attr-defined]
        await openai.close()


def _handle_step(step: LoopStep) -> None:
    """Handle a step callback from the ReAct loop.

    Args:
        step: The loop step to handle
    """
    match step.type:
        case "thought":
            if step.content:
                print_thought(step.content)
        case "tool_call":
            print_tool_call(step.name, step.arguments or {})
        case "tool_result":
            print_tool_result(step.name, step.result)
        case "response":
            if step.content:
                print_response(step.content)
        case "error":
            print_error(step.content)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        console.print("\n[dim]Exiting nakari.[/dim]")


def cli_main() -> None:
    """Synchronous entry point for console scripts."""
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        console.print("\n[dim]Exiting nakari.[/dim]")
