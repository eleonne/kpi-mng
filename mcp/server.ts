#!/usr/bin/env node
import path from "node:path";
import { config as loadEnv } from "dotenv";

// Some MCP clients (e.g. Claude Desktop, as of this writing) don't reliably
// honor the `cwd` configured for a server — confirmed by reproducing the
// exact "Cannot find module '@/generated/prisma/client'" failure by spawning
// with a wrong cwd. Force it to the project root (one level up from this
// file) before anything else loads, so every cwd-relative resolution downstream
// — dotenv's default .env lookup, and DATABASE_URL's "file:./dev.db" value
// being resolved by better-sqlite3 — lands in the right place regardless of
// what the launching client actually passed. See docs/mcp.md.
process.chdir(path.resolve(__dirname, ".."));
// quiet: true — dotenv's own "injected env" tip writes to stdout by default,
// which corrupts the JSON-RPC stream (MCP over stdio requires stdout to
// carry nothing but protocol messages).
loadEnv({ quiet: true });

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "../src/lib/mcp/create-server";

/**
 * Local stdio entry point — for Claude Code / Claude Desktop launching this
 * as a subprocess. Tool definitions live in src/lib/mcp/create-server.ts,
 * shared with the Streamable HTTP endpoint at src/app/api/mcp/route.ts for
 * remote access. See docs/mcp.md.
 */
async function main() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error starting MCP server:", err);
  process.exit(1);
});
