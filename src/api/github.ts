const redirect_uri = "https://token.grant.waynecommand.com/gh/auth/complete"

const gh_authorize_uri = 'https://github.com/login/oauth/authorize'
const gh_token_uri = 'https://github.com/login/oauth/access_token'
const gh_scope = "user"

const gh_api_uri = 'https://api.github.com'


class GithubService {

	db: KVNamespace;
    GH_CLIENT_ID: string;
    GH_CLIENT_SECRET: string;

	constructor(_db: KVNamespace, _GH_CLIENT_ID: string, _GH_CLIENT_SECRET: string) {
		this.db = _db;
		this.GH_CLIENT_ID = _GH_CLIENT_ID;
		this.GH_CLIENT_SECRET = _GH_CLIENT_SECRET;
	}


    /**
     * 生成 GitHub 授权 URL
     * @returns 
     */
    async generateAuthUrl(): Promise<string> {

        const url = new URL(gh_authorize_uri);
        const searchParams = url.searchParams;
        
        searchParams.set("client_id", this.GH_CLIENT_ID)
        searchParams.set("redirect_uri", redirect_uri)
        searchParams.set("scope", gh_scope)
        searchParams.append("state", "wayne") // custom sting
        
        return url.toString()
    }

    async verifyCode(url: URL): Promise<string> {
        const {searchParams} = url
        // if (req.method === 'GET') return Response.json({error: "method not supported."})

        let code = searchParams.get("code");
        let state = searchParams.get("state");

        if ("wayne" !== state) return Promise.reject("invalid_request")

        return code || ""
    }


    /**
     * 获取 GitHub 访问 token
     * @param code 
     * @returns 
     * {
            "access_token": "",
            "expires_in": "28800",
            "refresh_token": "",
            "refresh_token_expires_in": "15811200",
            "scope": "",
            "token_type": "bearer"
        }
     */
	async getToken(code: string): Promise<AccessToken> {

        let formData = new URLSearchParams()
        formData.set("client_id", this.GH_CLIENT_ID)
        formData.set("client_secret", this.GH_CLIENT_SECRET)
        formData.set("code", code)
        formData.set("redirect_uri", redirect_uri)
    
    
        const token = await post(gh_token_uri, formData)
    
        // default resp
        const searchParams = new URLSearchParams(await token.text());
        let tokens = Object.fromEntries(searchParams.entries())
    
        return tokens as unknown as AccessToken
    }

    /**
     * 获取用户信息
     * @param accessToken 
     * @returns 
     * {
        "login": "octocat",
        "id": 1,
        "node_id": "MDQ6VXNlcjE=",
        "avatar_url": "https://github.com/images/error/octocat_happy.gif",
        "gravatar_id": "",
        "type": "User",
        "name": "monalisa octocat",
        "email": "octocat@github.com",
        "created_at": "2008-01-14T04:33:35Z",
        "updated_at": "2008-01-14T04:33:35Z"
    }
     */
    async getUserInfo(accessToken: string): Promise<UserInfo> {
        const url = new URL(gh_api_uri + '/user')
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${accessToken}`,
                'Accept': 'application/vnd.github+json'
            }
        })
        return await response.json()
    }

}


function post(url: string, body: URLSearchParams): Promise<Response> {
    const _init = {
        // Change method
        method: "POST",
        // Change body
        body: body,
        // Change the redirect mode.
        redirect: "follow",
        // Change headers, note this method will erase existing headers
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        // Change a Cloudflare feature on the outbound response
        cf: { apps: false },
    }

    const request = new Request(url, _init)

    return fetch(request)
}


type AccessToken = {
    access_token: string,
    expires_in: number,
    refresh_token: string,
    refresh_token_expires_in: number,
    scope: string,
    token_type: string
}

type UserInfo = {
    login: string,
    id: number,
    node_id: string,
    avatar_url: string,
    gravatar_id: string,
    type: string,
    site_admin: boolean,
    name: string,
    company: string,
    email: string,
    created_at: string,
    updated_at: string
}


export {
	GithubService
}
