import { Redis } from '@upstash/redis';

// Provide safe fallback or memory mock if Upstash credentials are not supplied
const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

class MemoryRedisMock {
  private store = new Map<string, any>();

  async get<T = any>(key: string): Promise<T | null> {
    const val = this.store.get(key);
    return val !== undefined ? (val as T) : null;
  }

  async set(key: string, value: any, options?: any): Promise<string | null> {
    this.store.set(key, value);
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) count++;
    }
    return count;
  }

  async exists(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.store.has(key)) count++;
    }
    return count;
  }
}

export const redis: Redis = (upstashUrl && upstashToken && !upstashUrl.includes("dummy"))
  ? new Redis({
      url: upstashUrl,
      token: upstashToken,
    })
  : (new MemoryRedisMock() as unknown as Redis);