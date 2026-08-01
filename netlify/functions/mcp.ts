import type { Config } from "@netlify/functions";
import { app } from "../../src/index";

/**
 * Netlify Function v2 entrypoint for the gitforge-api-mcp server.
 *
 * Routes every request through the Hono app, which dispatches to:
 *   - /mcp/*          the MCP (streamable HTTP / SSE) endpoint
 *   - /{forge}        Scalar API reference docs pages
 *   - /               server metadata JSON
 */
export default async (req: Request) => {
	return app.fetch(req);
};

export const config: Config = {
	path: "/*",
};
