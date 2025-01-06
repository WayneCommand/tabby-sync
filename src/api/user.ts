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


// {"id":1,"username":"WayneCommand","active_config":4,"custom_connection_gateway":null,"custom_connection_gateway_token":null,"config_sync_token":"823c2fdf88c85ffac6e0620eb3a5e45f6142782ed574004cf22968ddd9db70c030b63b7c72aa7a0f6f1f407992974784e91811e4e84da805829d7446622ec49a","is_pro":true,"is_sponsor":false,"github_username":"WayneCommand"}
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
