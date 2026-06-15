import {OpenAPIRoute} from "chanfana";
import { UserSchema, User } from "../service/user";
import { SyncError } from "../service/store";
import { getCurrentUser } from "../auth/auth";

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
		try {
			const user = getCurrentUser(c);

			if (user) {
				return c.json(user);
			} else {
				return c.json({ status: "not found" }, 404);
			}
		} catch (error) {
			if (error instanceof SyncError) {
				return c.json({ 
					error: error.message, 
					code: error.code,
					context: error.context 
				}, 400);
			}
			console.error('Unexpected error in GetUser:', error);
			return c.json({ error: "Internal server error" }, 500);
		}
	}
}


export { User }
