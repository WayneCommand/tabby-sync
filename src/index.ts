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
import {UserService, User} from "./api/user";
import {GithubService} from "./api/github";
import {ConfigService, Config} from "./api/config";


export default {

	async fetch(request, env, ctx): Promise<Response> {

		const url = new URL(request.url);
		const method = request.method;
		const authInfo = auth(request.headers.get("Authorization"));

		const db = env.TABBY_STORE;
		const userService = new UserService(db);
		const configService = new ConfigService(db);
		const githubService = new GithubService(db, env.GH_CLIENT_ID, env.GH_CLIENT_SECRET);

		const user_api = new URLPattern({pathname: "/api/1/users"});
		if (user_api.test(url)) {
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

		const config_api = new URLPattern({pathname: "/api/1/configs"});
		const config_value_api = new URLPattern({pathname: "/api/1/configs/:id"});
		if (config_api.test(url)) {
			if (authInfo === null) return unauthorized();
			let uid = await u(userService, authInfo);

			switch (method) {
				case "GET": {
					let configs = await configService.queryByUser(uid);
					return Response.json(configs);
				}
				case "POST": {
					let body: Config = await request.json();
					let config = await configService.addConfig(body, uid);
					return Response.json(config);
				}
				default: {
					return methodNotAllowed();
				}
			}
		}
		if (config_value_api.test(url)) {
			if (authInfo === null) return unauthorized();
			let uid = await u(userService, authInfo);

			switch (method) {
				case "GET": {
					let pathParam = config_value_api.exec(url)
						?.pathname.groups;

					console.log(pathParam)


					if (pathParam) {
						let conf = await configService.queryById(parseInt(pathParam.id));
						return Response.json(conf);
					}

					return notFound();
				}
				case "PATCH": {
					let pathParam = config_value_api.exec(url)
						?.pathname.groups;

					if (pathParam) {
						let body: Config = await request.json();
						let conf = await configService.updateConfig(body, parseInt(pathParam.id));

						// 再更改一下 last active config
						return Response.json(conf);
					}

					return notFound();
				}
				case "DELETE": {
					let pathParam = config_value_api.exec(url)
						?.pathname.groups;

					if (pathParam) {
						await configService.deleteConfig(parseInt(pathParam.id));

						// 再更改一下 last active config
						return Response.json(null);
					}

					return notFound();
				}
				default: {
					return methodNotAllowed();
				}
			}
		}

		const version_api = new URLPattern({pathname: "/api/1/version"});
		if (version_api.test(url)) {
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

		// GitHub 同意屏幕认证请求
		const github_request_api = new URLPattern({pathname: "/gh/auth/request"});
		if (github_request_api.test(url)) {
			switch (method) {
				case "GET": {
					const authUrl = await githubService.generateAuthUrl()
					return Response.json({authUrl})
				}
				default: {
					return methodNotAllowed();
				}
			}
		}

		// GitHub 认证完成的回调
		const github_complete_api = new URLPattern({pathname: "/gh/auth/complete"});
		if (github_complete_api.test(url)) {
			switch (method) {
				case "GET": {
					// 拿到 Code 之后，立刻去获取 token，Code的时效非常短且只能使用一次
					let code = await githubService.verifyCode(url)
					console.log("github complete code: ", code)
					if(!code) {
						return invalidRequest()
					}

					// 拿到 AccessToken 之后，保存一段时间，可以重复使用
					const token = await githubService.getToken(code)
					console.log("github complete token: ", token)
					if (!token) {
						return invalidRequest()
					}

					// 获取Github用户资料
					const user_gh = await githubService.getUserInfo(token.access_token)
					console.log("github complete user_gh: ", user_gh)
					if (!user_gh) {
						return invalidRequest()
					}

					// 获取 UserKey，然后通过url参数redirect到完成页面，完成页面再获取用户资料，存储到 localStorage里
					const tabbyUserKey = await userKey(user_gh.node_id, env.NAMESPACE_ID)

					// 附加步骤： 检查用户，如果用户未创建，则创建用户

					if (await userService.query(tabbyUserKey) === null) {

						let _init_u: User = {
							username: user_gh.name,
							config_sync_token: tabbyUserKey,
							github_username: user_gh.name,
							id: 0, // non initialized
							active_config: 0, // non initialized
							custom_connection_gateway: "", // non initialized
							custom_connection_gateway_token: "", // non initialized
							is_pro: true, // non initialized
							is_sponsor: false // non initialized
						}

						await userService.add(_init_u)
					}
					
					return Response.redirect(`/complete.html?userKey=${tabbyUserKey}`)
				}
				default: {
					return methodNotAllowed();
				}
			}
		}


		// else
		return Response.json({"status": "ok."})
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

// 生成 UserKey, 用于提供给用户和Tabby API，该算法提供的稳定性主要取决于 namespace_id
function userKey(node_id: string, namespace_id: string): Promise<string> {
	return str2sha256(`${namespace_id}:${node_id}`);
}

async function str2sha256(str: string) {
	const encode = new TextEncoder().encode(str);
		
	const _digest = crypto.subtle.digest(
		{
			name: 'SHA-256',
		},
		encode // The data you want to hash as an ArrayBuffer
	)

	// to hex
	return buf2hex(await _digest)
}

function buf2hex(buffer: ArrayBuffer): string { // buffer is an ArrayBuffer
	return [...new Uint8Array(buffer)]
		.map(x => x.toString(16).padStart(2, '0'))
		.join('');
}

function unauthorized(): Response {
	return Response.json({"status": "Unauthorized"}, {status: 401});
}

function methodNotAllowed(): Response {
	return Response.json({"status": "Method not allowed"}, {status: 405});
}

function notFound(): Response {
	return Response.json({"status": "Not found"}, {status: 404});
}

function invalidRequest(): Response {
	return Response.json({"status": "Invalid request"}, {status: 400});
}