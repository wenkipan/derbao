"""Type definitions for the search module."""

from dataclasses import dataclass
from typing import Literal


SearchType = Literal["search", "news", "images", "videos"]


@dataclass(frozen=True)
class SearchResult:
    """A single search result."""

    title: str
    link: str
    snippet: str
    date: str | None = None
    thumbnail_url: str | None = None
    site_name: str | None = None

    @classmethod
    def from_dict(cls, data: dict) -> "SearchResult":
        """Create a SearchResult from a dictionary."""
        return cls(
            title=data.get("title", ""),
            link=data.get("link", ""),
            snippet=data.get("snippet", ""),
            date=data.get("date"),
            thumbnail_url=data.get("thumbnailUrl"),
            site_name=data.get("siteName"),
        )


@dataclass(frozen=True)
class SearchResponse:
    """Response from a search query."""

    results: list[SearchResult]
    total_results: int | None = None
    query: str = ""
    metadata: dict | None = None

    @classmethod
    def from_dict(cls, data: dict) -> "SearchResponse":
        """Create a SearchResponse from a dictionary."""
        results = [SearchResult.from_dict(r) for r in data.get("results", [])]
        return cls(
            results=results,
            total_results=data.get("totalResults"),
            query=data.get("query", ""),
            metadata=data.get("metadata"),
        )


@dataclass(frozen=True)
class SearchOptions:
    """Options for search queries."""

    num_results: int | None = None
    type: SearchType = "search"
    language: str | None = None
    region: str | None = None
    timeout: int | None = None
