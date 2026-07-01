# KPI Dashboard — MCP Server

An [MCP](https://modelcontextprotocol.io) server exposing the same KPI/case
management as [docs/api.md](api.md), as tools an LLM client (Claude Code,
Claude Desktop, etc.) can call directly. It's a third thin entry point over
`src/lib/services/*` — the same business rules as the UI and the REST API,
just via a different protocol. See [data-model.md](data-model.md) and
[business-rules.md](business-rules.md) for the underlying entities and rules.

**No authentication** — same caveat as the REST API. It talks to the SQLite
database directly (not through the running Next.js server), so it works even
if `npm run dev` isn't running, but it does mean anyone who can launch this
process has full read/write access to the KPI data.

## Setup

**Claude Code**: this repo has a `.mcp.json` at its root, so the server is
auto-discovered when you open the project — no setup needed. If you've
already got a session open, reload it to pick up `.mcp.json`.

**Claude Desktop** (or any other MCP client configured by JSON): add to its
config, using an absolute path for `cwd`:

```json
{
  "mcpServers": {
    "kpi-dashboard": {
      "command": "npx",
      "args": ["tsx", "mcp/server.ts"],
      "cwd": "/absolute/path/to/kpi-mng"
    }
  }
}
```

**Manual/debugging**: `npm run mcp` runs it directly, talking JSON-RPC over
stdin/stdout — not meant to be typed at by hand, but useful to confirm it
starts without errors.

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

The MCP server imports `src/lib/services/*` and the Prisma client directly
rather than making HTTP calls to a running `npm run dev` server. This means:

- It works standalone — no need to have the web app running.
- No extra HTTP round-trip.
- It's the natural extension of the pattern already established for Server
  Actions vs. REST API: one service layer, multiple thin protocol adapters.

The tradeoff: if this project ever adds authentication to the REST API, the
MCP server won't automatically inherit it (it bypasses HTTP entirely) —
revisit this file if/when that happens.
