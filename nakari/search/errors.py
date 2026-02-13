"""Error classes for the search module."""


class SearchError(Exception):
    """Base exception for search-related errors."""

    def __init__(self, message: str, code: str = "SEARCH_ERROR") -> None:
        """Initialize the search error.

        Args:
            message: Error message
            code: Error code identifier
        """
        super().__init__(message)
        self.code = code
        self.context: dict | None = None

    def with_context(self, **kwargs: object) -> "SearchError":
        """Add context to the error."""
        self.context = kwargs  # type: ignore[assignment]
        return self


class SearchAuthError(SearchError):
    """Authentication or authorization error (401/403)."""

    def __init__(self, message: str = "Authentication failed") -> None:
        super().__init__(message, code="AUTH_ERROR")


class SearchRateLimitError(SearchError):
    """Rate limit error (429)."""

    def __init__(self, message: str = "Rate limit exceeded") -> None:
        super().__init__(message, code="RATE_LIMIT_ERROR")
