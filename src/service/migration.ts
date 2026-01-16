import { CloudflareKVStore, SyncError } from "./store";
import { UserSchema } from "../service/user";
import { ConfigSchema } from "../service/config";

export class DataMigration {
	constructor(private kv: KVNamespace) {}

	async migrateFromArrays(): Promise<{ success: boolean; message: string; stats?: any }> {
		try {
			const stats = {
				usersMigrated: 0,
				configsMigrated: 0,
				errors: []
			};

			// Migrate users
			const usersMigrated = await this.migrateUsers();
			stats.usersMigrated = usersMigrated;

			// Migrate configs
			const configsMigrated = await this.migrateConfigs();
			stats.configsMigrated = configsMigrated;

			return {
				success: true,
				message: "Migration completed successfully",
				stats
			};
		} catch (error) {
			return {
				success: false,
				message: `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
				stats: { errors: [error] }
			};
		}
	}

	private async migrateUsers(): Promise<number> {
		let migratedCount = 0;

		try {
			// Get old array-based users
			const oldUsersData = await this.kv.get("tabby-users", { type: "json" });
			if (!oldUsersData) return 0;

			const oldUsers: any[] = oldUsersData;
			const userStore = new CloudflareKVStore<any>(
				this.kv,
				"user",
				UserSchema,
				"tabby-users-new"
			);

			// Reset counter
			await this.kv.put("user:counter", "0");

			// Migrate each user
			for (const oldUser of oldUsers) {
				try {
					// Clean up the user data to match new schema
					const cleanUser = {
						username: oldUser.username || "",
						active_config: oldUser.active_config || 0,
						custom_connection_gateway: oldUser.custom_connection_gateway || null,
						custom_connection_gateway_token: oldUser.custom_connection_gateway_token || null,
						config_sync_token: oldUser.config_sync_token || "",
						is_pro: oldUser.is_pro ?? true,
						is_sponsor: oldUser.is_sponsor ?? false,
						github_username: oldUser.github_username || ""
					};

					await userStore.create(cleanUser);
					migratedCount++;
				} catch (error) {
					console.error(`Failed to migrate user ${oldUser.id}:`, error);
				}
			}

			// Backup old data and replace with new
			await this.kv.put("tabby-users-backup", JSON.stringify(oldUsers));
			const newUsers = await userStore.findAll();
			await this.kv.put("tabby-users", JSON.stringify(newUsers));

		} catch (error) {
			console.error('Error migrating users:', error);
			throw new SyncError(
				`Failed to migrate users: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'MIGRATION_ERROR',
				{ entity: 'users' }
			);
		}

		return migratedCount;
	}

	private async migrateConfigs(): Promise<number> {
		let migratedCount = 0;

		try {
			// Get old array-based configs
			const oldConfigsData = await this.kv.get("tabby-configs", { type: "json" });
			if (!oldConfigsData) return 0;

			const oldConfigs: any[] = oldConfigsData;
			const configStore = new CloudflareKVStore<any>(
				this.kv,
				"config",
				ConfigSchema,
				"tabby-configs-new"
			);

			// Reset counter
			await this.kv.put("config:counter", "0");

			// Migrate each config
			for (const oldConfig of oldConfigs) {
				try {
					// Clean up the config data to match new schema
					const cleanConfig = {
						name: oldConfig.name || "",
						content: oldConfig.content || "{}",
						last_used_with_version: oldConfig.last_used_with_version || "",
						created_at: oldConfig.created_at || new Date().toISOString(),
						modified_at: oldConfig.modified_at || new Date().toISOString(),
						user: oldConfig.user || 0
					};

					await configStore.create(cleanConfig);
					migratedCount++;
				} catch (error) {
					console.error(`Failed to migrate config ${oldConfig.id}:`, error);
				}
			}

			// Backup old data and replace with new
			await this.kv.put("tabby-configs-backup", JSON.stringify(oldConfigs));
			const newConfigs = await configStore.findAll();
			await this.kv.put("tabby-configs", JSON.stringify(newConfigs));

		} catch (error) {
			console.error('Error migrating configs:', error);
			throw new SyncError(
				`Failed to migrate configs: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'MIGRATION_ERROR',
				{ entity: 'configs' }
			);
		}

		return migratedCount;
	}

	async getMigrationStatus(): Promise<{
		isMigrated: boolean;
		hasBackup: boolean;
		oldDataExists: boolean;
	}> {
		const oldUsers = await this.kv.get("tabby-users", { type: "json" });
		const oldConfigs = await this.kv.get("tabby-configs", { type: "json" });
		const usersBackup = await this.kv.get("tabby-users-backup");
		const configsBackup = await this.kv.get("tabby-configs-backup");
		
		// Check if migration markers exist
		const userCounter = await this.kv.get("user:counter");
		const configCounter = await this.kv.get("config:counter");

		return {
			isMigrated: !!(userCounter && configCounter),
			hasBackup: !!(usersBackup || configsBackup),
			oldDataExists: !!(oldUsers || oldConfigs)
		};
	}

	async rollbackMigration(): Promise<{ success: boolean; message: string }> {
		try {
			const usersBackup = await this.kv.get("tabby-users-backup", { type: "json" });
			const configsBackup = await this.kv.get("tabby-configs-backup", { type: "json" });

			if (usersBackup) {
				await this.kv.put("tabby-users", JSON.stringify(usersBackup));
			}

			if (configsBackup) {
				await this.kv.put("tabby-configs", JSON.stringify(configsBackup));
			}

			// Clean up migration markers
			await this.kv.delete("user:counter");
			await this.kv.delete("config:counter");

			return {
				success: true,
				message: "Rollback completed successfully"
			};
		} catch (error) {
			return {
				success: false,
				message: `Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			};
		}
	}
}