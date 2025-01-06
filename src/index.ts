/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
import {UserService} from "./api/user";
import {ConfigService} from "./api/config";

export default {
	async fetch(request, env, ctx): Promise<Response> {

		const url = new URL(request.url);
		const method = request.method;

		const authInfo = auth(request.headers.get("Authorization"));

		const db = env.TABBY_STORE;

		const userService = new UserService(db);
		const configService = new ConfigService(db);

		// router
		switch (url.pathname) {
			case "/api/1/user":{
				if (authInfo === null) return unauthorized();
				switch (method) {
					case "GET": {
						let user = await userService.query(authInfo);
						if (user != null) {
							return Response.json(user);
						}else {
							return Response.json({"status": "not found"}, {status: 404});
						}
					}
					default: {
						return methodNotAllowed();
					}
				}
			}
			case "/api/1/configs": {
				if (authInfo === null) return unauthorized();
				let uid = await u(userService, authInfo);

				switch (method) {
					case "GET": {
						let configs = await configService.queryByUser(uid);
						return Response.json(configs);
					}
					default: {
						return methodNotAllowed();
					}
				}
			}
			case "/api/1/versions":{
				return Response.json(
					[
						{
							"version": "1.0.163",
							"plugins": [
								"tmp16r9agmk"
							]
						}
					]
				);
			}
			default:
				return Response.json({"status": "ok."})
		}
	},
} satisfies ExportedHandler<Env>;


function auth(authorization: string | null): string | null {
	if (authorization === null) return null;
	if (authorization.startsWith("Bearer ")) {
		return authorization.substring(7);
	}
	return null
}

async function u(userService: UserService, token: string): Promise<number> {
	let user = await userService.query(token);
	if (user === null) return -1;
	return user.id;
}

function unauthorized(): Response {
	return Response.json({"status": "Unauthorized"}, {status: 401});
}

function methodNotAllowed(): Response {
	return Response.json({"status": "Method not allowed"}, {status: 405});
}
