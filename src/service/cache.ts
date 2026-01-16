import { z } from "zod";

interface CacheEntry<T> {
	data: T;
	expiresAt: number;
}

export class CacheManager {
	private cache = new Map<string, CacheEntry<any>>();
	private defaultTTL: number;

	constructor(defaultTTL: number = 5 * 60 * 1000) { // 5 minutes default
		this.defaultTTL = defaultTTL;
	}

	private generateKey(prefix: string, identifier: string | number, ...args: any[]): string {
		const argsStr = args.length > 0 ? `:${args.join(':')}` : '';
		return `${prefix}:${identifier}${argsStr}`;
	}

	async get<T>(prefix: string, identifier: string | number, ...args: any[]): Promise<T | null> {
		const key = this.generateKey(prefix, identifier, ...args);
		const entry = this.cache.get(key);

		if (!entry) {
			return null;
		}

		if (Date.now() > entry.expiresAt) {
			this.cache.delete(key);
			return null;
		}

		return entry.data as T;
	}

	async set<T>(prefix: string, identifier: string | number, data: T, ttl?: number, ...args: any[]): Promise<void> {
		const key = this.generateKey(prefix, identifier, ...args);
		const expiresAt = Date.now() + (ttl || this.defaultTTL);
		
		this.cache.set(key, {
			data,
			expiresAt
		});
	}

	async invalidate(prefix: string, identifier?: string | number): Promise<void> {
		if (identifier) {
			const key = this.generateKey(prefix, identifier);
			this.cache.delete(key);
		} else {
			// Invalidate all entries with this prefix
			for (const key of this.cache.keys()) {
				if (key.startsWith(`${prefix}:`)) {
					this.cache.delete(key);
				}
			}
		}
	}

	async invalidatePattern(pattern: string): Promise<void> {
		const regex = new RegExp(pattern);
		for (const key of this.cache.keys()) {
			if (regex.test(key)) {
				this.cache.delete(key);
			}
		}
	}

	cleanup(): void {
		const now = Date.now();
		for (const [key, entry] of this.cache.entries()) {
			if (now > entry.expiresAt) {
				this.cache.delete(key);
			}
		}
	}

	getStats(): {
		size: number;
		keys: string[];
	} {
		return {
			size: this.cache.size,
			keys: Array.from(this.cache.keys())
		};
	}

	clear(): void {
		this.cache.clear();
	}
}

export const globalCache = new CacheManager();

// Cache middleware for Hono
export function cacheMiddleware(prefix: string, ttl?: number) {
	return async (c: any, next: () => Promise<void>) => {
		const cacheKey = c.req.url;
		const cached = await globalCache.get(prefix, cacheKey);
		
		if (cached) {
			c.header('X-Cache', 'HIT');
			return c.json(cached);
		}

		await next();
		
		// Cache the response if it's successful
		if (c.res.status === 200) {
			const responseData = await c.res.clone().json();
			await globalCache.set(prefix, cacheKey, responseData, ttl);
		}
		
		c.header('X-Cache', 'MISS');
	};
}

// Cache invalidation utilities
export class CacheInvalidator {
	static async invalidateUser(userId: number): Promise<void> {
		await globalCache.invalidate('user', userId);
		await globalCache.invalidatePattern('config:user:' + userId + '.*');
	}

	static async invalidateConfig(configId: number, userId: number): Promise<void> {
		await globalCache.invalidate('config', configId);
		await globalCache.invalidate('config:user', userId);
	}

	static async invalidateUserConfigs(userId: number): Promise<void> {
		await globalCache.invalidatePattern('config:user:' + userId + '.*');
	}
}