import type { McpServer } from "@modelcontextprotocol/server";
import { ResourceTemplate } from "@modelcontextprotocol/server";
import { FORGE_IDS, FORGES } from "./config";
import type { NormalizedRoute } from "./spec";
import { getAllSpecs, getSpec } from "./spec";

function getVar(variables: Record<string, string | string[]>, key: string): string {
	const val = variables[key];
	if (Array.isArray(val)) return val[0] ?? "";
	return val ?? "";
}

export function registerResources(server: McpServer): void {
	server.registerResource(
		"list_gitforges",
		"gitforge://gitforges",
		{
			title: "Git Forge documentation",
			description: "All supported git hosting forges with metadata.",
			mimeType: "application/json",
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
				contents: [
					{
						uri: "gitforge://gitforges",
						text: JSON.stringify({ forges }, null, 2),
						mimeType: "application/json",
					},
				],
			};
		},
	);

	server.registerResource(
		"forge-routes",
		new ResourceTemplate("gitforge://{forge}/routes", {
			list: async () => {
				const specs = await getAllSpecs();
				return {
					resources: specs.map((s) => ({
						uri: `gitforge://${s.forge}/routes`,
						name: `${s.forgeName} — All Routes`,
						mimeType: "application/json",
						description: `${s.routes.length} API routes`,
					})),
				};
			},
			complete: {
				forge: async (value: string) =>
					FORGE_IDS.filter((id) => id.startsWith(value)),
			},
		}),
		{
			title: "Forge Routes",
			description: "All API routes for a specific git forge.",
			mimeType: "application/json",
		},
		async (uri, variables) => {
			const spec = await getSpec(getVar(variables, "forge"));
			const routes = spec.routes.map((r) => ({
				method: r.method,
				path: r.path,
				operationId: r.operationId,
				summary: r.summary,
				tags: r.tags,
				deprecated: r.deprecated,
			}));

			return {
				contents: [
					{
						uri: uri.href,
						text: JSON.stringify(
							{
								forge: spec.forge,
								forgeName: spec.forgeName,
								title: spec.title,
								version: spec.version,
								totalRoutes: routes.length,
								routes,
							},
							null,
							2,
						),
						mimeType: "application/json",
					},
				],
			};
		},
	);

	server.registerResource(
		"forge-tags",
		new ResourceTemplate("gitforge://{forge}/tags", {
			list: async () => {
				const specs = await getAllSpecs();
				return {
					resources: specs.map((s) => ({
						uri: `gitforge://${s.forge}/tags`,
						name: `${s.forgeName} — API Tags`,
						mimeType: "application/json",
						description: `${s.tags.length} API tags`,
					})),
				};
			},
			complete: {
				forge: async (value: string) =>
					FORGE_IDS.filter((id) => id.startsWith(value)),
			},
		}),
		{
			title: "Forge Tags",
			description: "All API tags (resource groups) for a specific git forge.",
			mimeType: "application/json",
		},
		async (uri, variables) => {
			const spec = await getSpec(getVar(variables, "forge"));
			const tagDetails = spec.tags.map((tag) => {
				const routesWithTag = spec.routes.filter((r) => r.tags?.includes(tag));
				return {
					tag,
					routeCount: routesWithTag.length,
					methods: Array.from(new Set(routesWithTag.map((r) => r.method))).sort(),
				};
			});

			return {
				contents: [
					{
						uri: uri.href,
						text: JSON.stringify(
							{
								forge: spec.forge,
								forgeName: spec.forgeName,
								totalTags: spec.tags.length,
								tags: tagDetails,
							},
							null,
							2,
						),
						mimeType: "application/json",
					},
				],
			};
		},
	);

	server.registerResource(
		"route-detail",
		new ResourceTemplate("gitforge://{forge}/route/{+operationId}", {
			list: async () => {
				const specs = await getAllSpecs();
				const resources: { uri: string; name: string; mimeType: string; description: string }[] = [];
				for (const spec of specs) {
					for (const route of spec.routes) {
						resources.push({
							uri: `gitforge://${spec.forge}/route/${route.operationId}`,
							name: route.operationId,
							mimeType: "application/json",
							description: `${route.method} ${route.path}`,
						});
					}
				}
				return { resources };
			},
			complete: {
				forge: async (value: string) => FORGE_IDS.filter((id) => id.startsWith(value)),
				operationId: async (value: string, ctx) => {
					const forge = ctx?.arguments?.forge;
					if (!forge || typeof forge !== "string") return [];
					try {
						const spec = await getSpec(forge);
						return spec.routes.map((r) => r.operationId).filter((id) => id.startsWith(value));
					} catch {
						return [];
					}
				},
			},
		}),
		{
			title: "Route Details",
			description: "Detailed information about a specific API route.",
			mimeType: "application/json",
		},
		async (uri, variables) => {
			const forge = getVar(variables, "forge");
			const operationId = getVar(variables, "operationId");

			if (!operationId) {
				throw new Error("Missing required variable: operationId");
			}

			const spec = await getSpec(forge);
			const route = spec.routes.find((r) => r.operationId === operationId) as NormalizedRoute | undefined;

			if (!route) {
				throw new Error(`Route not found in ${spec.forgeName}: operationId="${operationId}"`);
			}

			return {
				contents: [
					{
						uri: uri.href,
						text: JSON.stringify(route, null, 2),
						mimeType: "application/json",
					},
				],
			};
		},
	);

	server.registerResource(
		"forge-spec",
		new ResourceTemplate("gitforge://{forge}/spec", {
			list: async () => {
				const specs = await getAllSpecs();
				return {
					resources: specs.map((s) => ({
						uri: `gitforge://${s.forge}/spec`,
						name: `${s.forgeName} — Full Spec`,
						mimeType: "application/json",
						description: `${s.title} v${s.version}`,
					})),
				};
			},
			complete: {
				forge: async (value: string) => FORGE_IDS.filter((id) => id.startsWith(value)),
			},
		}),
		{
			title: "Forge Spec",
			description: "The full normalized API specification for a specific git forge.",
			mimeType: "application/json",
		},
		async (uri, variables) => {
			const spec = await getSpec(getVar(variables, "forge"));
			return {
				contents: [
					{
						uri: uri.href,
						text: JSON.stringify(spec, null, 2),
						mimeType: "application/json",
					},
				],
			};
		},
	);
}
