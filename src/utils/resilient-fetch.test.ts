import { describe, expect, it, vi } from 'vitest';
import { resilientFetch } from './resilient-fetch.js';

describe('resilientFetch', () => {
  it('returns data on first successful attempt', async () => {
    const mockData = { status: 'healthy', count: 42 };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockData,
    } as unknown as Response);

    const result = await resilientFetch<typeof mockData>('https://api.example.com/status');
    expect(result).toEqual(mockData);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries on 500 error and succeeds on subsequent try', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 503,
          headers: new Headers(),
          text: async () => 'Service Unavailable',
        };
      }
      return {
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true }),
      };
    });

    const result = await resilientFetch<{ success: boolean }>('https://api.example.com/retry', {
      maxRetries: 2,
      baseDelayMs: 10,
    });

    expect(result.success).toBe(true);
    expect(callCount).toBe(2);
  });

  it('fails after exhausting maxRetries on persistent 5xx errors', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers(),
      text: async () => 'Internal Server Error',
    } as unknown as Response);

    await expect(
      resilientFetch('https://api.example.com/fail', {
        maxRetries: 2,
        baseDelayMs: 5,
      }),
    ).rejects.toThrow();
  });
});
