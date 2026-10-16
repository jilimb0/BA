import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { TokenBucketLimiter } from './rate-limiter.js';

describe('Rate Limiter Middleware', () => {
  it('allows requests within threshold and sets RateLimit headers', async () => {
    const app = new Hono();
    const limiter = new TokenBucketLimiter({
      windowMs: 60000,
      maxRequests: 5,
    });
    app.use('/test', limiter.middleware());
    app.get('/test', (c) => c.json({ ok: true }));

    const res1 = await app.request('/test');
    expect(res1.status).toBe(200);
    expect(res1.headers.get('RateLimit-Limit')).toBe('5');
    expect(res1.headers.get('RateLimit-Remaining')).toBe('4');
    expect(res1.headers.get('RateLimit-Reset')).toBe('60');

    const res2 = await app.request('/test');
    expect(res2.status).toBe(200);
    expect(res2.headers.get('RateLimit-Remaining')).toBe('3');
  });

  it('rejects with 429 and Retry-After header when limit is exceeded', async () => {
    const app = new Hono();
    const limiter = new TokenBucketLimiter({
      windowMs: 10000,
      maxRequests: 2,
      message: 'Rate limit hit',
    });
    app.use('/limited', limiter.middleware());
    app.get('/limited', (c) => c.json({ ok: true }));

    // Request 1 & 2 pass
    const r1 = await app.request('/limited');
    expect(r1.status).toBe(200);
    const r2 = await app.request('/limited');
    expect(r2.status).toBe(200);

    // Request 3 is blocked
    const r3 = await app.request('/limited');
    expect(r3.status).toBe(429);
    expect(r3.headers.get('Retry-After')).toBeDefined();
    const body = (await r3.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe('Rate limit hit');
  });

  it('supports custom key extractor per client', async () => {
    const app = new Hono();
    const limiter = new TokenBucketLimiter({
      windowMs: 60000,
      maxRequests: 1,
      keyGenerator: (c) => c.req.header('x-user-id') || 'anon',
    });
    app.use('/user', limiter.middleware());
    app.get('/user', (c) => c.json({ ok: true }));

    const user1Res1 = await app.request('/user', { headers: { 'x-user-id': 'u1' } });
    expect(user1Res1.status).toBe(200);

    const user1Res2 = await app.request('/user', { headers: { 'x-user-id': 'u1' } });
    expect(user1Res2.status).toBe(429);

    // User 2 has separate bucket
    const user2Res1 = await app.request('/user', { headers: { 'x-user-id': 'u2' } });
    expect(user2Res1.status).toBe(200);
  });

  it('supports skip function to bypass limiting', async () => {
    const app = new Hono();
    const limiter = new TokenBucketLimiter({
      windowMs: 60000,
      maxRequests: 1,
      skip: (c) => c.req.header('x-bypass') === 'true',
    });
    app.use('/bypass', limiter.middleware());
    app.get('/bypass', (c) => c.json({ ok: true }));

    await app.request('/bypass');
    const blocked = await app.request('/bypass');
    expect(blocked.status).toBe(429);

    const bypassed = await app.request('/bypass', { headers: { 'x-bypass': 'true' } });
    expect(bypassed.status).toBe(200);
  });
});
