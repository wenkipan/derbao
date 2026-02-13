"""Search client for unified search operations."""

from .providers import SearchProvider, SerperProvider
from .types import SearchOptions, SearchResponse
from .errors import SearchError


class SearchClient:
    """Client for executing search operations through a provider."""

    def __init__(self, provider: SearchProvider) -> None:
        """Initialize the search client.

        Args:
            provider: Search provider implementation
        """
        self._provider = provider

    async def search(
        self, query: str, options: SearchOptions | None = None
    ) -> SearchResponse:
        """Execute a search query.

        Args:
            query: Search query string
            options: Optional search parameters

        Returns:
            SearchResponse with results

        Raises:
            SearchError: If the search fails
        """
        return await self._provider.search(query, options)

    async def search_news(
        self, query: str, options: SearchOptions | None = None
    ) -> SearchResponse:
        """Execute a news search query.

        Args:
            query: Search query string
            options: Optional search parameters

        Returns:
            SearchResponse with news results
        """
        opts = SearchOptions(type="news") if not options else SearchOptions(
            type="news",
            num_results=options.num_results,
            language=options.language,
            region=options.region,
            timeout=options.timeout,
        )
        return await self._provider.search(query, opts)

    async def verify_connectivity(self) -> None:
        """Verify connectivity to the search provider.

        Raises:
            SearchError: If connection cannot be established
        """
        await self._provider.search("test")


def create_serper_client(
    api_key: str,
    base_url: str | None = None,
    timeout: int = 20,
) -> "SearchClient":
    """Create a SearchClient with Serper provider.

    Args:
        api_key: Serper API key
        base_url: Optional base URL (defaults to https://google.serper.dev)
        timeout: Request timeout in seconds

    Returns:
        Configured SearchClient
    """
    provider = SerperProvider(api_key=api_key, base_url=base_url, timeout=timeout)
    return SearchClient(provider=provider)
