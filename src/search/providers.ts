import type { SearchResponse, SearchOptions, SearchResult } from "./types.js";
import { SearchError, SearchAuthError, SearchRateLimitError } from "./errors.js";

/**
 * Abstract interface for search providers.
 * All search implementations must implement this interface.
 */
export interface SearchProvider {
  /**
   * Human-readable provider name.
   */
  readonly name: string;

  /**
   * Execute a search query.
   *
   * @param query - The search query string
   * @param options - Optional search parameters
   * @returns Standardized search response
   * @throws {SearchError} On provider errors or network failures
   */
  search(query: string, options?: SearchOptions): Promise<SearchResponse>;
}

/**
 * Configuration for Serper.dev provider.
 */
export interface SerperConfig {
  /** API key from https://serper.dev */
  apiKey: string;
  /** Base URL (default: https://google.serper.dev) */
  baseUrl?: string;
  /** Default timeout in milliseconds */
  timeout?: number;
}

/**
 * Serper.dev search provider implementation.
 *
 * Serper.dev provides Google Search results via a simple REST API.
 * Documentation: https://serper.dev/api-guide
 */
export class SerperProvider implements SearchProvider {
  readonly name = "Serper.dev";
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultTimeout: number;

  constructor(config: SerperConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? "https://google.serper.dev";
    this.defaultTimeout = config.timeout ?? 10000;
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResponse> {
    const timeout = options?.timeout ?? this.defaultTimeout;
    const numResults = options?.numResults ?? 10;

    // Build request body based on Serper.dev API
    const body: Record<string, unknown> = {
      q: query,
      num: numResults,
    };

    // Add type-specific parameters
    if (options?.type === "news") {
      body.type = "news";
    } else if (options?.type === "images") {
      body.type = "images";
    } else if (options?.type === "videos") {
      body.type = "videos";
    }

    if (options?.language) {
      body.hl = options.language;
    }

    if (options?.region) {
      body.gl = options.region;
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.baseUrl}/search`, {
        method: "POST",
        headers: {
          "X-API-KEY": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new SearchAuthError();
        }
        if (response.status === 429) {
          throw new SearchRateLimitError();
        }
        const errorText = await response.text().catch(() => "Unknown error");
        throw new SearchError(`Serper.dev API error: ${response.status} ${response.statusText}`, {
          statusCode: response.status,
          body: errorText,
        });
      }

      const data = (await response.json()) as SerperResponse;
      return this.transformResponse(data, query);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new SearchError(`Search timeout after ${timeout}ms`);
      }
      if (err instanceof SearchError) {
        throw err;
      }
      throw new SearchError(
        `Failed to execute search: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Transform Serper.dev response to standardized format.
   */
  private transformResponse(data: SerperResponse, query: string): SearchResponse {
    const results: SearchResult[] = [];

    // Organic results
    if (data.organic) {
      for (const item of data.organic) {
        results.push({
          title: item.title,
          link: item.link,
          snippet: item.snippet,
          thumbnailUrl: item.thumbnailUrl,
        });
      }
    }

    // News results (if type is "news")
    if (data.news) {
      for (const item of data.news) {
        results.push({
          title: item.title,
          link: item.link,
          snippet: item.snippet,
          date: item.date,
          thumbnailUrl: item.imageUrl,
          siteName: item.source,
        });
      }
    }

    return {
      results,
      totalResults: results.length,
      query,
      metadata: {
        searchParameters: data.searchParameters,
        relatedSearches: data.relatedSearches,
      },
    };
  }
}

/**
 * Serper.dev API response types.
 * See: https://serper.dev/api-guide
 */
interface SerperResponse {
  searchParameters?: Record<string, unknown>;
  organic?: Array<{
    title: string;
    link: string;
    snippet: string;
    thumbnailUrl?: string;
  }>;
  news?: Array<{
    title: string;
    link: string;
    snippet: string;
    date: string;
    source: string;
    imageUrl?: string;
  }>;
  relatedSearches?: Array<{
    query: string;
  }>;
}
