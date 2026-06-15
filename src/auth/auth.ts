import { Context, Next } from "hono";
import { UserService } from "../service/user";

export interface AuthContext {
	uid: number | null;
	user: any | null;
	isAuthenticated: boolean;
}

declare module "hono" {
	interface ContextVariableMap {
		auth: AuthContext;
	}
}

export async function authenticateRequest(c: Context, userService: UserService, next: Next): Promise<void> {
	const authHeader = c.req.header("Authorization");
	let authContext: AuthContext = {
		uid: null,
		user: null,
		isAuthenticated: false
	};

	if (authHeader && authHeader.startsWith("Bearer ")) {
		try {
			const token = authHeader.substring(7);
			const user = await userService.findByToken(token);
			if (user) {
				authContext = {
					uid: user.id,
					user: user,
					isAuthenticated: true
				};
			}
		} catch (error) {
			console.error('Authentication error:', error);
		}
	}

	c.set('auth', authContext);
	await next();
}

export function getUserId(c: Context): number | null {
	const auth = c.get('auth');
	return auth ? auth.uid : null;
}

export function getCurrentUser(c: Context): any | null {
	const auth = c.get('auth');
	return auth ? auth.user : null;
}