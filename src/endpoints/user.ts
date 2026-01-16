import {OpenAPIRoute} from "chanfana";
import {z} from "zod";

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

export class GetUser extends OpenAPIRoute {
	schema = {
		tags: ["User"],
		summary: "Get current user info",
		responses: {
			"200": {
				description: "Successful response",
				content: {
					"application/json": {
						schema: UserSchema,
					},
				},
			},
			"401": {
				description: "Unauthorized",
			},
			"404": {
				description: "User not found",
			}
		},
	};

	async handle(c: any) {
		const authHeader = c.req.header("Authorization");
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return c.json({ status: "Unauthorized" }, 401);
		}
		const token = authHeader.substring(7);

		const userService = new UserService(c.env.TABBY_STORE);
		const user = await userService.query(token);

		if (user) {
			return c.json(user);
		} else {
			return c.json({ status: "not found" }, 404);
		}
	}
}


// {"id":1,"username":"WayneCommand","active_config":4,"custom_connection_gateway":null,"custom_connection_gateway_token":null,"config_sync_token":"1234567890abcde","is_pro":true,"is_sponsor":false,"github_username":"WayneCommand"}
export type User = z.infer<typeof UserSchema>;

export {
	UserService
}
