import { z } from "zod";
import { CloudflareKVStore, SyncError, globalEventManager } from "./store";
import { globalCache, CacheInvalidator } from "./cache";

export const ConfigSchema = z.object({
	id: z.number(),
	name: z.string(),
	content: z.string(),
	last_used_with_version: z.string(),
	created_at: z.string(),
	modified_at: z.string(),
	user: z.number()
});

export type Config = z.infer<typeof ConfigSchema>;

export class ConfigService {
	private store: CloudflareKVStore<Config>;

	constructor(kv: KVNamespace) {
		this.store = new CloudflareKVStore<Config>(
			kv,
			"config",
			ConfigSchema,
			"tabby-configs"
		);
	}

	async findByUser(userId: number, options?: { limit?: number; offset?: number }): Promise<Config[]> {
		try {
			// Create cache key based on options
			const cacheKey = `user:${userId}:${JSON.stringify(options || {})}`;
			const cached = await globalCache.get<Config[]>('config', cacheKey);
			if (cached) return cached;

			const result = await this.store.query({
				where: { user: userId } as Partial<Config>,
				pagination: options,
				orderBy: 'modified_at',
				order: 'desc'
			});
			
			// Cache for 5 minutes
			await globalCache.set('config', cacheKey, result.data, 5 * 60 * 1000);
			
			return result.data;
		} catch (error) {
			if (error instanceof SyncError) {
				throw error;
			}
			throw new SyncError(
				`Failed to find configs by user: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'CONFIG_FIND_ERROR',
				{ userId }
			);
		}
	}

	async findById(id: number): Promise<Config | null> {
		// Try cache first
		const cached = await globalCache.get<Config>('config', id);
		if (cached) return cached;

		const config = await this.store.findById(id);
		
		// Cache result
		if (config) {
			await globalCache.set('config', id, config, 10 * 60 * 1000); // 10 minutes
		}
		
		return config;
	}

	async create(configData: Omit<Config, 'id' | 'created_at' | 'modified_at'>, userId: number): Promise<Config> {
		try {
			const now = new Date().toISOString();
			const completeConfigData = {
				...configData,
				user: userId,
				content: configData.content || "{}",
				created_at: now,
				modified_at: now
			};

			const config = await this.store.create(completeConfigData);
			
			// Cache new config
			await globalCache.set('config', config.id, config, 10 * 60 * 1000);
			
			// Invalidate user's config list cache
			await CacheInvalidator.invalidateUserConfigs(userId);
			
			globalEventManager.emit('config:created', { config, userId });
			
			return config;
		} catch (error) {
			if (error instanceof SyncError) {
				throw error;
			}
			throw new SyncError(
				`Failed to create config: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'CONFIG_CREATE_ERROR',
				{ configData, userId }
			);
		}
	}

	async update(id: number, updates: Partial<Config>): Promise<Config | null> {
		try {
			const updateData = {
				...updates,
				modified_at: new Date().toISOString()
			};

			const config = await this.store.update(id, updateData);
			
			if (config) {
				// Update cache
				await globalCache.set('config', id, config, 10 * 60 * 1000);
				
				// Invalidate user's config list cache
				await CacheInvalidator.invalidateUserConfigs(config.user);
				
				globalEventManager.emit('config:updated', { config, updates });
			}
			
			return config;
		} catch (error) {
			if (error instanceof SyncError) {
				throw error;
			}
			throw new SyncError(
				`Failed to update config: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'CONFIG_UPDATE_ERROR',
				{ id, updates }
			);
		}
	}

	async delete(id: number): Promise<boolean> {
		try {
			const config = await this.findById(id);
			const success = await this.store.delete(id);
			
			if (success && config) {
				// Invalidate cache
				await CacheInvalidator.invalidateConfig(id, config.user);
				
				globalEventManager.emit('config:deleted', { config, userId: config.user });
			}
			
			return success;
		} catch (error) {
			if (error instanceof SyncError) {
				throw error;
			}
			throw new SyncError(
				`Failed to delete config: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'CONFIG_DELETE_ERROR',
				{ id }
			);
		}
	}

	async getAll(options?: { limit?: number; offset?: number }): Promise<Config[]> {
		return this.store.findAll(options);
	}

	async getUserConfigCount(userId: number): Promise<number> {
		try {
			const result = await this.store.query({
				where: { user: userId } as Partial<Config>
			});
			return result.total;
		} catch (error) {
			if (error instanceof SyncError) {
				throw error;
			}
			throw new SyncError(
				`Failed to count user configs: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'CONFIG_COUNT_ERROR',
				{ userId }
			);
		}
	}
}