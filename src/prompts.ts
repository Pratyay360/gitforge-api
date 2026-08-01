import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { FORGES, FORGE_IDS_TUPLE } from "./config";

export function registerPrompts(server: McpServer): void {
	server.registerPrompt(
		"explain_endpoint",
		{
			title: "Explain an API Endpoint",
			description:
				"Generate a human readable explaination about the specific endpoint.",
			argsSchema: z.object({
				forge: z.enum([...FORGE_IDS_TUPLE]).describe("Which git forge"),
				operationId: z
					.string()
					.describe("The operationId of the endpoint to explain"),
			}),
		},
		({ forge, operationId }) => {
			return {
				messages: [
					{
						role: "user",
						content: {
							type: "text" as const,
							text: `Use the 'get_route' tool with forge="${forge}" and operationId="${operationId}" to fetch the full spec for this endpoint.`,
						},
					},
				],
			};
		},
	);
	server.registerPrompt(
		"compare_endpoints",
		{
			title: "Compare API Endpoints Across Forges",
			description:
				"Generate a comparison of equivalent API endpoints across multiple git forges (e.g., how to list repositories on GitHub vs GitLab vs Forgejo).",
			argsSchema: z.object({
				endpoint: z
					.string()
					.describe(
						"The concept to compare, e.g., 'list repositories', 'create issue', 'get user'",
					),
				forges: z
					.string()
					.optional()
					.describe("Comma-separated list of forges to compare (default: all)"),
				query: z
					.string()
					.optional()
					.describe(
						"Optional search term to find the relevant endpoints (default: uses 'endpoint' concept)",
					),
			}),
		},
		({ endpoint, query, forges }) => {
			const searchTerm = query ?? endpoint;
			const targets = forges
				? forges
						.split(",")
						.map((f) => f.trim())
						.filter(Boolean)
						.join(", ")
				: "all supported git forges";
			return {
				messages: [
					{
						role: "user",
						content: {
							type: "text" as const,
							text: `Search term for finding relevant endpoints: "${searchTerm}"\n\nCompare the equivalent "${endpoint}" endpoints across: ${targets}. Use the 'search_routes' tool to fetch each forge's matching routes, then present a side-by-side comparison.\n`,
						},
					},
				],
			};
		},
	);

	server.registerPrompt(
		"auth_guide",
		{
			title: "Authentication Guide",
			description:
				"documentation for authenticating with a specific git forge's API for performing authenticated requests.",
			argsSchema: z.object({
				forge: z.enum([...FORGE_IDS_TUPLE]).describe("Which git forge to guide authentication for"),
			}),
		},
		({ forge }) => {
			const forgeInfo = FORGES[forge];
			return {
				messages: [
					{
						role: "user",
						content: {
							type: "text" as const,
							text:
								`Forge: ${forgeInfo.name}\n` +
								`Supported auth methods: ${forgeInfo.authMethods.join("; ")}\n` +
								`Also mention any rate limits that apply to authenticated requests.`,
						},
					},
				],
			};
		},
	);

	server.registerPrompt(
		"quickstart",
		{
			title: "Quick Start Guide",
			description:
				"a quick start guide for using a specific git forge's API can be used as a knowledge base",
			argsSchema: z.object({
				forge: z
					.enum([
						"github",
						"gitlab",
						"forgejo",
						"codeberg",
						"bitbucket",
						"gitea",
						"sourcehut",
					] as const)
					.describe("Which git forge"),
			}),
		},
		({ forge }) => {
			return {
				messages: [
					{
						role: "user",
						content: {
							type: "text" as const,
							text: `Write a quick start guide for the ${FORGES[forge].name} API (${forge}). For each key operation, show the HTTP method, path, key parameters, and a curl example with auth.\n`,
						},
					},
				],
			};
		},
	);
}
