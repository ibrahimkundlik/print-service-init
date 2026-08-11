import { Logger } from '@nestjs/common';
import { LiteralObject } from '@nestjs/cache-manager';
import Redis from 'ioredis';

export interface RedisCacheStoreOptions {
  client: Redis;
  keyPrefix?: string;
  ttl?: number;
}

export async function redisCacheStore(args: LiteralObject) {
  const logger = new Logger('RedisCacheStore');
  const {
    client,
    keyPrefix = '',
    ttl: defaultTtl,
  } = args as RedisCacheStoreOptions;

  if (!client) {
    throw new Error(
      'redisCacheStore requires a `client` (shared ioredis instance) option',
    );
  }

  const prefixed = (key: string) => keyPrefix + key;

  return {
    async get<T>(key: string): Promise<T | undefined> {
      const raw = await client.get(prefixed(key));
      if (raw === null) return undefined;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    },

    async set(key: string, value: unknown, ttl?: number): Promise<void> {
      const effectiveTtl = ttl ?? defaultTtl;
      const serialized = JSON.stringify(value);
      const fullKey = prefixed(key);
      if (effectiveTtl) {
        await client.set(fullKey, serialized, 'PX', effectiveTtl);
      } else {
        await client.set(fullKey, serialized);
      }
    },

    async del(key: string): Promise<void> {
      await client.del(prefixed(key));
    },

    async reset(): Promise<void> {
      logger.warn(
        'reset() called but is a no-op for the shared Redis instance',
      );
    },
  };
}
