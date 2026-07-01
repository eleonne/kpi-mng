# KPI Dashboard — REST API

JSON HTTP API for managing KPIs, their field schemas, and the cases logged
against them. It's a thin layer over the same service functions the web UI's
Server Actions call (`src/lib/services/*`), so business rules — uniqueness,
activation preconditions, delete guards — are identical between the UI and
the API. See [data-model.md](data-model.md) and [business-rules.md](business-rules.md)
for the underlying entities and rules; this doc covers the HTTP contract. There's also an
[MCP server](mcp.md) exposing the same operations as tools for LLM clients.

**No authentication yet.** This is an open question carried over from
`docs/business-rules.md` §6 — every endpoint below is currently open to
anyone who can reach the server. Don't expose this outside a trusted network
until that's addressed.

## Conventions

- All request/response bodies are JSON (`Content-Type: application/json`).
- Errors are always `{ "error": string, "fieldErrors"?: { [field]: string[] } }`.
  `fieldErrors` is present for validation failures (`400`).
- Dates are ISO 8601 strings (e.g. `"2026-01-15"` or a full timestamp — both parse).
- `PATCH` endpoints are **partial updates**: omit a field to leave it
  unchanged. To clear an optional text field, send `""`, not `null`
  (`null` is treated as "not provided" and falls back to the current value).
- No pagination, filtering (beyond what's listed below), or auth yet — this
  is an internal tool with a small dataset.

| Status | Meaning |
|---|---|
| `200` | Success |
| `201` | Created |
| `400` | Validation failed (bad shape/type) — see `fieldErrors` |
| `404` | KPI / field / case not found |
| `409` | Conflict with existing data (duplicate name, delete blocked, etc.) |
| `422` | Valid shape, but a business rule blocked it (e.g. activation preconditions) |
| `500` | Unexpected server error |

## KPIs

### `GET /api/kpis?includeArchived=false`

List KPIs (default: non-archived, matching the dashboard). Pass
`includeArchived=true` to list archived KPIs instead. Each item includes a
computed `summary` (current value vs. target) but not its field definitions
or cases — fetch the detail endpoint for those.

### `POST /api/kpis`

Create a KPI. Always starts as `DRAFT` — add fields via
`POST /api/kpis/:kpiId/fields`, then `POST /api/kpis/:kpiId/activate` once
at least one exists.

```json
{
  "name": "Documented EA Impact Cases",
  "theme": "Value & Impact",
  "objective": "Demonstrate measurable value delivered through EA.",
  "owner": "Jane Doe",
  "measurementType": "COUNT",
  "targetValue": 5,
  "targetUnit": "cases",
  "targetPeriodLabel": "Year-end",
  "measurementFormulaText": "Number of completed EA impact cases documented and approved",
  "qualificationCriteria": ["Recommendation adopted by the project"],
  "populationSize": null
}
```

`measurementType` is one of `COUNT`, `PERCENTAGE_OF_ENTRIES`,
`PERCENTAGE_OF_FIXED_POPULATION` — see data-model.md for what each means.
`populationSize` is required (positive integer) only for
`PERCENTAGE_OF_FIXED_POPULATION`, and must be omitted otherwise. Returns
`201` with the created KPI.

### `GET /api/kpis/:kpiId`

Full detail: core fields, computed `summary`, `fieldDefinitions[]`, and
`entries[]` (cases, each with a flattened `fields` object keyed by `fieldKey`).

### `PATCH /api/kpis/:kpiId`

Partial update of the same fields as `POST`, plus `primaryFieldKey` (must
reference one of the KPI's own field keys; required before activating a
`PERCENTAGE_OF_FIXED_POPULATION` KPI). `measurementType` can't be changed
once the KPI has logged cases (`409`).

### `DELETE /api/kpis/:kpiId`

Hard-deletes the KPI. Only allowed if it has zero logged cases (`409`
otherwise) — archive it instead.

### `POST /api/kpis/:kpiId/activate`

Moves a KPI from `DRAFT` (or `ARCHIVED`) to `ACTIVE`. `422` if preconditions
aren't met: needs ≥1 active field, and for `PERCENTAGE_OF_FIXED_POPULATION`,
a `populationSize` and a Text/Select `primaryFieldKey`.

### `POST /api/kpis/:kpiId/archive`

Hides the KPI from the dashboard while preserving its history. Can be
reactivated with `POST /api/kpis/:kpiId/activate`.

## Field definitions

A case's shape is defined per-KPI — before logging cases, discover (or
create) the KPI's fields here.

### `GET /api/kpis/:kpiId/fields`

All field definitions (active and inactive).

### `POST /api/kpis/:kpiId/fields`

```json
{
  "label": "Project Name",
  "fieldType": "TEXT",
  "helpText": "Initiative reviewed by EA",
  "isRequired": true,
  "options": []
}
```

`fieldType` is one of `TEXT`, `LONG_TEXT`, `NUMBER`, `DATE`, `BOOLEAN`,
`SELECT`, `MULTI_SELECT`. `options` (a plain string array) is required
(non-empty) for `SELECT`/`MULTI_SELECT`, ignored otherwise. The server
derives a unique `fieldKey` from `label` (e.g. "Project Name" →
`project_name`) — use that key, not the label, when submitting `fields` on
a case. Returns `201` with the created field, including its `fieldKey`.

### `PATCH /api/kpis/:kpiId/fields/:fieldId`

Only `{ "isActive": false }` is supported (deactivate) — field type, key,
and other attributes are immutable once created (matches the UI, which
doesn't support editing them either). Deactivating a field that's currently
the KPI's `primaryFieldKey` clears that reference.

### `DELETE /api/kpis/:kpiId/fields/:fieldId`

Hard-deletes the field. Only allowed if no case has a recorded value for it
(`409` otherwise, suggesting `PATCH` to deactivate instead).

## Cases

A "case" is one data point logged against a KPI — see data-model.md's
`KpiEntry` entity.

### `GET /api/kpis/:kpiId/entries`

All cases for the KPI, newest first. Each has a `fields` object keyed by
`fieldKey`, resolved to native JSON types (string/number/boolean/ISO date
string/string array for `MULTI_SELECT`).

### `POST /api/kpis/:kpiId/entries`

```json
{
  "entryDate": "2026-01-15",
  "countsTowardTarget": true,
  "evidenceSource": "ARR-2026-004",
  "notes": "Optional freeform commentary",
  "fields": {
    "project_name": "Invoice Automation",
    "benefit_type": "Cost Avoidance"
  }
}
```

`entryDate` is required; `countsTowardTarget` defaults to `true`.
`fields` must satisfy every field the KPI currently has marked
`isRequired: true` (see `GET /api/kpis/:kpiId/fields`). The KPI needs at
least one active field before it can accept cases. Returns `201` with the
created case.

`countsTowardTarget` is *not* auto-derived from the KPI's qualification
criteria — those are a human judgment call (see business-rules.md §3); set
it explicitly based on whether this case actually qualifies.

### `GET /api/kpis/:kpiId/entries/:entryId`

### `PATCH /api/kpis/:kpiId/entries/:entryId`

Partial update — omit `fields.<key>` entries to leave them unchanged. Only
currently-active fields can be set (a field deactivated after the case was
created keeps its stored value but isn't editable here until reactivated).

### `DELETE /api/kpis/:kpiId/entries/:entryId`

## Example: create a KPI and log a case end to end

```bash
# 1. Create the KPI (starts as DRAFT)
curl -X POST localhost:3000/api/kpis -H 'Content-Type: application/json' -d '{
  "name": "Widget Assembly Throughput",
  "objective": "Track widgets fully assembled per quarter.",
  "measurementType": "COUNT",
  "targetValue": 42
}'
# -> { "id": "abc123", "status": "DRAFT", ... }

# 2. Add a field
curl -X POST localhost:3000/api/kpis/abc123/fields -H 'Content-Type: application/json' -d '{
  "label": "Batch Name",
  "fieldType": "TEXT",
  "isRequired": true
}'
# -> { "fieldKey": "batch_name", ... }

# 3. Activate (now that it has a field)
curl -X POST localhost:3000/api/kpis/abc123/activate

# 4. Log a case
curl -X POST localhost:3000/api/kpis/abc123/entries -H 'Content-Type: application/json' -d '{
  "entryDate": "2026-01-15",
  "fields": { "batch_name": "Batch 001" }
}'

# 5. Check the current value
curl localhost:3000/api/kpis/abc123 | jq .summary
# -> { "hasData": true, "currentValue": 1, "displayValue": "1 / 42", ... }
```
