/**
 * Base error class for search-related errors.
 */
export class SearchError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, unknown>;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = "SearchError";
    this.code = "SEARCH_ERROR";
    this.context = context;

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, SearchError.prototype);
  }
}

/**
 * Error thrown when API key is missing or invalid.
 */
export class SearchAuthError extends SearchError {
  constructor(message: string = "Invalid or missing search API key") {
    super(message, { code: "AUTH_ERROR" });
    this.name = "SearchAuthError";
    Object.setPrototypeOf(this, SearchAuthError.prototype);
  }
}

/**
 * Error thrown when rate limit is exceeded.
 */
export class SearchRateLimitError extends SearchError {
  constructor(message: string = "Search API rate limit exceeded") {
    super(message, { code: "RATE_LIMIT" });
    this.name = "SearchRateLimitError";
    Object.setPrototypeOf(this, SearchRateLimitError.prototype);
  }
}
