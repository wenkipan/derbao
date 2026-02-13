"""Memory module for Neo4j graph database integration."""

from neo4j import AsyncGraphDatabase, AsyncDriver, Record
from typing import Any


class MemoryClient:
    """Neo4j memory client for graph database operations.

    Provides query, write, schema inspection, and connection management.
    """

    def __init__(self, uri: str, user: str, password: str) -> None:
        """Initialize the Neo4j memory client.

        Args:
            uri: Neo4j connection URI (e.g., "bolt://localhost:7687")
            user: Database user
            password: Database password
        """
        self._driver: AsyncDriver = AsyncGraphDatabase.driver(
            uri, auth=(user, password)
        )
        self._uri = uri
        self._user = user

    async def query(
        self, cypher: str, params: dict[str, Any]
    ) -> dict[str, Any]:
        """Execute a read-only Cypher query.

        Args:
            cypher: Parameterized Cypher query string
            params: Query parameters (for parameterized queries)

        Returns:
            Dictionary with 'records' key containing list of result records
        """
        async with self._driver.session() as session:
            result = await session.run(cypher, params)
            records = [self._convert_record(record) async for record in result]
            return {"records": records}

    async def write(
        self, cypher: str, params: dict[str, Any]
    ) -> dict[str, Any]:
        """Execute a write Cypher query.

        Args:
            cypher: Parameterized Cypher query string
            params: Query parameters (for parameterized queries)

        Returns:
            Dictionary with 'stats' key containing operation statistics
        """
        async with self._driver.session() as session:
            result = await session.run(cypher, params)
            summary = await result.consume()
            stats = {
                "nodesCreated": summary.counters.nodes_created,
                "nodesDeleted": summary.counters.nodes_deleted,
                "relationshipsCreated": summary.counters.relationships_created,
                "relationshipsDeleted": summary.counters.relationships_deleted,
                "propertiesSet": summary.counters.properties_set,
                "labelsAdded": summary.counters.labels_added,
            }
            return {"stats": stats}

    async def schema(self) -> dict[str, Any]:
        """Inspect the database schema.

        Returns:
            Dictionary with 'labels', 'relationshipTypes', and 'propertyKeys' keys
        """
        async with self._driver.session() as session:
            # Get all node labels
            label_result = await session.run(
                "CALL db.labels() YIELD label RETURN collect(label) AS labels"
            )
            label_record = await label_result.single()
            labels = label_record["labels"] if label_record else []

            # Get all relationship types
            rel_result = await session.run(
                "CALL db.relationshipTypes() YIELD relationshipType "
                "RETURN collect(relationshipType) AS types"
            )
            rel_record = await rel_result.single()
            relationship_types = rel_record["types"] if rel_record else []

            # Get all property keys
            prop_result = await session.run(
                "CALL db.propertyKeys() YIELD propertyKey "
                "RETURN collect(propertyKey) AS keys"
            )
            prop_record = await prop_result.single()
            property_keys = prop_record["keys"] if prop_record else []

            return {
                "labels": labels,
                "relationshipTypes": relationship_types,
                "propertyKeys": property_keys,
            }

    async def verify_connectivity(self) -> None:
        """Verify connectivity to the Neo4j database.

        Raises:
            Exception: If connection cannot be established
        """
        async with self._driver.session() as session:
            await session.run("RETURN 1")

    async def close(self) -> None:
        """Close the database driver connection."""
        await self._driver.close()

    def _convert_record(self, record: Record) -> dict[str, Any]:
        """Convert a Neo4j Record to a plain Python dictionary.

        Args:
            record: Neo4j Record object

        Returns:
            Plain Python dictionary with converted types
        """
        result: dict[str, Any] = {}
        for key, value in record.items():
            result[key] = self._convert_value(value)
        return result

    def _convert_value(self, value: Any) -> Any:
        """Convert Neo4j types to plain Python types.

        Args:
            value: Value from Neo4j

        Returns:
            Converted Python value
        """
        from neo4j.time import Date, Time, DateTime, Duration

        # Check if value is a Node or Relationship by duck typing
        # In neo4j 6.x, these are not directly exported
        if hasattr(value, "_labels"):
            # This is a Node
            result = {"_type": "node", "_labels": list(value._labels)}
            result.update(dict(value))
            return result
        elif hasattr(value, "_type"):
            # This is a Relationship
            result = {
                "_type": "relationship",
                "_relationshipType": value._type,
            }
            result.update(dict(value))
            return result
        elif isinstance(value, (Date, Time, DateTime, Duration)):
            return str(value)
        elif isinstance(value, list):
            return [self._convert_value(v) for v in value]
        elif isinstance(value, dict):
            return {k: self._convert_value(v) for k, v in value.items()}
        else:
            return value
