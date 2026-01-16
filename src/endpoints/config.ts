import {OpenAPIRoute} from "chanfana";
import {z} from "zod";
import {UserService} from "./user";

class ConfigService {

	db: KVNamespace;

	constructor(_db: KVNamespace) {
		this.db = _db;
	}

	async queryByUser(userId: number): Promise<Config[]> {
		let userConfigs: Config[] = []

		let configs = await this.db.get("tabby-configs");
		if (configs === null) return userConfigs;

		let all: Config[] = JSON.parse(configs);

		for (let config of all)
			if (config.user === userId)
				userConfigs.push(config);

		return userConfigs;
	}

	async queryById(id: number): Promise<Config | null> {
		let configs = await this.db.get("tabby-configs");
		if (configs === null) return null;

		let all: Config[] = JSON.parse(configs);
		for (let config of all){
			if (config.id === id){
				return config;
			}
		}

		return null;
	}

	async addConfig(config: Config, user: number): Promise<Config> {
		let all: Config[] = [];

		let configs = await this.db.get("tabby-configs");
		if (configs) {
			all = JSON.parse(configs);
		}

		config.id = nextId(all)
		config.content = "{}"
		config.created_at = new Date().toISOString()
		config.modified_at = new Date().toISOString()
		config.user = user

		all.push(config);

		await this.db.put("tabby-configs", JSON.stringify(all));

		return config;
	}

	async updateConfig(config: Config, id: number): Promise<Config | null> {
		let entity: Config | null = null;

		// 获取全部配置
		let configs = await this.db.get("tabby-configs");
		if (configs === null) return null; // not possible
		let all: Config[] = JSON.parse(configs);

		// 找到要更新的配置
		for (let _config of all) {
			if (_config.id === id) {
				// 只更新这三个字段
				_config.content = config.content
				_config.last_used_with_version = config.last_used_with_version
				_config.modified_at = new Date().toISOString()
				entity = _config;
			}
		}

		// 更新
		await this.db.put("tabby-configs", JSON.stringify(all));

		// 返回更新好的数据
		return entity;
	}

	async deleteConfig(id: number): Promise<null> {
		// 获取全部配置
		let configs = await this.db.get("tabby-configs");
		if (configs === null) return null; // not possible
		let all: Config[] = JSON.parse(configs);

		// 过滤掉这个 id， 然后再保存
		all = all.filter(config => config.id !== id);

		await this.db.put("tabby-configs", JSON.stringify(all));

		return null;
	}

}

function nextId(configs: Config[]): number {
	let maxId = 0;

	for (let config of configs) {
		if (config.id > maxId)
			maxId = config.id;
	}

	return maxId + 1;
}

export const ConfigSchema = z.object({
	id: z.number(),
	name: z.string(),
	content: z.string(),
	last_used_with_version: z.string(),
	created_at: z.string(),
	modified_at: z.string(),
	user: z.number()
});

async function getUserId(c: any) {
	const authHeader = c.req.header("Authorization");
	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return null;
	}
	const token = authHeader.substring(7);
	const userService = new UserService(c.env.TABBY_STORE);
	const user = await userService.query(token);
	return user ? user.id : null;
}

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
		const uid = await getUserId(c);
		if (uid === null) return c.json({ status: "Unauthorized" }, 401);

		const configService = new ConfigService(c.env.TABBY_STORE);
		const configs = await configService.queryByUser(uid);
		return c.json(configs);
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
						schema: ConfigSchema.omit({ id: true, created_at: true, modified_at: true, user: true }),
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
		const uid = await getUserId(c);
		if (uid === null) return c.json({ status: "Unauthorized" }, 401);

		const body = await c.req.json();
		const configService = new ConfigService(c.env.TABBY_STORE);
		const config = await configService.addConfig(body, uid);
		return c.json(config);
	}
}

export class GetConfig extends OpenAPIRoute {
	schema = {
		tags: ["Config"],
		summary: "Get configuration by ID",
		request: {
			params: z.object({
				id: z.string().describe("Config ID"),
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
		const uid = await getUserId(c);
		if (uid === null) return c.json({ status: "Unauthorized" }, 401);

		const { id } = c.req.valid("param");
		const configService = new ConfigService(c.env.TABBY_STORE);
		const conf = await configService.queryById(parseInt(id));
		if (conf) {
			return c.json(conf);
		}
		return c.json({ status: "Not found" }, 404);
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
						schema: ConfigSchema.partial().omit({ id: true, created_at: true, modified_at: true, user: true }),
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
		const uid = await getUserId(c);
		if (uid === null) return c.json({ status: "Unauthorized" }, 401);

		const { id } = c.req.valid("param");
		const body = await c.req.json();
		const configService = new ConfigService(c.env.TABBY_STORE);
		const conf = await configService.updateConfig(body, parseInt(id));
		if (conf) {
			return c.json(conf);
		}
		return c.json({ status: "Not found" }, 404);
	}
}

export class DeleteConfig extends OpenAPIRoute {
	schema = {
		tags: ["Config"],
		summary: "Delete configuration",
		request: {
			params: z.object({
				id: z.string().describe("Config ID"),
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
		const uid = await getUserId(c);
		if (uid === null) return c.json({ status: "Unauthorized" }, 401);

		const { id } = c.req.valid("param");
		const configService = new ConfigService(c.env.TABBY_STORE);
		await configService.deleteConfig(parseInt(id));
		return c.json(null);
	}
}

// {
//     "id": 5,
//     "name": "Windows11",
//     "content": "",
//     "last_used_with_version": "1.0.189",
//     "created_at": "2024-03-23T13:33:55.181686Z",
//     "modified_at": "2024-03-23T14:46:08.604372Z",
//     "user": 1
//   }
export type Config = z.infer<typeof ConfigSchema>;

export {
	ConfigService
}
