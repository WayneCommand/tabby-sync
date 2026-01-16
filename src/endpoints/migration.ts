import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { DataMigration } from "../service/migration";
import { SyncError } from "../service/store";

export class DataMigrate extends OpenAPIRoute {
	schema = {
		tags: ["Admin"],
		summary: "Migrate data from array-based to key-based storage",
		responses: {
			"200": {
				description: "Migration completed",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							message: z.string(),
							stats: z.object({
								usersMigrated: z.number(),
								configsMigrated: z.number(),
								errors: z.array(z.any())
							}).optional()
						}),
					},
				},
			},
			"500": {
				description: "Migration failed",
			},
		},
	};

	async handle(c: any) {
		try {
			// Add security check - you might want to add admin authentication here
			const adminKey = c.req.header("X-Admin-Key");
			if (adminKey !== c.env.ADMIN_KEY) {
				return c.json({ error: "Unauthorized" }, 401);
			}

			const migration = new DataMigration(c.env.KV);
			const result = await migration.migrateFromArrays();
			
			return c.json(result);
		} catch (error) {
			if (error instanceof SyncError) {
				return c.json({ 
					error: error.message, 
					code: error.code,
					context: error.context 
				}, 400);
			}
			console.error('Unexpected error in DataMigrate:', error);
			return c.json({ error: "Internal server error" }, 500);
		}
	}
}

export class MigrationStatus extends OpenAPIRoute {
	schema = {
		tags: ["Admin"],
		summary: "Get migration status",
		responses: {
			"200": {
				description: "Migration status",
				content: {
					"application/json": {
						schema: z.object({
							isMigrated: z.boolean(),
							hasBackup: z.boolean(),
							oldDataExists: z.boolean()
						}),
					},
				},
			},
		},
	};

	async handle(c: any) {
		try {
			const adminKey = c.req.header("X-Admin-Key");
			if (adminKey !== c.env.ADMIN_KEY) {
				return c.json({ error: "Unauthorized" }, 401);
			}

			const migration = new DataMigration(c.env.KV);
			const status = await migration.getMigrationStatus();
			
			return c.json(status);
		} catch (error) {
			console.error('Unexpected error in MigrationStatus:', error);
			return c.json({ error: "Internal server error" }, 500);
		}
	}
}

export class RollbackMigration extends OpenAPIRoute {
	schema = {
		tags: ["Admin"],
		summary: "Rollback migration to array-based storage",
		responses: {
			"200": {
				description: "Rollback completed",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							message: z.string()
						}),
					},
				},
			},
		},
	};

	async handle(c: any) {
		try {
			const adminKey = c.req.header("X-Admin-Key");
			if (adminKey !== c.env.ADMIN_KEY) {
				return c.json({ error: "Unauthorized" }, 401);
			}

			const migration = new DataMigration(c.env.KV);
			const result = await migration.rollbackMigration();
			
			return c.json(result);
		} catch (error) {
			console.error('Unexpected error in RollbackMigration:', error);
			return c.json({ error: "Internal server error" }, 500);
		}
	}
}