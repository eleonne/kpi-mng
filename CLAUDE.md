# CLAUDE.md

Architecture and conventions for the KPI dashboard app. This is a living document — update it
as decisions change. For *what* the app models (entities, calculation logic, validation
rules), see [docs/data-model.md](docs/data-model.md) and
[docs/business-rules.md](docs/business-rules.md); this file covers *how* it's built.

## What this is

An internal dashboard for defining KPIs, logging "cases" (data points) against them, and
tracking progress toward targets. Single small team, not a public-facing product — the stack
is chosen for simplicity and low operational overhead over scalability.

## Tech stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router)** | One app, one Node process, no separate API to stand up/deploy/CORS with. React Server Components fetch data directly; Server Actions handle mutations. |
| Language | **TypeScript**, strict mode | The KPI data model has a lot of typed variability (field types, measurement types, enums) — types catch mismatches between a KPI's field schema and its case data at compile time. |
| Database | **SQLite** | Single file (`prisma/dev.db`), zero server to run. Fine for single-team internal use; revisit if concurrent multi-writer load ever becomes real. |
| ORM | **Prisma** | Schema maps directly onto the entities in `docs/data-model.md`; generates a typed client + migrations. |
| Styling | **Tailwind CSS** | No separate CSS architecture to maintain; pairs well with Next.js out of the box. |
| UI components | **shadcn/ui** | Accessible, unstyled-by-default primitives (dialogs, tables, forms) — good fit for a data-entry-heavy CRUD app; copy-in components so nothing is a black-box dependency. |
| Charts | **Recharts** | Simple declarative API, enough for progress bars / trend lines on a KPI dashboard. |
| Validation | **Zod** | One schema per form/action input, shared between client-side form validation and server-side Server Action validation. |
| Forms | **React Hook Form** + Zod resolver | Only where a form is complex enough to need it (KPI field-definition builder, case entry forms with dynamic fields); simple forms can stay as plain Server Actions with `<form>`. |
| Testing | **Vitest** (unit), **React Testing Library** (components), **Playwright** (e2e smoke) | See [Testing](#testing) below. |
| Lint/format | **ESLint** (Next.js default config) + **Prettier** | Standard, no custom rule set unless something concrete comes up. |
| Package manager | **npm** | No reason yet to reach for pnpm/yarn workspaces — it's a single app, not a monorepo. |

Requires **Node.js 20+ LTS**.

## Architecture

Server Components fetch data (via Prisma) directly — no client-side data-fetching library
(no React Query/SWR) unless a concrete need for it shows up (e.g. polling, optimistic UI
beyond what `useOptimistic` covers). There are **four thin entry points** into the same
`lib/services/*` functions, so business rules are defined exactly once:
- The UI's **Server Actions** (`src/actions/*`, FormData in)
- A JSON **REST API** under `app/api/kpis/` (see [docs/api.md](docs/api.md))
- **MCP, stdio transport** (`mcp/server.ts`) — for local clients (Claude Code, Claude Desktop)
  that spawn it as a subprocess; talks to the database directly, not through the Next.js server
- **MCP, Streamable HTTP transport** (`app/api/mcp/route.ts`) — for remote clients over the
  network; runs inside the same Next.js process as the REST API

Both MCP transports share one set of tool definitions (`lib/mcp/create-server.ts`) — see
[docs/mcp.md](docs/mcp.md), including the internet-exposure/auth caveats before deploying the
HTTP transport anywhere publicly reachable (there is no authentication on it today, by choice).

```
kpi-mng/
  prisma/
    schema.prisma          # source of truth for entities — mirrors docs/data-model.md
    migrations/
    dev.db                 # gitignored
  mcp/
    server.ts               # MCP stdio entry point — see docs/mcp.md
  src/
    app/                    # Next.js App Router routes (pages + layouts)
      page.tsx               # dashboard home
      kpis/
        page.tsx              # KPI list / management
        new/page.tsx
        [kpiId]/
          page.tsx             # KPI detail: current value, cases list
          edit/page.tsx         # edit KPI + manage field definitions
          entries/
            new/page.tsx         # log a new case
            [entryId]/edit/page.tsx
      api/
        kpis/                 # REST API (JSON in/out), calls lib/services/* — see docs/api.md
        mcp/route.ts           # MCP Streamable HTTP transport — see docs/mcp.md
    components/
      ui/                    # shadcn/ui primitives
      kpi/                   # KpiCard, KpiForm, FieldDefinitionBuilder, EntryForm, ...
      charts/
    lib/
      db.ts                  # Prisma client singleton
      calculations/          # current-value engine: COUNT / PERCENTAGE_OF_ENTRIES / PERCENTAGE_OF_FIXED_POPULATION
      validation/             # Zod schemas — form (FormData) and api (JSON) variants per entity, reused by mcp/
      services/                # business-rule logic + Prisma writes, shared by actions/, app/api/, and mcp/
      mcp/create-server.ts       # MCP tool definitions, shared by both MCP transports
      serializers.ts            # framework-free JSON shaping, shared by app/api/ and mcp/
      errors.ts                 # AppError (+ NotFound/Conflict/BusinessRule) for service-layer failures
      api-utils.ts               # Next-specific error-response mapping (re-exports serializers.ts)
    actions/                 # Server Actions (FormData in), call lib/services/*
    types/                    # shared types not generated by Prisma
  docs/
    data-model.md
    business-rules.md
    api.md
    mcp.md
    deployment.md
  deploy/
    kpi-dashboard.service     # systemd unit template — see docs/deployment.md
    Caddyfile                  # reverse proxy + HTTPS template — see docs/deployment.md
  tests/
    unit/                    # lib/calculations, lib/validation
    component/                # components/*
    e2e/                       # Playwright flows
```

### Key architectural rules

- **Calculation logic lives in `lib/calculations/`, nowhere else.** The COUNT /
  `PERCENTAGE_OF_ENTRIES` / `PERCENTAGE_OF_FIXED_POPULATION` rules from `docs/data-model.md`
  are pure functions over Prisma query results, unit-tested in isolation. Server Components and
  Server Actions call into this module; they don't reimplement the math.
- **All four entry points (Server Actions, REST API, and both MCP transports) stay thin, and
  share one service layer.** Each parses its own input shape (FormData vs JSON — see the
  form/api Zod schema split in `lib/validation/*`; MCP tool `inputSchema`s reuse the same base
  Zod shapes), then calls into `lib/services/*` for everything that needs the database:
  uniqueness checks, activation preconditions, delete guards, and the actual Prisma writes.
  Business rules from `docs/business-rules.md` live in the service functions, which throw
  `AppError` subclasses (`lib/errors.ts`) on violation — actions surface `.message` as a form
  error, API routes map `.status` to the HTTP response (`lib/api-utils.ts`), MCP tools (either
  transport) return `.message` as an `isError: true` result. Never re-implement a rule directly
  in an action, a route handler, or an MCP tool; add it to the service instead.
- **Dynamic case fields (EAV) are rendered generically.** One `EntryForm` component reads a
  KPI's active `KpiFieldDefinition` rows and renders the right input per `field_type` — no
  per-KPI hardcoded forms.
- Prisma model names: singular PascalCase (`Kpi`, `KpiFieldDefinition`, `KpiEntry`,
  `KpiEntryFieldValue`), fields camelCase — standard Prisma convention, mapping 1:1 onto the
  entities named in `docs/data-model.md`.

## Conventions

- Files/folders: kebab-case (`field-definition-builder.tsx`). Exported React components:
  PascalCase (`FieldDefinitionBuilder`).
- Server Actions: verb-noun, one domain per file (`createKpi`, `archiveKpi`, `deleteKpi`,
  `addKpiField`, `deactivateKpiField`, `logKpiEntry`, `updateKpiEntry`, `deleteKpiEntry`).
- No client-side global state library. Local component state (`useState`) and
  server-driven data (Server Components + `revalidatePath`) are enough for a CRUD dashboard;
  don't reach for Redux/Zustand/Jotai unless a concrete cross-page client state need appears.
- API routes: verb-per-HTTP-method under a REST resource path (`app/api/kpis/[kpiId]/entries/[entryId]/route.ts`
  exports `GET`/`PATCH`/`DELETE`), matching `docs/api.md`. Lifecycle transitions (`activate`,
  `archive`) are sub-resource `POST`s, not overloaded into `PATCH` — mirrors the distinct
  Server Actions for the same operations.
- MCP tools: `verb_noun` snake_case (`create_kpi`, `activate_kpi`, `add_kpi_case`), one
  `server.registerTool(...)` call per tool in `lib/mcp/create-server.ts` (shared by both
  transports), matching `docs/mcp.md`.
- Keep `docs/data-model.md`, `docs/business-rules.md`, `docs/api.md`, and `docs/mcp.md` in sync with
  `schema.prisma` / `lib/services/*` — if a migration changes an entity's shape or a rule
  changes, update the relevant doc in the same change.

## Testing

Small internal tool — proportional test effort, not a full pyramid:

- **Unit** (Vitest): `lib/calculations/*` (the three measurement-type formulas, including the
  "no data yet" divide-by-zero case) and `lib/validation/*`. This is the highest-value test
  surface — it's the part of the app that must be correct.
- **Component** (React Testing Library): the dynamic `EntryForm` (renders correct input per
  field type, required-field validation) and the field-definition builder.
- **E2E** (Playwright): one smoke test per core flow — create a KPI, log a case, see the
  dashboard value update; archive a KPI; deactivate a field — plus the same create/field/
  activate/case/delete lifecycle repeated against each entry point (REST API, MCP stdio, MCP
  Streamable HTTP) to confirm they all enforce the same rules.

## Commands

```bash
npm run dev             # start dev server
npm run build           # production build
npm run lint            # ESLint
npm run test            # Vitest (unit + component)
npm run test:e2e        # Playwright
npm run mcp             # run the MCP server standalone (stdio) — see docs/mcp.md
npx prisma migrate dev  # create/apply a migration (dev)
npm run db:migrate:deploy # apply existing migrations non-interactively (prod)
npx prisma studio       # inspect the SQLite DB
```

Deploying somewhere real? See [docs/deployment.md](docs/deployment.md) (VPS + systemd +
Caddy) and the `deploy/` folder's config templates.

## Open questions

Carried over from `docs/business-rules.md` §6 — not yet resolved, don't assume an answer when
implementing: authentication/roles, whether `KpiStatusSnapshot` (narrative mid-period updates)
is in scope for v1, on-track/at-risk status thresholds, and whether case editing needs
period-locking. Ask before building against any of these.
