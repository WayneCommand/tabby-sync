import { fromHono } from "chanfana";
import { Hono } from "hono";

import {GetUser} from "./endpoints/user";
import {CreateConfig, DeleteConfig, GetConfig, ListConfigs, UpdateConfig} from "./endpoints/config";
import {GetVersion} from "./endpoints/version";
import {GithubAuthComplete, GithubAuthRequest} from "./endpoints/github";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();

// Setup OpenAPI registry
const openapi = fromHono(app, {
	docs_url: "/openapi-doc",
});

// static assets
openapi.get("/secure", (c) => c.env.ASSETS.fetch(new Request(new URL('/secure.html', c.req.url).toString())));

// OpenAPI routes
openapi.get("/api/1/users", GetUser);

openapi.get("/api/1/configs", ListConfigs);
openapi.post("/api/1/configs", CreateConfig);
openapi.get("/api/1/configs/:id", GetConfig);
openapi.patch("/api/1/configs/:id", UpdateConfig);
openapi.delete("/api/1/configs/:id", DeleteConfig);

openapi.get("/api/1/version", GetVersion);

openapi.get("/gh/auth/request", GithubAuthRequest);
openapi.get("/gh/auth/complete", GithubAuthComplete);

export default app;