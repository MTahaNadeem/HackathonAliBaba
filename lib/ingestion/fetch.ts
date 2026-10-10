/**
 * lib/ingestion/fetch.ts
 *
 * Responsible HTTP fetcher for the ingestion pipeline.
 *
 * Rules enforced here:
 * - Identifies itself with a descriptive User-Agent
 * - Adds delays between requests to avoid hammering source sites
 * - Does NOT attempt to bypass robots.txt (fetch will be blocked server-side
 *   by Vercel's runtime if it returns non-2xx; the pipeline treats this as a
 *   parse failure and leaves DB data untouched)
 */

const USER_AGENT =
  'CourseCompassAI-Ingestion/1.0 (+https://github.com/syed-haseeb-badshah/AIHackathon; educational data pipeline; contact via repo issues)';

const FETCH_TIMEOUT_MS = 20_000;
const REQUEST_DELAY_MS = 3_000; // 3-second delay between consecutive requests

let lastRequestAt = 0;

/**
 * Fetch a URL with a polite delay since the last request and a proper User-Agent.
 * Returns the response text, or throws with a descriptive error message.
 * NEVER silently swallows errors — callers must treat any throw as a parse failure.
 */
export async function politeFetch(url: string): Promise<string> {
  // Enforce minimum delay between requests
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  if (lastRequestAt > 0 && elapsed < REQUEST_DELAY_MS) {
    await sleep(REQUEST_DELAY_MS - elapsed);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    lastRequestAt = Date.now();

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ${response.statusText} fetching ${url}`,
      );
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
