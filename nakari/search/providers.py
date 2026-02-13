"""Search provider implementations."""

import httpx
from typing import Any

from .errors import SearchAuthError, SearchError, SearchRateLimitError
from .types import SearchOptions, SearchResponse, SearchResponse as SearchResult, SearchType


class SearchProvider:
    """Base interface for search providers."""

    @property
    def name(self) -> str:
        """Provider name."""
        raise NotImplementedError

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
        raise NotImplementedError


class SerperProvider(SearchProvider):
    """Serper.dev search provider implementation.

    Serper provides Google Search results via REST API.
    """

    DEFAULT_BASE_URL = "https://google.serper.dev"

    def __init__(
        self,
        api_key: str,
        base_url: str | None = None,
        timeout: int = 20,
    ) -> None:
        """Initialize the Serper provider.

        Args:
            api_key: Serper API key
            base_url: Optional base URL (defaults to https://google.serper.dev)
            timeout: Request timeout in seconds
        """
        self._api_key = api_key
        self._base_url = base_url or self.DEFAULT_BASE_URL
        self._timeout = timeout
        self._client = httpx.AsyncClient(timeout=timeout)

    @property
    def name(self) -> str:
        """Provider name."""
        return "serper"

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
            SearchAuthError: If authentication fails
            SearchRateLimitError: If rate limit is exceeded
            SearchError: For other errors
        """
        opts = options or SearchOptions()

        # Determine endpoint based on search type
        endpoints: dict[SearchType, str] = {
            "search": "/search",
            "news": "/news",
            "images": "/images",
            "videos": "/videos",
        }
        endpoint = endpoints.get(opts.type, "/search")

        # Build request payload
        payload: dict[str, Any] = {"q": query}
        if opts.num_results:
            payload["num"] = opts.num_results
        if opts.language:
            payload["hl"] = opts.language
        if opts.region:
            payload["gl"] = opts.region

        headers = {
            "X-API-KEY": self._api_key,
            "Content-Type": "application/json",
        }

        url = f"{self._base_url}{endpoint}"

        try:
            response = await self._client.post(url, json=payload, headers=headers)

            # Handle error responses
            if response.status_code in (401, 403):
                raise SearchAuthError(
                    f"Authentication failed: {response.text}"
                ).with_context(status_code=response.status_code)
            elif response.status_code == 429:
                raise SearchRateLimitError(
                    f"Rate limit exceeded: {response.text}"
                ).with_context(status_code=response.status_code)
            elif response.status_code >= 400:
                raise SearchError(
                    f"Search failed: {response.text}",
                    code="HTTP_ERROR",
                ).with_context(status_code=response.status_code)

            data = response.json()

            # Convert to SearchResponse
            results = self._convert_response(data, opts.type)
            return SearchResponse(
                results=results,
                total_results=data.get("searchInformation", {}).get(
                    "totalResults"
                ),
                query=query,
            )

        except httpx.TimeoutException:
            raise SearchError("Request timed out", code="TIMEOUT_ERROR").with_context(
                timeout=self._timeout
            )
        except httpx.RequestError as e:
            raise SearchError(
                f"Request failed: {e!s}", code="REQUEST_ERROR"
            ).with_context(error=str(e))
        except (SearchAuthError, SearchRateLimitError, SearchError):
            raise
        except Exception as e:
            raise SearchError(
                f"Unexpected error: {e!s}", code="UNKNOWN_ERROR"
            ).with_context(error=str(e))

    def _convert_response(
        self, data: dict[str, Any], search_type: SearchType
    ) -> list[dict[str, Any]]:
        """Convert Serper API response to standardized results.

        Args:
            data: Raw API response data
            search_type: Type of search performed

        Returns:
            List of standardized result dictionaries
        """
        results: list[dict[str, Any]] = []

        # Different result keys based on search type
        result_keys: dict[SearchType, str] = {
            "search": "organic",
            "news": "news",
            "images": "images",
            "videos": "videos",
        }
        key = result_keys.get(search_type, "organic")
        raw_results = data.get(key, [])

        for item in raw_results:
            result: dict[str, Any] = {
                "title": item.get("title", ""),
                "link": item.get("link", ""),
                "snippet": item.get("snippet", ""),
            }

            # Add type-specific fields
            if search_type == "news":
                result["date"] = item.get("date")
                result["siteName"] = item.get("source")
            elif search_type == "images":
                result["thumbnailUrl"] = item.get("imageUrl")
            elif search_type == "videos":
                result["thumbnailUrl"] = item.get("thumbnail")

            results.append(result)

        return results

    async def close(self) -> None:
        """Close the HTTP client."""
        await self._client.aclose()
