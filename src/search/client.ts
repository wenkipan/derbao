import type { SearchProvider } from "./providers.js";
import type { SearchResponse, SearchOptions } from "./types.js";
import { SerperProvider, type SerperConfig } from "./providers.js";
import { SearchError } from "./errors.js";

/**
 * Main search client that wraps a provider implementation.
 * Follows the same pattern as MemoryClient.
 */
export class SearchClient {
  private provider: SearchProvider;

  constructor(provider: SearchProvider) {
    this.provider = provider;
  }

  /**
   * Execute a web search using the configured provider.
   *
   * @param query - The search query string
   * @param options - Optional search parameters
   * @returns Standardized search response
   */
  async search(query: string, options?: SearchOptions): Promise<SearchResponse> {
    return this.provider.search(query, options);
  }

  /**
   * Convenience method for news search.
   */
  async searchNews(query: string, options?: Omit<SearchOptions, "type">): Promise<SearchResponse> {
    return this.search(query, { ...options, type: "news" });
  }

  /**
   * Verify connectivity to the search provider.
   * Performs a minimal search to validate API key and connectivity.
   */
  async verifyConnectivity(): Promise<void> {
    try {
      await this.search("test", { numResults: 1, timeout: 5000 });
    } catch (err) {
      throw new SearchError(
        `Failed to verify search connectivity: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

/**
 * Factory function to create a SearchClient with Serper.dev provider.
 *
 * @param config - Serper.dev configuration
 * @returns Configured SearchClient instance
 */
export function createSerperClient(config: SerperConfig): SearchClient {
  const provider = new SerperProvider(config);
  return new SearchClient(provider);
}
