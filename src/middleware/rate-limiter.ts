import type { Context, MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

export interface RateLimiterOptions {
  windowMs?: number; // duration of the sliding window in milliseconds (default: 60s)
  maxRequests?: number; // max requests per window (default: 100)
  keyGenerator?: (c: Context) => string; // custom key extractor
  message?: string;
  skip?: (c: Context) => boolean;
}

interface ClientBucket {
  tokens: number;
  lastRefill: number;
}

export class TokenBucketLimiter {
  private buckets = new Map<string, ClientBucket>();
  private windowMs: number;
  private maxRequests: number;
  private keyGenerator: (c: Context) => string;
  private message: string;
  private skip?: (c: Context) => boolean;

  constructor(options?: RateLimiterOptions) {
    this.windowMs = options?.windowMs ?? 60 * 1000;
    this.maxRequests = options?.maxRequests ?? 60;
    this.message = options?.message ?? 'Rate limit exceeded. Please retry later.';
    this.skip = options?.skip;
    this.keyGenerator =
      options?.keyGenerator ??
      ((c: Context) => {
        const forwarded = c.req.header('x-forwarded-for');
        if (forwarded) {
          return forwarded.split(',')[0].trim();
        }
        return c.req.header('x-real-ip') || '127.0.0.1';
      });
  }

  public middleware(): MiddlewareHandler {
    return async (c: Context, next) => {
      if (this.skip?.(c)) {
        return next();
      }

      const clientKey = this.keyGenerator(c);
      const now = Date.now();
      let bucket = this.buckets.get(clientKey);

      if (!bucket) {
        bucket = { tokens: this.maxRequests, lastRefill: now };
        this.buckets.set(clientKey, bucket);
      } else {
        // Refill tokens proportional to elapsed time
        const elapsed = now - bucket.lastRefill;
        const refillTokens = (elapsed / this.windowMs) * this.maxRequests;
        bucket.tokens = Math.min(this.maxRequests, bucket.tokens + refillTokens);
        bucket.lastRefill = now;
      }

      const remaining = Math.max(0, Math.floor(bucket.tokens));
      const resetSeconds = Math.ceil(this.windowMs / 1000);

      c.header('RateLimit-Limit', this.maxRequests.toString());
      c.header('RateLimit-Remaining', Math.max(0, remaining - 1).toString());
      c.header('RateLimit-Reset', resetSeconds.toString());

      if (bucket.tokens < 1) {
        const retryAfterSec = Math.ceil(
          ((1 - bucket.tokens) / this.maxRequests) * (this.windowMs / 1000),
        );
        c.header('Retry-After', retryAfterSec.toString());

        throw new HTTPException(429, {
          message: this.message,
          res: new Response(
            JSON.stringify({
              ok: false,
              error: this.message,
              retryAfterSeconds: retryAfterSec,
            }),
            {
              status: 429,
              headers: {
                'Content-Type': 'application/json',
                'Retry-After': retryAfterSec.toString(),
                'RateLimit-Limit': this.maxRequests.toString(),
                'RateLimit-Remaining': '0',
                'RateLimit-Reset': resetSeconds.toString(),
              },
            },
          ),
        });
      }

      bucket.tokens -= 1;
      await next();
    };
  }

  public reset(): void {
    this.buckets.clear();
  }

  public getActiveBucketsCount(): number {
    return this.buckets.size;
  }
}

export function createRateLimiter(options?: RateLimiterOptions): MiddlewareHandler {
  const limiter = new TokenBucketLimiter(options);
  return limiter.middleware();
}
