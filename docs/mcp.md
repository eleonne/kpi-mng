# KPI Dashboard — MCP Server

An [MCP](https://modelcontextprotocol.io) server exposing the same KPI/case
management as [docs/api.md](api.md), as tools an LLM client (Claude Code,
Claude Desktop, or a remote client over the internet) can call directly. The
tool definitions (`src/lib/mcp/create-server.ts`) are shared by **two
transports**:

| Transport | Entry point | For |
|---|---|---|
| stdio | `mcp/server.ts` | Local clients that spawn it as a subprocess (Claude Code, Claude Desktop) |
| Streamable HTTP | `src/app/api/mcp/route.ts` | Remote clients, over the network — see [Exposing this over the internet](#exposing-this-over-the-internet) |

Both call directly into `src/lib/services/*` — the same business rules as
the UI and the REST API, just via a different protocol. See
[data-model.md](data-model.md) and [business-rules.md](business-rules.md)
for the underlying entities and rules.

**No authentication on either transport.** For stdio this is low-risk (only
whoever can launch the process on your machine can use it). For the HTTP
endpoint it means **anyone who can reach the URL has full read/write access
to all KPI data** — see the internet-exposure section below before deploying
it anywhere reachable from outside your machine.

## Local setup (stdio)

**Claude Code**: this repo has a `.mcp.json` at its root, so the server is
auto-discovered when you open the project — no setup needed. If you've
already got a session open, reload it to pick up `.mcp.json`.

**Claude Desktop** (or any other MCP client configured by JSON): add to its
config, using absolute paths for both `cwd` and `args`, **and** set
`TSX_TSCONFIG_PATH` explicitly:

```json
{
  "mcpServers": {
    "kpi-dashboard": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/kpi-mng/mcp/server.ts"],
      "cwd": "/absolute/path/to/kpi-mng",
      "env": {
        "TSX_TSCONFIG_PATH": "/absolute/path/to/kpi-mng/tsconfig.json"
      }
    }
  }
}
```

(Windows example: `"cwd": "C:\\Users\\you\\dev\\kpi-mng"`, same for the other
two paths — remember JSON needs `\\`, not `\`.)

**Why `TSX_TSCONFIG_PATH` is required, not optional:** at least as of this
writing, Claude Desktop doesn't reliably honor the `cwd` you configure for a
server. `mcp/server.ts` imports `src/lib/db.ts` and friends using the `@/`
path alias (same as the rest of the app) — `tsx` normally resolves that by
auto-discovering the nearest `tsconfig.json` from the process's working
directory, and if that directory is wrong, resolution fails with
`Cannot find module '@/generated/prisma/client'`. Setting
`TSX_TSCONFIG_PATH` to an absolute path bypasses that auto-discovery
entirely, so it works regardless of what `cwd` the client actually uses.
(The server also forces its own working directory to the project root as
its first action, which independently fixes `.env` / `DATABASE_URL`
resolution for the same underlying reason — but that alone can't fix the
`tsx` alias issue, since module resolution for its own imports happens
before any of the server's own code runs.)

**Manual/debugging**: `npm run mcp` runs it directly, talking JSON-RPC over
stdin/stdout — not meant to be typed at by hand, but useful to confirm it
starts without errors.

## Exposing this over the internet

The HTTP endpoint is `POST /api/mcp` (part of the regular Next.js app —
whatever host serves the web app also serves this). It requires the header
`Accept: application/json, text/event-stream` on every request (per the MCP
Streamable HTTP spec — a 406 otherwise) and responds with plain JSON, not
SSE (`enableJsonResponse: true` in the route, since none of these tools are
long-running or push data to the client).

```bash
curl -X POST https://your-host.example.com/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_kpis","arguments":{}}}'
```

It's stateless — every request gets a fresh `McpServer` + transport
(cheap; registering 15 tools is synchronous, no I/O), so there's no session
state to manage across requests or instances.

### Hosting: needs a persistent disk

The database is a local SQLite file (`dev.db`). That's fine on a host with a
persistent filesystem (a VPS, or a container platform with a volume — Fly.io,
Railway, Render, etc., running `npm run build && npm run start`
continuously). It will **not** work correctly on serverless/edge platforms
with ephemeral filesystems (Vercel, Netlify, Cloudflare Workers, AWS Lambda)
— the database would silently reset or fail between invocations. Don't
deploy this there without first migrating to a hosted database (a change to
`prisma/schema.prisma`'s datasource and `lib/db.ts`'s adapter, not covered
here).

### No authentication — this is a deliberate, known gap

As of this writing, there is no auth on `/api/mcp` (or `/api/kpis/**`) by
choice, not oversight — **do not deploy this publicly reachable without
addressing it first.** At minimum, before exposing it to the internet:

- Put it behind a network boundary (VPN, IP allowlist, reverse-proxy basic
  auth) if only you/your team need remote access, **or**
- Add a shared-secret bearer token check at the top of the `handle()`
  function in `src/app/api/mcp/route.ts` (and mirror it in
  `app/api/kpis/**` if the REST API is also exposed) — check an
  `Authorization: Bearer <token>` header against an env var before calling
  `createMcpServer()`, returning a `401` `Response` otherwise. A few lines,
  but genuinely necessary once this leaves your machine or trusted network.

## Tools

Mirrors the REST API's resource model — see docs/api.md for the underlying
rules (uniqueness, activation preconditions, delete guards, etc.), which
apply identically here since both call the same service functions.

| Tool | Equivalent to |
|---|---|
| `list_kpis` | `GET /api/kpis` |
| `get_kpi` | `GET /api/kpis/:kpiId` |
| `create_kpi` | `POST /api/kpis` |
| `update_kpi` | `PATCH /api/kpis/:kpiId` |
| `delete_kpi` | `DELETE /api/kpis/:kpiId` |
| `activate_kpi` | `POST /api/kpis/:kpiId/activate` |
| `archive_kpi` | `POST /api/kpis/:kpiId/archive` |
| `list_kpi_fields` | `GET /api/kpis/:kpiId/fields` |
| `add_kpi_field` | `POST /api/kpis/:kpiId/fields` |
| `deactivate_kpi_field` | `PATCH /api/kpis/:kpiId/fields/:fieldId` (`{"isActive": false}`) |
| `delete_kpi_field` | `DELETE /api/kpis/:kpiId/fields/:fieldId` |
| `list_kpi_cases` | `GET /api/kpis/:kpiId/entries` |
| `add_kpi_case` | `POST /api/kpis/:kpiId/entries` |
| `update_kpi_case` | `PATCH /api/kpis/:kpiId/entries/:entryId` |
| `delete_kpi_case` | `DELETE /api/kpis/:kpiId/entries/:entryId` |

A failed call returns `isError: true` with a plain-text message (not JSON) —
e.g. `activate_kpi` before any field exists returns the same "Add at least
one field definition before activating this KPI." message the UI and API
would give.

## Example prompts

Once connected, you can ask the client directly, e.g.:

- "List all active KPIs and tell me which ones have no cases logged yet."
- "Create a KPI called 'Vendor Response Time' that tracks a count, target 20 by year-end, then add a Text field for Vendor Name."
- "Log a case against the Vendor Response Time KPI for today, Vendor Name 'Acme Corp'."

## Why direct DB access instead of calling the REST API

Both transports import `src/lib/services/*` and the Prisma client directly
rather than making HTTP calls to `/api/kpis/**`. This means:

- The stdio server works standalone — no need to have `npm run dev` running
  separately (the Streamable HTTP route, by definition, runs inside the same
  Next.js process as the REST API, so this specific benefit only applies to
  stdio).
- No extra HTTP round-trip for either transport.
- It's the natural extension of the pattern already established for Server
  Actions vs. REST API: one service layer, multiple thin protocol adapters.

The tradeoff: if this project ever adds authentication to the REST API, MCP
won't automatically inherit it (both transports bypass `/api/kpis/**`
entirely) — auth needs to be added to `src/app/api/mcp/route.ts` separately,
as noted above.
