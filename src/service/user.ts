import { z } from "zod";
import { CloudflareKVStore, SyncError, globalEventManager } from "./store";
import { globalCache, CacheInvalidator } from "./cache";

export const UserSchema = z.object({
	id: z.number(),
	username: z.string(),
	active_config: z.number(),
	custom_connection_gateway: z.string().nullable(),
	custom_connection_gateway_token: z.string().nullable(),
	config_sync_token: z.string(),
	is_pro: z.boolean(),
	is_sponsor: z.boolean(),
	github_username: z.string()
});

export type User = z.infer<typeof UserSchema>;

export class UserService {
	private store: CloudflareKVStore<User>;

	constructor(kv: KVNamespace) {
		this.store = new CloudflareKVStore<User>(
			kv,
			"user",
			UserSchema,
			"tabby-users"
		);
	}

	async findByToken(syncToken: string): Promise<User | null> {
		try {
			// Try cache first
			const cacheKey = `token:${syncToken}`;
			const cached = await globalCache.get<User>('user', cacheKey);
			if (cached) return cached;

			const users = await this.store.findBy("config_sync_token", syncToken);
			const user = users.length > 0 ? users[0] : null;
			
			// Cache the result
			if (user) {
				await globalCache.set('user', cacheKey, user, 10 * 60 * 1000); // 10 minutes
			}
			
			return user;
		} catch (error) {
			if (error instanceof SyncError) {
				throw error;
			}
			throw new SyncError(
				`Failed to find user by token: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'USER_FIND_ERROR',
				{ syncToken }
			);
		}
	}

	async findById(id: number): Promise<User | null> {
		// Try cache first
		const cached = await globalCache.get<User>('user', id);
		if (cached) return cached;

		const user = await this.store.findById(id);
		
		// Cache() result
		if (user) {
			await globalCache.set('user', id, user, 10 * 60 * 1000); // 10 minutes
		}
		
		return user;
	}

	async findByGithubUsername(githubUsername: string): Promise<User | null> {
		try {
			const users = await this.store.findBy("github_username", githubUsername);
			return users.length > 0 ? users[0] : null;
		} catch (error) {
			if (error instanceof SyncError) {
				throw error;
			}
			throw new SyncError(
				`Failed to find user by GitHub username: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'USER_FIND_ERROR',
				{ githubUsername }
			);
		}
	}

	async create(userData: Omit<User, 'id'>): Promise<User> {
		try {
			const user = await this.store.create(userData);
			
			// Cache the new user
			await globalCache.set('user', user.id, user, 10 * 60 * 1000);
			await globalCache.set('user', `token:${user.config_sync_token}`, user, 10 * 60 * 1000);
			
			globalEventManager.emit('user:created', { user });
			
			return user;
		} catch (error) {
			if (error instanceof SyncError) {
				throw error;
			}
			throw new SyncError(
				`Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'USER_CREATE_ERROR',
				{ userData }
			);
		}
	}

	async update(id: number, updates: Partial<User>): Promise<User | null> {
		try {
			const user = await this.store.update(id, updates);
			
			if (user) {
				// Update cache
				await globalCache.set('user', id, user, 10 * 60 * 1000);
				await globalCache.set('user', `token:${user.config_sync_token}`, user, 10 * 60 * 1000);
				
				globalEventManager.emit('user:updated', { user, updates });
			}
			
			return user;
		} catch (error) {
			if (error instanceof SyncError) {
				throw error;
			}
			throw new SyncError(
				`Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'USER_UPDATE_ERROR',
				{ id, updates }
			);
		}
	}

	async delete(id: number): Promise<boolean> {
		try {
			// Get user before deleting for cache invalidation
			const user = await this.findById(id);
			const success = await this.store.delete(id);
			
			if (success) {
				// Invalidate cache
				await CacheInvalidator.invalidateUser(id);
				if (user) {
					await globalCache.invalidate('user', `token:${user.config_sync_token}`);
				}
				
				globalEventManager.emit('user:deleted', { id });
			}
			
			return success;
		} catch (error) {
			if (error instanceof SyncError) {
				throw error;
			}
			throw new SyncError(
				`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'USER_DELETE_ERROR',
				{ id }
			);
		}
	}

	async getAll(options?: { limit?: number; offset?: number }): Promise<User[]> {
		return this.store.findAll(options);
	}
}