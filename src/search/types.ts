/**
 * Standardized search result across all providers.
 * LLM-friendly structure with rich metadata.
 */
export interface SearchResult {
  /** The page title */
  title: string;
  /** URL of the result */
  link: string;
  /** Brief description/snippet from the page */
  snippet: string;
  /** Optional: publication date (ISO 8601) */
  date?: string;
  /** Optional: thumbnail image URL */
  thumbnailUrl?: string;
  /** Optional: site name (news articles, etc.) */
  siteName?: string;
}

/**
 * Complete search response containing results and metadata.
 */
export interface SearchResponse {
  /** Array of search results */
  results: SearchResult[];
  /** Total number of results available */
  totalResults?: number;
  /** The query that was executed */
  query: string;
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Search options that can be configured per query.
 */
export interface SearchOptions {
  /** Maximum number of results to return (default: 10) */
  numResults?: number;
  /** Search type (web, news, images, etc.) */
  type?: SearchType;
  /** Language code (e.g. "en", "zh-CN") */
  language?: string;
  /** Geographic region (e.g. "us", "cn") */
  region?: string;
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;
}

export type SearchType = "search" | "news" | "images" | "videos";
