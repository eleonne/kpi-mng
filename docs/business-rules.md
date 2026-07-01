# KPI Dashboard — Business Rules

Companion to [data-model.md](data-model.md). Defines how the entities behave — validation,
lifecycle, calculation edge cases — plus open questions to resolve before implementation.

## 1. KPI lifecycle

- `name` is required and must be unique (case-insensitive) among non-archived KPIs.
- `objective` and `measurement_type` are required before a KPI can move from `Draft` to
  `Active`.
- `measurement_type` is **locked once the KPI has at least one case** — changing it after data
  exists would silently invalidate the historical current-value calculation. To change it,
  archive the KPI and create a new one.
- `target_value`, `target_unit`, and `target_period_label` can always be edited (targets are
  legitimately revised, e.g. mid-year).
- `population_size` is required and must be `> 0` when `measurement_type =
  PERCENTAGE_OF_FIXED_POPULATION`; it must be left unset otherwise.
- `primary_field_id` is required when `measurement_type = PERCENTAGE_OF_FIXED_POPULATION`, and
  must reference a field of type `TEXT` or `SELECT` (distinct-value counting doesn't make
  sense on numbers, dates, or booleans).
- **Delete vs. archive**: a KPI can only be **hard-deleted** if it has zero cases. A KPI with
  one or more cases must be **archived** instead, to preserve the audit trail. Archived KPIs
  are hidden from the dashboard and from "log a new case" pickers but remain viewable in a
  historical/reporting view and can be reactivated.

## 2. Field definitions (KpiFieldDefinition)

- A KPI needs at least one field definition before it can accept cases; a KPI can be saved as
  `Draft` with none, but cannot move to `Active` until its schema is defined.
- `field_key` is derived from `label` and is immutable after creation, so historical values
  keep resolving to the right field even if the label is later edited for display purposes.
- New fields can be added to an `Active` KPI at any time; existing cases simply show no value
  for a field added after they were created.
- Fields **cannot be hard-deleted once any case has a value for them** — instead they are
  deactivated (`is_active = false`): hidden from the "new case" form, but still shown (with
  their historical values) when viewing past cases.
- Changing a field's `field_type` after values exist is not allowed. To fix a mistake,
  deactivate the field and add a new one with the correct type.
- `SELECT` / `MULTI_SELECT` fields must define at least one option. Options can be appended
  freely; an option already used by an existing case value should not be renamed or removed
  (removing unused options is fine) — this keeps historical case data meaningful.

## 3. Cases (KpiEntry)

- `entry_date` is required.
- A case must supply a value for every field currently marked `is_required = true` on its
  KPI, evaluated against the fields active at the time the case is created.
- `counts_toward_target` defaults to `true`. The source document's qualification criteria
  (the "✅ counts if..." checklists) are **qualitative judgment calls**, not something the
  system can evaluate automatically — the app surfaces the checklist as an on-screen reminder
  when logging or editing a case, but the user decides the flag.
- Cases can be edited or deleted at any time by anyone with case-entry access. There is no
  period-locking in v1: editing or deleting a past case immediately changes the KPI's current
  computed value. (Flagged as an open question below if audit/lock requirements emerge later.)
- `evidence_source` is optional but should be encouraged in the UI (e.g. inline hint), since
  the source document treats an evidence reference as required for every KPI in practice.

## 4. Calculation & dashboard rules

- The current value is **recomputed on every case create/update/delete**, not cached — the
  dashboard always reflects live data.
- If the denominator is `0` (no cases yet for a percentage KPI, or `population_size` is unset
  for a not-yet-configured `PERCENTAGE_OF_FIXED_POPULATION` KPI), the dashboard shows **"No
  data yet"**, never `0%` or a calculation error.
- `COUNT` KPIs display as `current / target` (e.g. "8 / 12 reviews"). `PERCENTAGE_*` KPIs
  display as `current% / target%`.
- KPIs are grouped on the dashboard by their `theme` tag when set; untagged KPIs are listed
  individually.
- On-track / at-risk status badges are **not specified by the source document** and are left
  as a configurable threshold rather than hardcoded (see open questions).

## 5. Access (placeholder — not specified by source material)

No authentication/authorization model exists yet in this repo. Recommended default, to revisit
once auth is designed:

- KPI structural changes (create, edit, delete, archive, manage field definitions) — restricted
  to an "Admin" or "KPI Owner" role, since these are infrequent and affect calculation
  integrity for everyone.
- Logging/editing/deleting cases — open to any authenticated user, since this is the frequent,
  distributed activity the tool exists to support.

## 6. Open questions / assumptions to confirm

1. **Status snapshots**: the source doc includes narrative "Suggested Mid-Year Status" text
   per KPI. Modeled as an optional `KpiStatusSnapshot` entity in the data model but not treated
   as required for v1 (create/edit/delete KPI + log cases). Confirm whether it's in scope now.
2. **`population_size` history**: currently modeled as a single editable number with no
   version history (e.g., if "Total ITS Teams" grows from 6 to 8 mid-year, past percentages
   are not recalculated retroactively against the old value — the new value applies going
   forward only). Confirm this is acceptable, or whether population size needs its own
   dated history.
3. **On-track/at-risk thresholds**: not defined by the source document. Needs a product
   decision (e.g. "on track" = current ≥ target × (elapsed time / total period)?).
4. **Case editing/locking**: no period-locking exists in v1 — editing a January case in
   December still changes totals. Confirm this is fine, or whether closed reporting periods
   need to be frozen.
5. **Roles/authentication**: not designed here; section 5 above is a recommendation pending an
   actual auth model for the app.
