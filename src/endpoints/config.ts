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


// {
//     "id": 5,
//     "name": "Windows11",
//     "content": "",
//     "last_used_with_version": "1.0.189",
//     "created_at": "2024-03-23T13:33:55.181686Z",
//     "modified_at": "2024-03-23T14:46:08.604372Z",
//     "user": 1
//   }
export type Config = {
	id: number,
	name: string,
	content: string,
	last_used_with_version: string,
	created_at: string,
	modified_at: string,
	user: number
}

export {
	ConfigService
}
