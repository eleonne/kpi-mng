# KPI Dashboard

An internal dashboard for defining KPIs, logging the individual data points
("cases") that feed each one, and tracking progress toward a target. Built
for a small team, not a public product — see [CLAUDE.md](CLAUDE.md) for the
reasoning behind the stack and architecture.

Every KPI defines its own case schema (which fields you fill in when logging
a data point) and one of three calculation modes — a raw count, a percentage
of logged cases, or a percentage of a fixed external population (e.g. "% of
teams engaged"). See [docs/data-model.md](docs/data-model.md) for the full
model and [docs/business-rules.md](docs/business-rules.md) for the rules
around it (uniqueness, activation, deletion, etc.).

The seeded example data is an Enterprise Architecture KPI framework (ARB
governance, standards alignment, documentation throughput) — replace it with
your own via `prisma/seed.ts` (see [Database](#database) below).

## Three ways in

- **Web UI** — the dashboard itself (`/`) plus an executive-oriented summary
  view (`/executive`) with charts.
- **REST API** — full CRUD over HTTP. See [docs/api.md](docs/api.md).
- **MCP server** — the same operations exposed as tools for LLM clients
  (Claude Code, Claude Desktop). See [docs/mcp.md](docs/mcp.md).

All three call the same `lib/services/*` functions, so business rules behave
identically no matter which one you use.

## Getting started

Requires Node.js 20+.

```bash
npm install                       # installs dependencies, generates the Prisma client
cp .env.default .env              # local config — DATABASE_URL points at prisma/dev.db by default
cp dev.db.default dev.db          # empty database with the schema already migrated
npm run db:seed                   # optional: load the example KPIs (safe to skip or re-run)
npm run dev                       # http://localhost:3000
```

If you'd rather start from a clean slate without the example data, skip
`npm run db:seed` — the dashboard just shows "no KPIs yet" until you create
one.

Ready to put this somewhere real? See [docs/deployment.md](docs/deployment.md)
for a full runbook (VPS + systemd + HTTPS).

### Database

SQLite, single file (`dev.db`, gitignored). `dev.db.default` is a committed
template with the schema migrated but no data — copy it to get started, or
run `npm run db:migrate` against an empty file yourself. Similarly,
`prisma/.seed.ts.default` is a committed template you can copy to
`prisma/seed.ts` (also gitignored) if you want to seed different example
data — it shows the shape for one KPI per measurement type.

Changed `prisma/schema.prisma`? Run `npm run db:migrate` to create and apply
a migration, then update [docs/data-model.md](docs/data-model.md) if the
entities themselves changed shape.

## Commands

```bash
npm run dev             # start the dev server
npm run build           # production build
npm run lint             # ESLint
npm run test             # Vitest (unit + component)
npm run test:e2e          # Playwright (UI flow + REST API + MCP server)
npm run mcp              # run the MCP server standalone (stdio)
npm run db:migrate       # create/apply a Prisma migration (dev)
npm run db:migrate:deploy # apply existing migrations non-interactively (prod)
npm run db:seed          # seed example KPIs (prisma/seed.ts)
npm run db:studio        # browse the SQLite database
```

## Documentation

| Doc | Covers |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Tech stack, architecture, conventions — the "how" |
| [docs/data-model.md](docs/data-model.md) | Entities and calculation logic — the "what" |
| [docs/business-rules.md](docs/business-rules.md) | Validation and lifecycle rules |
| [docs/api.md](docs/api.md) | REST API reference |
| [docs/mcp.md](docs/mcp.md) | MCP server tool reference and client setup |
| [docs/deployment.md](docs/deployment.md) | Deploying to a self-managed VPS |

## License

Apache License 2.0 — see [LICENSE](LICENSE).
