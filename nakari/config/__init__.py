"""Configuration management module."""

from dataclasses import dataclass, field
from os import getenv
from typing import Literal

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class OpenAIConfig:
    """OpenAI configuration."""

    api_key: str
    model: str = "gpt-4o"
    embedding_model: str | None = None
    base_url: str | None = None


@dataclass(frozen=True)
class Neo4jConfig:
    """Neo4j configuration."""

    uri: str = "bolt://localhost:7687"
    user: str = "neo4j"
    password: str = "nakari-dev"


@dataclass(frozen=True)
class SearchConfig:
    """Search configuration."""

    provider: Literal["serper"] = "serper"
    api_key: str = ""
    base_url: str | None = None
    timeout: int = 20


@dataclass(frozen=True)
class Config:
    """Application configuration."""

    openai: OpenAIConfig
    neo4j: Neo4jConfig
    search: SearchConfig | None = None

    @classmethod
    def from_env(cls) -> "Config":
        """Load configuration from environment variables."""
        openai = OpenAIConfig(
            api_key=getenv("OPENAI_API_KEY", ""),
            model=getenv("OPENAI_MODEL", "gpt-4o"),
            embedding_model=getenv("OPENAI_EMBEDDING_MODEL"),
            base_url=getenv("OPENAI_BASE_URL"),
        )

        neo4j = Neo4jConfig(
            uri=getenv("NEO4J_URI", "bolt://localhost:7687"),
            user=getenv("NEO4J_USER", "neo4j"),
            password=getenv("NEO4J_PASSWORD", "nakari-dev"),
        )

        serper_key = getenv("SERPER_API_KEY")
        search: SearchConfig | None = None
        if serper_key:
            search = SearchConfig(
                provider="serper",
                api_key=serper_key,
                base_url=getenv("SERPER_BASE_URL"),
                timeout=int(getenv("SERPER_TIMEOUT", "20")),
            )

        return cls(openai=openai, neo4j=neo4j, search=search)
