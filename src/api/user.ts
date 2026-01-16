class UserService {

	db: KVNamespace;

	constructor(_db: KVNamespace) {
		this.db = _db;
	}

	async query(syncToken: string): Promise<User | null> {
		const users: User[] | null = await this.db.get("tabby-users", { type: "json" });
		if (users === null) return null;

		for (let user of users) {
			if (user.config_sync_token === syncToken) return user;
		}

		return null;
	}

	async add(user: User): Promise<User> {
		let users: User[] | null = await this.db.get("tabby-users", { type: "json" });

		// 如果库是空的，则初始化
		if (users === null) {
			users = [];
		}

		
		user.id = users.length + 1;
		user.is_pro = true;
		user.is_sponsor = false;

		users.push(user);
		await this.db.put("tabby-users", JSON.stringify(users));
		return user;
	}


}


// {"id":1,"username":"WayneCommand","active_config":4,"custom_connection_gateway":null,"custom_connection_gateway_token":null,"config_sync_token":"1234567890abcde","is_pro":true,"is_sponsor":false,"github_username":"WayneCommand"}
export type User = {
	id: number,
	username: string,
	active_config: number,
	custom_connection_gateway: string,
	custom_connection_gateway_token: string,
	config_sync_token: string,
	is_pro: boolean,
	is_sponsor: boolean,
	github_username: string
}

export {
	UserService
}
