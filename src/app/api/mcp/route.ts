import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/lib/mcp/create-server";

// Native Node APIs (Prisma, better-sqlite3) — never run this on the edge runtime.
export const runtime = "nodejs";

/**
 * Streamable HTTP MCP endpoint for remote clients — see docs/mcp.md. Stateless:
 * a fresh McpServer + transport per request (cheap, no shared session state),
 * matching the SDK's own stateless-mode guidance. GET/POST/DELETE all delegate
 * to the same transport, which dispatches internally per the MCP spec.
 *
 * No authentication — see docs/mcp.md's "Exposing this over the internet"
 * section before deploying this anywhere reachable from the public internet.
 */
async function handle(request: Request): Promise<Response> {
  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    // Every tool here is a simple request/response call, nothing long-running
    // or server-push — plain JSON is simpler for clients than SSE framing.
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
