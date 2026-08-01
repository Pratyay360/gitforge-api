import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { createMcpHandler } from "mcp-handler";
import { FORGE_IDS, FORGES } from "./config";
import { registerPrompts } from "./prompts";
import { registerResources } from "./resources";
import { registerTools } from "./tools";

export const app = new Hono();

const handler = createMcpHandler(
	(server) => {
		registerTools(server);
		registerResources(server);
		registerPrompts(server);
	},
	{
		serverInfo: {
			name: "gitforge-api-mcp",
			version: "1.0.0",
		},
		instructions:
			"The knowledge base for GitHub, GitLab, Forgejo, CodeBerg, Gitea, Bitbucket, SourceHut etc API endpoints and specifications. " +
			"Always use the available tools and resources to look up current API documentation rather than anything preset",
		verboseLogs: true,
	},
);

app.all("/mcp/*", async (c) => {
	return await handler(c.req.raw);
});
app.get("/", (c) => {
	return c.json({
		name: "gitforge-api-mcp",
		description:
			"MCP server exposing knowledge base for multiple git forge API documentation (GitHub, GitLab, Forgejo, CodeBerg, Gitea, Bitbucket, SourceHut) as tools, resources, and prompts.",
		endpoints: {
			mcp: "/mcp",
			tools: [
				"list_gitforges",
				"list_routes",
				"search_routes",
				"get_route",
				"list_tags",
			],
			resources: [
				"gitforge://gitforges",
				"gitforge://{forge}/routes",
				"gitforge://{forge}/tags",
				"gitforge://{forge}/route/{+operationId}",
				"gitforge://{forge}/spec",
			],
			prompts: [
				"explain_endpoint",
				"compare_endpoints",
				"auth_guide",
				"quickstart",
			],
		},
		supportedForges: FORGE_IDS.map((id) => FORGES[id].name),
	});
});


app.get(
	"/github",
	Scalar({
		url: FORGES.github.spec.url,
		proxyUrl: "https://proxy.scalar.com",
	}),
);

app.get(
	"/gitlab",
	Scalar({
		url: FORGES.gitlab.spec.url,
		proxyUrl: "https://proxy.scalar.com",
	}),
);

app.get(
	"/forgejo",
	Scalar({
		url: FORGES.forgejo.spec.url,
		proxyUrl: "https://proxy.scalar.com",
	}),
);

app.get(
	"/codeberg",
	Scalar({
		url: FORGES.codeberg.spec.url,
		proxyUrl: "https://proxy.scalar.com",
	}),
);

app.get(
	"/bitbucket",
	Scalar({
		url: FORGES.bitbucket.spec.url,
		proxyUrl: "https://proxy.scalar.com",
	}),
);

app.get(
	"/gitea",
	Scalar({
		url: FORGES.gitea.spec.url,
		proxyUrl: "https://proxy.scalar.com",
	}),
);

app.get(
	"/sourcehut",
	Scalar({
		url: FORGES.sourcehut.spec.url,
		proxyUrl: "https://proxy.scalar.com",
	}),
);

export default {
	port: 3000,
	fetch: app.fetch,
};
