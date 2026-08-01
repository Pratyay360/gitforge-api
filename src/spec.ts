import * as yaml from "js-yaml";

import { FORGE_IDS, FORGES, type ForgeConfig } from "./config";
import { parseGraphQLSchema } from "./graphql";

export type SpecFormat = "openapi" | "graphql";

export interface RouteParameter {
	name: string;
	in: "query" | "path" | "header" | "body" | "formData";
	description?: string;
	required: boolean;
	schema?: unknown;
}

export interface RouteRequestBody {
	description?: string;
	required: boolean;
	contentType?: string;
	schema?: unknown;
	example?: unknown;
}

export interface RouteResponse {
	statusCode: string;
	description?: string;
	contentType?: string;
	schema?: unknown;
}

export interface NormalizedRoute {
	forge: string;
	forgeName: string;
	path: string;
	method: string;
	operationId: string;
	summary?: string;
	description?: string;
	tags?: string[];
	deprecated?: boolean;
	parameters: RouteParameter[];
	requestBody?: RouteRequestBody;
	responses: RouteResponse[];
}

export interface NormalizedSpec {
	forge: string;
	forgeName: string;
	title: string;
	version: string;
	description?: string;
	format: SpecFormat;
	routes: NormalizedRoute[];
	tags: string[];
}

export async function getSpec(forgeId: string): Promise<NormalizedSpec> {
	const forge = FORGES[forgeId];
	if (!forge) throw new Error(`Unknown forge: ${forgeId}`);
	return loadSpec(forge);
}

export async function getAllSpecs(): Promise<NormalizedSpec[]> {
	return Promise.all(FORGE_IDS.map((id) => getSpec(id)));
}

async function loadSpec(forge: ForgeConfig): Promise<NormalizedSpec> {

	return loadRemoteSpec(forge);
}

async function loadRemoteSpec(forge: ForgeConfig): Promise<NormalizedSpec> {
	const response = await fetch(forge.spec.url);
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText} for ${forge.id}`);
	}
	const text = await response.text();

	if (forge.spec.format === "graphql") {
		return normalizeGraphQL(text, forge);
	}

	if (forge.spec.format === "openapi-json") {
		const spec = JSON.parse(text) as unknown as OpenAPISpec;
		return normalizeOpenAPI(spec, forge);
	}

	if (forge.spec.format === "openapi-yaml") {
		const spec = yaml.load(text) as unknown as OpenAPISpec;
		return normalizeOpenAPI(spec, forge);
	}

	throw new Error(`Unknown spec format: ${forge.spec.format}`);
}



interface OpenAPISpec {
	info?: { title?: string; version?: string; description?: string };
	paths?: Record<string, Record<string, OpenApiOperation>>;
	tags?: { name: string; description?: string }[];
}

interface OpenApiOperation {
	operationId?: string;
	summary?: string;
	description?: string;
	tags?: string[];
	deprecated?: boolean;
	parameters?: OpenApiParameter[];
	requestBody?: {
		description?: string;
		required?: boolean;
		content?: Record<string, { schema?: unknown; example?: unknown }>;
	};
	responses?: Record<
		string,
		{ description?: string; content?: Record<string, { schema?: unknown }> }
	>;
}

interface OpenApiParameter {
	name: string;
	in: string;
	description?: string;
	required?: boolean;
	schema?: unknown;
}

function normalizeOpenAPI(spec: OpenAPISpec, forge: ForgeConfig): NormalizedSpec {
	const routes: NormalizedRoute[] = [];

	for (const [path, methods] of Object.entries(spec.paths ?? {})) {
		for (const [method, operation] of Object.entries(methods)) {
			if (!["get", "post", "put", "delete", "patch", "head", "options"].includes(method)) {
				continue;
			}

			routes.push({
				forge: forge.id,
				forgeName: forge.name,
				path,
				method: method.toUpperCase(),
				operationId: operation.operationId ?? `${method}_${path}`,
				summary: operation.summary,
				description: operation.description,
				tags: operation.tags ?? [],
				deprecated: operation.deprecated ?? false,
				parameters: (operation.parameters ?? []).map((p) => ({
					name: p.name,
					in: p.in as RouteParameter["in"],
					description: p.description,
					required: p.required ?? false,
					schema: p.schema,
				})),
				requestBody: operation.requestBody
					? {
							description: operation.requestBody.description,
							required: operation.requestBody.required ?? false,
							contentType: extractContentType(operation.requestBody.content),
							schema: extractSchema(operation.requestBody.content),
							example: extractExample(operation.requestBody.content),
						}
					: undefined,
				responses: Object.entries(operation.responses ?? {}).map(([code, resp]) => ({
					statusCode: code,
					description: resp.description,
					contentType: extractContentType(resp.content),
					schema: extractSchema(resp.content),
				})),
			});
		}
	}

	return {
		forge: forge.id,
		forgeName: forge.name,
		title: spec.info?.title ?? forge.name,
		version: spec.info?.version ?? "unknown",
		description: spec.info?.description,
		format: "openapi",
		routes,
		tags: extractTags(spec, routes),
	};
}

function extractContentType(content?: Record<string, unknown>): string | undefined {
	if (!content) return undefined;
	return Object.keys(content)[0];
}

function extractSchema(content?: Record<string, { schema?: unknown }>): unknown {
	if (!content) return undefined;
	const ct = Object.keys(content)[0];
	return content[ct]?.schema;
}

function extractExample(content?: Record<string, { example?: unknown }>): unknown {
	if (!content) return undefined;
	const ct = Object.keys(content)[0];
	return content[ct]?.example;
}

function extractTags(spec: OpenAPISpec, routes: NormalizedRoute[]): string[] {
	const tagSet = new Set<string>();
	for (const tag of spec.tags ?? []) {
		tagSet.add(tag.name);
	}
	for (const route of routes) {
		for (const tag of route.tags ?? []) {
			tagSet.add(tag);
		}
	}
	return Array.from(tagSet).sort();
}

function normalizeGraphQL(sdl: string, forge: ForgeConfig): NormalizedSpec {
	const { queries, mutations } = parseGraphQLSchema(sdl);
	const routes: NormalizedRoute[] = [];

	for (const field of queries) {
		routes.push({
			forge: forge.id,
			forgeName: forge.name,
			path: `/graphql/query/${field.name}`,
			method: "QUERY",
			operationId: field.name,
			summary: field.description,
			description: field.description,
			tags: ["graphql"],
			deprecated: field.deprecated,
			parameters: field.args.map((a) => ({
				name: a.name,
				in: "body",
				description: a.description,
				required: a.nonNull,
				schema: { type: a.type },
			})),
			responses: [{ statusCode: "200", description: "GraphQL response" }],
		});
	}

	for (const field of mutations) {
		routes.push({
			forge: forge.id,
			forgeName: forge.name,
			path: `/graphql/mutation/${field.name}`,
			method: "MUTATION",
			operationId: field.name,
			summary: field.description,
			description: field.description,
			tags: ["graphql"],
			deprecated: field.deprecated,
			parameters: field.args.map((a) => ({
				name: a.name,
				in: "body",
				description: a.description,
				required: a.nonNull,
				schema: { type: a.type },
			})),
			responses: [{ statusCode: "200", description: "GraphQL response" }],
		});
	}

	return {
		forge: forge.id,
		forgeName: forge.name,
		title: `${forge.name} GraphQL API`,
		version: "1.0",
		description: forge.description,
		format: "graphql",
		routes,
		tags: ["graphql"],
	};
}
