import "dotenv/config";

export interface Config {
  openai: {
    apiKey: string;
    model: string;
    baseURL?: string;
  };
  neo4j: {
    uri: string;
    user: string;
    password: string;
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
      baseURL: process.env["OPENAI_BASE_URL"] || undefined,
    },
    neo4j: {
      uri: process.env["NEO4J_URI"] ?? "bolt://localhost:7687",
      user: process.env["NEO4J_USER"] ?? "neo4j",
      password: process.env["NEO4J_PASSWORD"] ?? "nakari-dev",
    },
  };
}
