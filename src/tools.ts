import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { FORGE_IDS, FORGES, FORGE_IDS_TUPLE } from "./config";
import type { NormalizedRoute } from "./spec";
import { getAllSpecs, getSpec } from "./spec";

const FORGE_SEARCH_OPTIONS = [...FORGE_IDS_TUPLE, "all"] as const;

export function registerTools(server: McpServer): void {
	server.registerTool(
		"list_gitforges",
		{
			title: "List Git Forges",
			description: "List all supported git forges and their metadata.",
			annotations: { readOnlyHint: true, openWorldHint: false },
		},
		async () => {
			const forges = FORGE_IDS.map((id) => {
				const f = FORGES[id];
				return {
					id: f.id,
					name: f.name,
					description: f.description,
					docsUrl: f.docsUrl,
					authMethods: f.authMethods,
					specFormat: f.spec.format,
				};
			});

			return {
				content: [{ type: "text", text: JSON.stringify(forges, null, 2) }],
				structuredContent: { forges },
			};
		},
	);

	server.registerTool(
		"list_routes",
		{
			title: "List API Routes",
			description: "List API routes/endpoints for a specific git forge.",
			annotations: { readOnlyHint: true, openWorldHint: true },
			inputSchema: z.object({
				forge: z.enum([...FORGE_IDS_TUPLE]).describe("Which git forge to query"),
				method: z
					.enum([
						"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "QUERY", "MUTATION", "all",
					] as const)
					.optional()
					.describe("Filter by HTTP method or GraphQL operation type"),
				tag: z.string().optional().describe("Filter by API tag (e.g., 'repos', 'issues')"),
				deprecated: z.boolean().optional().describe("Filter deprecated routes"),
				limit: z.number().int().min(1).max(500).optional().describe("Max routes to return (default 100)"),
			}),
		},
		async (args) => {
			try {
				const spec = await getSpec(args.forge);
				let routes = spec.routes;

				if (args.method && args.method !== "all") {
					routes = routes.filter((r) => r.method === args.method);
				}
				if (args.tag) {
					const tagLower = args.tag.toLowerCase();
					routes = routes.filter((r) => r.tags?.some((t) => t.toLowerCase().includes(tagLower)) ?? false);
				}
				if (args.deprecated !== undefined) {
					routes = routes.filter((r) => (args.deprecated ? r.deprecated : !r.deprecated));
				}

				const total = routes.length;
				const limit = args.limit ?? 100;
				const slice = routes.slice(0, limit);

				const summary = slice.map((r) => ({
					method: r.method,
					path: r.path,
					operationId: r.operationId,
					summary: r.summary ?? r.description,
					tags: r.tags,
					deprecated: r.deprecated,
				}));

				return {
					content: [
						{
							type: "text",
							text: `${spec.forgeName} (${spec.title}) — ${total} routes total, showing ${slice.length}.\n${JSON.stringify(summary, null, 2)}`,
						},
					],
					structuredContent: { forge: spec.forgeName, total, shown: slice.length, routes: summary },
				};
			} catch (error) {
				return {
					content: [{ type: "text", text: `Error listing routes for ${args.forge}: ${error}` }],
					isError: true,
				};
			}
		},
	);

	server.registerTool(
		"search_routes",
		{
			title: "Search API Routes",
			description: "Search for API routes across one or all git forges by path, operationId, summary, or tag.",
			annotations: { readOnlyHint: true, openWorldHint: true },
			inputSchema: z.object({
				query: z.string().describe("Search term to match against path, operationId, summary, or tags"),
				forge: z.enum([...FORGE_SEARCH_OPTIONS]).optional().default("all").describe("Which forge to search (default: all)"),
				limitPerForge: z.number().int().min(1).max(50).optional().default(20).describe("Max results per forge"),
			}),
		},
		async (args) => {
			try {
				const queryLower = args.query.toLowerCase();
				const forgesToSearch: string[] = args.forge === "all" ? [...FORGE_IDS] : [args.forge];
				const allSpecs = await getAllSpecs();
				const matchingSpecs = allSpecs.filter((s) => forgesToSearch.includes(s.forge));

				const resultsByForge: Record<string, unknown[]> = {};
				const limit = args.limitPerForge ?? 20;

				for (const spec of matchingSpecs) {
					const matches = spec.routes.filter((r) => {
						const text = `${r.path} ${r.operationId} ${r.summary ?? ""} ${r.description ?? ""} ${r.tags?.join(" ") ?? ""}`.toLowerCase();
						return text.includes(queryLower);
					});

					if (matches.length > 0) {
						resultsByForge[spec.forge] = matches.slice(0, limit).map((r) => ({
							method: r.method,
							path: r.path,
							operationId: r.operationId,
							summary: r.summary ?? r.description,
							tags: r.tags,
							deprecated: r.deprecated,
						}));
					}
				}

				const totalResults = Object.values(resultsByForge).reduce((sum, arr) => sum + arr.length, 0);

				return {
					content: [
						{
							type: "text",
							text: `Found ${totalResults} matching routes across ${Object.keys(resultsByForge).length} forges.\n${JSON.stringify(resultsByForge, null, 2)}`,
						},
					],
					structuredContent: { query: args.query, forgesSearched: forgesToSearch, totalResults, resultsByForge },
				};
			} catch (error) {
				return {
					content: [{ type: "text", text: `Error searching routes: ${error}` }],
					isError: true,
				};
			}
		},
	);

	server.registerTool(
		"get_route",
		{
			title: "Get Route Details",
			description: "Get detailed information about a specific API route, including parameters, request body, and response schemas.",
			annotations: { readOnlyHint: true, openWorldHint: false },
			inputSchema: z.object({
				forge: z.enum([...FORGE_IDS_TUPLE]).describe("Which git forge"),
				operationId: z.string().optional().describe("The operationId of the route (e.g., 'repos/get')"),
				path: z.string().optional().describe("Alternative: the path. If provided, path takes precedence."),
			}),
		},
		async (args) => {
			try {
				if (!args.operationId && !args.path) {
					return {
						content: [{ type: "text", text: "Either operationId or path is required for get_route." }],
						isError: true,
					};
				}

				const spec = await getSpec(args.forge);
				let route: NormalizedRoute | undefined;

				if (args.path) {
					const pathLower = args.path.toLowerCase();
					route = spec.routes.find((r) => r.path === args.path || r.path.toLowerCase() === pathLower);
				}

				if (!route) {
					route = spec.routes.find((r) => r.operationId === args.operationId);
				}

				if (!route) {
					const opText = args.operationId ? `operationId="${args.operationId}"` : "the given path";
					const pathText = args.path ? ` or path="${args.path}"` : "";
					return {
						content: [
							{
								type: "text",
								text: `No route found in ${spec.forgeName} matching ${opText}${pathText}`,
							},
						],
						isError: true,
					};
				}

				return {
					content: [{ type: "text", text: JSON.stringify(route, null, 2) }],
					structuredContent: { route },
				};
			} catch (error) {
				return {
					content: [{ type: "text", text: `Error getting route: ${error}` }],
					isError: true,
				};
			}
		},
	);

	server.registerTool(
		"list_tags",
		{
			title: "List API Tags",
			description: "List all API tags (resource groups) for a specific git forge.",
			annotations: { readOnlyHint: true, openWorldHint: false },
			inputSchema: z.object({
				forge: z.enum([...FORGE_IDS_TUPLE]).describe("Which git forge"),
			}),
		},
		async (args) => {
			try {
				const spec = await getSpec(args.forge);
				const tagDetails = spec.tags.map((tag) => {
					const routesWithTag = spec.routes.filter((r) => r.tags?.includes(tag));
					return {
						tag,
						routeCount: routesWithTag.length,
						methods: Array.from(new Set(routesWithTag.map((r) => r.method))).sort(),
					};
				});

				return {
					content: [
						{
							type: "text",
							text: `${spec.forgeName} has ${spec.tags.length} tags:\n${JSON.stringify(tagDetails, null, 2)}`,
						},
					],
					structuredContent: { forge: spec.forgeName, tags: tagDetails },
				};
			} catch (error) {
				return {
					content: [{ type: "text", text: `Error listing tags for ${args.forge}: ${error}` }],
					isError: true,
				};
			}
		},
	);
}
