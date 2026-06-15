import {OpenAPIRoute} from "chanfana";
import {z} from "zod";
import {ConfigService, ConfigSchema, Config} from "../service/config";
import { SyncError } from "../service/store";
import { getUserId } from "../auth/auth";

export class ListConfigs extends OpenAPIRoute {
	schema = {
		tags: ["Config"],
		summary: "List configurations for current user",
		responses: {
			"200": {
				description: "Successful response",
				content: {
					"application/json": {
						schema: z.array(ConfigSchema),
					},
				},
			},
			"401": { description: "Unauthorized" },
		},
	};

	async handle(c: any) {
		try {
			const uid = getUserId(c);
			if (uid === null) return c.json({ status: "Unauthorized" }, 401);

			const configService = new ConfigService(c.env.KV);
			const configs = await configService.findByUser(uid);
			return c.json(configs);
		} catch (error) {
			if (error instanceof SyncError) {
				return c.json({ 
					error: error.message, 
					code: error.code,
					context: error.context 
				}, 400);
			}
			console.error('Unexpected error in ListConfigs:', error);
			return c.json({ error: "Internal server error" }, 500);
		}
	}
}

export class CreateConfig extends OpenAPIRoute {
	schema = {
		tags: ["Config"],
		summary: "Create a new configuration",
		request: {
			body: {
				content: {
					"application/json": {
						schema: ConfigSchema.omit({ id: true, created_at: true, modified_at: true, user: true }).extend({
							name: z.string().min(1).max(100).describe("Configuration name"),
							content: z.string().optional().describe("Configuration content as JSON string"),
							last_used_with_version: z.string().optional().describe("Tabby version last used with this config")
						}),
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Successful response",
				content: {
					"application/json": {
						schema: ConfigSchema,
					},
				},
			},
			"401": { description: "Unauthorized" },
		},
	};

	async handle(c: any) {
		try {
			const uid = getUserId(c);
			if (uid === null) return c.json({ status: "Unauthorized" }, 401);

			const body = await c.req.json();
			const configService = new ConfigService(c.env.KV);
			const config = await configService.create(body, uid);
			return c.json(config);
		} catch (error) {
			if (error instanceof SyncError) {
				return c.json({ 
					error: error.message, 
					code: error.code,
					context: error.context 
				}, 400);
			}
			console.error('Unexpected error in CreateConfig:', error);
			return c.json({ error: "Internal server error" }, 500);
		}
	}
}

export class GetConfig extends OpenAPIRoute {
	schema = {
		tags: ["Config"],
		summary: "Get configuration by ID",
		request: {
			params: z.object({
				id: z.string().regex(/^\d+$/, "Config ID must be a number").describe("Config ID"),
			}),
		},
		responses: {
			"200": {
				description: "Successful response",
				content: {
					"application/json": {
						schema: ConfigSchema,
					},
				},
			},
			"401": { description: "Unauthorized" },
			"404": { description: "Not found" },
		},
	};

	async handle(c: any) {
		try {
			const uid = getUserId(c);
			if (uid === null) return c.json({ status: "Unauthorized" }, 401);

			const { id } = c.req.valid("param");
			const configService = new ConfigService(c.env.KV);
			const conf = await configService.findById(parseInt(id));
			
			if (conf) {
				if (conf.user !== uid) {
					return c.json({ status: "Unauthorized" }, 401);
				}
				return c.json(conf);
			}
			return c.json({ status: "Not found" }, 404);
		} catch (error) {
			if (error instanceof SyncError) {
				return c.json({ 
					error: error.message, 
					code: error.code,
					context: error.context 
				}, 400);
			}
			console.error('Unexpected error in GetConfig:', error);
			return c.json({ error: "Internal server error" }, 500);
		}
	}
}

export class UpdateConfig extends OpenAPIRoute {
	schema = {
		tags: ["Config"],
		summary: "Update configuration",
		request: {
			params: z.object({
				id: z.string().describe("Config ID"),
			}),
			body: {
				content: {
					"application/json": {
						schema: ConfigSchema.partial().omit({ id: true, created_at: true, modified_at: true, user: true }).extend({
							name: z.string().min(1).max(100).optional().describe("Configuration name"),
							content: z.string().optional().describe("Configuration content as JSON string"),
							last_used_with_version: z.string().optional().describe("Tabby version last used with this config")
						}),
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Successful response",
				content: {
					"application/json": {
						schema: ConfigSchema,
					},
				},
			},
			"401": { description: "Unauthorized" },
			"404": { description: "Not found" },
		},
	};

	async handle(c: any) {
		try {
			const uid = getUserId(c);
			if (uid === null) return c.json({ status: "Unauthorized" }, 401);

			const { id } = c.req.valid("param");
			const body = await c.req.json();
			
			const configService = new ConfigService(c.env.KV);
			
			// First check if config exists and belongs to user
			const existingConfig = await configService.findById(parseInt(id));
			if (!existingConfig) {
				return c.json({ status: "Not found" }, 404);
			}
			if (existingConfig.user !== uid) {
				return c.json({ status: "Unauthorized" }, 401);
			}
			
			const conf = await configService.update(parseInt(id), body);
			if (conf) {
				return c.json(conf);
			}
			return c.json({ status: "Not found" }, 404);
		} catch (error) {
			if (error instanceof SyncError) {
				return c.json({ 
					error: error.message, 
					code: error.code,
					context: error.context 
				}, 400);
			}
			console.error('Unexpected error in UpdateConfig:', error);
			return c.json({ error: "Internal server error" }, 500);
		}
	}
}

export class DeleteConfig extends OpenAPIRoute {
	schema = {
		tags: ["Config"],
		summary: "Delete configuration",
		request: {
			params: z.object({
				id: z.string().regex(/^\d+$/, "Config ID must be a number").describe("Config ID"),
			}),
		},
		responses: {
			"200": {
				description: "Successful response",
				content: {
					"application/json": {
						schema: z.null(),
					},
				},
			},
			"401": { description: "Unauthorized" },
			"404": { description: "Not found" },
		},
	};

	async handle(c: any) {
		try {
			const uid = getUserId(c);
			if (uid === null) return c.json({ status: "Unauthorized" }, 401);

			const { id } = c.req.valid("param");
			const configService = new ConfigService(c.env.KV);
			
			// First check if config exists and belongs to user
			const existingConfig = await configService.findById(parseInt(id));
			if (!existingConfig) {
				return c.json({ status: "Not found" }, 404);
			}
			if (existingConfig.user !== uid) {
				return c.json({ status: "Unauthorized" }, 401);
			}
			
			await configService.delete(parseInt(id));
			return c.json(null);
		} catch (error) {
			if (error instanceof SyncError) {
				return c.json({ 
					error: error.message, 
					code: error.code,
					context: error.context 
				}, 400);
			}
			console.error('Unexpected error in DeleteConfig:', error);
			return c.json({ error: "Internal server error" }, 500);
		}
	}
}

export { Config }
