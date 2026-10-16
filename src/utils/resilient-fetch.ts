export interface ResilientFetchOptions extends RequestInit {
  timeoutMs?: number;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

/**
 * Resilient fetch wrapper with AbortController timeout and exponential backoff with Full Jitter.
 * Adheres to Section 3.1 of the 2026 Ecosystem Blueprint.
 */
export async function resilientFetch<T = unknown>(
  url: string,
  options: ResilientFetchOptions = {},
): Promise<T> {
  const {
    timeoutMs = 5000,
    maxRetries = 3,
    baseDelayMs = 300,
    maxDelayMs = 4000,
    ...fetchOpts
  } = options;

  let attempt = 0;

  while (true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchOpts,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        if ((response.status >= 500 || response.status === 429) && attempt < maxRetries) {
          throw new Error(`HTTP_${response.status}`);
        }
        const errorText = await response.text().catch(() => '');
        throw new Error(`Request failed with status ${response.status}: ${errorText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return (await response.json()) as T;
      }
      return (await response.text()) as unknown as T;
    } catch (err: unknown) {
      clearTimeout(timer);
      attempt++;

      if (attempt > maxRetries) {
        throw err;
      }

      // Exponential backoff with Full Jitter
      const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      const jitteredDelay = Math.floor(Math.random() * exponentialDelay);
      await new Promise((resolve) => setTimeout(resolve, jitteredDelay));
    }
  }
}
