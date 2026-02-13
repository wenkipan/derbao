// Main exports
export { SearchClient, createSerperClient } from "./client.js";

// Types
export type {
  SearchResult,
  SearchResponse,
  SearchOptions,
  SearchType,
} from "./types.js";

// Provider interface
export type { SearchProvider, SerperConfig } from "./providers.js";
export { SerperProvider } from "./providers.js";

// Errors
export { SearchError, SearchAuthError, SearchRateLimitError } from "./errors.js";
