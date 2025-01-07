class UserService {

	db: KVNamespace;

	constructor(_db: KVNamespace) {
		this.db = _db;
	}

	async query(syncToken: string): Promise<User | null> {
		let users = await this.db.get("tabby-users");
		console.log(users)
		if (users === null) return null;

		let all: User[] = JSON.parse(users);

		for (let user of all) {
			if (user.config_sync_token === syncToken) return user;
		}

		return null;
	}


}


// {"id":1,"username":"WayneCommand","active_config":4,"custom_connection_gateway":null,"custom_connection_gateway_token":null,"config_sync_token":"1234567890abcde","is_pro":true,"is_sponsor":false,"github_username":"WayneCommand"}
type User = {
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
