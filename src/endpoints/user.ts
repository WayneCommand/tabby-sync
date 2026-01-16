import {OpenAPIRoute} from "chanfana";
import {z} from "zod";
import { UserService, UserSchema, User } from "../service/user";
import { SyncError } from "../service/store";

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
			const authHeader = c.req.header("Authorization");
			if (!authHeader || !authHeader.startsWith("Bearer ")) {
				return c.json({ status: "Unauthorized" }, 401);
			}
			const token = authHeader.substring(7);

			const userService = new UserService(c.env.KV);
			const user = await userService.findByToken(token);

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
