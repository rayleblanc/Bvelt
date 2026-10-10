import { parseRateLimitHeaders, getRateLimitMessage } from './rateLimitService';

/**
 * Helper to sleep for a given ms
 */
export const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Custom Error for 429 Rate Limits
 */
export class RateLimitError extends Error {
  public isRateLimited = true;
  public retryAfterSeconds: number | null;
  public remaining: number;

  constructor(message?: string, retryAfterSeconds: number | null = null, remaining = 0) {
    super(message || getRateLimitMessage());
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
    this.remaining = remaining;
  }
}

/**
 * Fetch wrapper with exponential backoff for Network Errors (Failed to fetch).
 * Retries up to 2 times (3 attempts total) on transient network issues.
 * On 429 (Rate Limit): NO retry storm. At most 1 single backoff retry only if Retry-After is <= 2s.
 */
export async function fetchWithRetry(url: string, options?: RequestInit, maxRetries = 2): Promise<Response> {
  let attempt = 0;
  while (true) {
    try {
      if (options?.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      const response = await fetch(url, options);

      // Check for rate limit status
      if (response.status === 429) {
        const { remaining, retryAfter } = parseRateLimitHeaders(response);
        // Only retry once if Retry-After is explicitly very short (e.g. 1-2s)
        if (attempt === 0 && retryAfter !== null && retryAfter <= 2) {
          attempt++;
          console.warn(`[429 Backoff Retry] ${url} waiting ${retryAfter}s...`);
          await delay(retryAfter * 1000);
          continue;
        }
        return response;
      }

      // Check if successful response provided remaining headers
      parseRateLimitHeaders(response);

      return response;
    } catch (error: any) {
      if (error?.name === 'AbortError' || options?.signal?.aborted) {
        throw error;
      }
      const isNetworkError = 
        (error?.message?.toLowerCase().includes('failed to fetch') || 
         error?.message?.toLowerCase().includes('network error') ||
         error?.message?.toLowerCase().includes('networkerror') ||
         error?.message?.toLowerCase().includes('load failed') || // Safari
         error instanceof TypeError);

      if (isNetworkError && attempt < maxRetries) {
        attempt++;
        const backoffDelay = 1000 * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 300;
        console.warn(`[Network Retry] ${url} (Intento ${attempt}/${maxRetries})...`);
        await delay(backoffDelay + jitter);
        continue;
      }
      throw error;
    }
  }
}

/**
 * Safely parses JSON from a Response object, verifying headers first.
 */
export async function parseSafeJson(response: Response, endpointLabel: string): Promise<any> {
  if (response.status === 429) {
    const { retryAfter } = parseRateLimitHeaders(response);
    throw new RateLimitError(getRateLimitMessage(), retryAfter, 0);
  }

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status} for ${endpointLabel}`);
  }
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const text = await response.text();
    const isHtml = text.trim().startsWith("<") || text.toLowerCase().includes("<!doctype html>");
    console.error(`[parseSafeJson] Expected JSON but received ${contentType || 'no content-type'} for ${endpointLabel}. HTML: ${isHtml}. Partial body: ${text.substring(0, 100)}`);
    throw new Error(`Invalid content-type: ${contentType || 'null'} (Expected application/json) for ${endpointLabel}`);
  }
  try {
    return await response.json();
  } catch (jsonError) {
    console.error(`[parseSafeJson] Failed to parse JSON for ${endpointLabel}:`, jsonError);
    throw new Error(`Failed to parse JSON response for ${endpointLabel}`);
  }
}

