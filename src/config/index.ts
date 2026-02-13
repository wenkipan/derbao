import "dotenv/config";

export interface Config {
  openai: {
    apiKey: string;
    model: string;
    embeddingModel?: string;
    baseURL?: string;
  };
  neo4j: {
    uri: string;
    user: string;
    password: string;
  };
  search?: {
    provider: "serper";
    apiKey: string;
    baseUrl?: string;
    timeout?: number;
  };
}

export function loadConfig(): Config {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required. Copy .env.example to .env and fill in your key.");
  }

  return {
    openai: {
      apiKey,
      model: process.env["OPENAI_MODEL"] ?? "gpt-4o",
      embeddingModel: process.env["OPENAI_EMBEDDING_MODEL"] || undefined,
      baseURL: process.env["OPENAI_BASE_URL"] || undefined,
    },
    neo4j: {
      uri: process.env["NEO4J_URI"] ?? "bolt://localhost:7687",
      user: process.env["NEO4J_USER"] ?? "neo4j",
      password: process.env["NEO4J_PASSWORD"] ?? "nakari-dev",
    },
    search: process.env["SERPER_API_KEY"]
      ? {
          provider: "serper" as const,
          apiKey: process.env["SERPER_API_KEY"],
          baseUrl: process.env["SERPER_BASE_URL"] || undefined,
          timeout: process.env["SERPER_TIMEOUT"]
            ? Number.parseInt(process.env["SERPER_TIMEOUT"], 10)
            : undefined,
        }
      : undefined,
  };
}
