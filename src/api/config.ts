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
type Config = {
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
