import neo4j, { type Driver, type Session } from "neo4j-driver";

export interface MemoryQueryResult {
  records: Record<string, unknown>[];
}

export interface MemoryWriteResult {
  stats: {
    nodesCreated: number;
    nodesDeleted: number;
    relationshipsCreated: number;
    relationshipsDeleted: number;
    propertiesSet: number;
    labelsAdded: number;
  };
}

export interface MemorySchemaResult {
  labels: string[];
  relationshipTypes: string[];
  propertyKeys: string[];
}

export class MemoryClient {
  private driver: Driver;

  constructor(uri: string, user: string, password: string) {
    this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  }

  /**
   * Execute a read-only Cypher query. nakari uses this to retrieve memories.
   */
  async query(cypher: string, params: Record<string, unknown> = {}): Promise<MemoryQueryResult> {
    const session: Session = this.driver.session({ defaultAccessMode: neo4j.session.READ });
    try {
      const result = await session.run(cypher, params);
      const records = result.records.map((record) => {
        const obj: Record<string, unknown> = {};
        for (const key of record.keys) {
          const k = String(key);
          obj[k] = this.convertValue(record.get(k));
        }
        return obj;
      });
      return { records };
    } finally {
      await session.close();
    }
  }

  /**
   * Execute a write Cypher query. nakari uses this to create/update/delete memories.
   */
  async write(cypher: string, params: Record<string, unknown> = {}): Promise<MemoryWriteResult> {
    const session: Session = this.driver.session({ defaultAccessMode: neo4j.session.WRITE });
    try {
      const result = await session.run(cypher, params);
      const counters = result.summary.counters.updates();
      return {
        stats: {
          nodesCreated: counters.nodesCreated,
          nodesDeleted: counters.nodesDeleted,
          relationshipsCreated: counters.relationshipsCreated,
          relationshipsDeleted: counters.relationshipsDeleted,
          propertiesSet: counters.propertiesSet,
          labelsAdded: counters.labelsAdded,
        },
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Inspect the current shape of the memory graph.
   * Returns all labels, relationship types, and property keys that exist.
   */
  async schema(): Promise<MemorySchemaResult> {
    const session: Session = this.driver.session({ defaultAccessMode: neo4j.session.READ });
    try {
      // Must run sequentially — Neo4j sessions don't support concurrent queries
      const labelsResult = await session.run("CALL db.labels()");
      const relTypesResult = await session.run("CALL db.relationshipTypes()");
      const propKeysResult = await session.run("CALL db.propertyKeys()");

      return {
        labels: labelsResult.records.map((r) => r.get("label") as string),
        relationshipTypes: relTypesResult.records.map((r) => r.get("relationshipType") as string),
        propertyKeys: propKeysResult.records.map((r) => r.get("propertyKey") as string),
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Verify connectivity to Neo4j.
   */
  async verifyConnectivity(): Promise<void> {
    await this.driver.verifyConnectivity();
  }

  /**
   * Close the driver. Must be called on shutdown.
   */
  async close(): Promise<void> {
    await this.driver.close();
  }

  /**
   * Convert Neo4j native types (integers, nodes, relationships) to plain JS values.
   */
  private convertValue(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }
    // Neo4j Integer -> number
    if (neo4j.isInt(value)) {
      return value.toNumber();
    }
    // Neo4j Node -> plain object with labels and properties
    if (this.isNode(value)) {
      return {
        _type: "node",
        _labels: value.labels,
        ...Object.fromEntries(
          Object.entries(value.properties).map(([k, v]) => [k, this.convertValue(v)]),
        ),
      };
    }
    // Neo4j Relationship -> plain object with type and properties
    if (this.isRelationship(value)) {
      return {
        _type: "relationship",
        _relationshipType: value.type,
        ...Object.fromEntries(
          Object.entries(value.properties).map(([k, v]) => [k, this.convertValue(v)]),
        ),
      };
    }
    // Arrays
    if (Array.isArray(value)) {
      return value.map((v) => this.convertValue(v));
    }
    return value;
  }

  private isNode(value: unknown): value is { labels: string[]; properties: Record<string, unknown> } {
    return typeof value === "object" && value !== null && "labels" in value && "properties" in value;
  }

  private isRelationship(value: unknown): value is { type: string; properties: Record<string, unknown> } {
    return (
      typeof value === "object" &&
      value !== null &&
      "type" in value &&
      "properties" in value &&
      !("labels" in value)
    );
  }
}
