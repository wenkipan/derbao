"""Search module for web search integration.

Provides extensible web search capability through provider abstraction.
Supports Serper.dev with the ability to add other providers (Tavily, SerpAPI, etc.).
"""

from .client import SearchClient, create_serper_client
from .providers import SearchProvider, SerperProvider
from .types import SearchOptions, SearchResponse, SearchResult, SearchType
from .errors import SearchError, SearchAuthError, SearchRateLimitError

__all__ = [
    "SearchClient",
    "create_serper_client",
    "SearchProvider",
    "SerperProvider",
    "SearchOptions",
    "SearchResponse",
    "SearchResult",
    "SearchType",
    "SearchError",
    "SearchAuthError",
    "SearchRateLimitError",
]
