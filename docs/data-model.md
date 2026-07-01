# KPI Dashboard — Data Model

Source: `kpis.docx` (PAHO Enterprise Architecture KPI framework — 11 KPIs across 5 themes:
Value & Impact, Communication & Engagement, Support & Standards, ARB Governance, Documentation).

## Why a configurable-fields design

Every KPI in the source document defines its own "Evidence Required" table — the fields you
fill in each time you log a case. These fields differ significantly per KPI (see
[Field catalogue](#field-catalogue-extracted-from-kpisdocx) below): a "Documented EA Impact
Case" needs `Benefit Type` and `Impact Description`; an "ARB Session" needs `Quorum Achieved`
and `Decisions Made`; none of these overlap cleanly into one fixed schema.

So the model separates **KPI definition** (name, target, formula) from **case schema**
(which fields a case for this KPI has) from **case data** (the actual values entered). This
lets you create a new KPI type later without a schema/code change — you just define its
fields.

## Entities

### 1. KPI

The definition of a single KPI (create/edit/delete/archive from the UI).

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | UUID | yes | Primary key |
| `name` | string | yes | Unique (case-insensitive) among non-archived KPIs |
| `theme` | string | no | Free-text grouping tag for dashboard sections, e.g. "ARB Governance" |
| `objective` | long text | yes | Why this KPI exists (source doc's "Objective") |
| `owner` | string | no | Person/role accountable for the KPI |
| `status` | enum | yes | `Draft`, `Active`, `Archived` |
| `measurement_type` | enum | yes | `COUNT`, `PERCENTAGE_OF_ENTRIES`, `PERCENTAGE_OF_FIXED_POPULATION` (see [Calculation](#calculating-the-current-value)) |
| `target_value` | decimal | yes | e.g. `5`, `90`, `12` |
| `target_unit` | string | no | Display label, e.g. "cases", "%", "sessions" |
| `target_period_label` | string | no | e.g. "Year-end 2026", "Q3 2026" |
| `measurement_formula_text` | text | no | Human-readable formula, copied from source doc, shown as help text |
| `qualification_criteria` | list of strings | no | The "✅ counts if..." checklist from the source doc; shown as a reminder when logging a case |
| `population_size` | integer | conditional | Required, must be > 0, only when `measurement_type = PERCENTAGE_OF_FIXED_POPULATION` (e.g. "Total ITS Teams = 6") |
| `primary_field_id` | FK → KpiFieldDefinition | conditional | The field used as a case's display label everywhere, and as the distinct-value key for `PERCENTAGE_OF_FIXED_POPULATION` |
| `created_at`, `updated_at`, `created_by` | metadata | yes | Audit trail |

### 2. KpiFieldDefinition

The configurable schema of a KPI's cases — one row per column in the source doc's "Evidence
Required" table.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | UUID | yes | Primary key |
| `kpi_id` | FK → KPI | yes | Owning KPI |
| `field_key` | slug | yes | Unique within the KPI, auto-generated from label, immutable |
| `label` | string | yes | e.g. "Benefit Type", "Alignment Status" |
| `field_type` | enum | yes | `TEXT`, `LONG_TEXT`, `NUMBER`, `DATE`, `BOOLEAN`, `SELECT`, `MULTI_SELECT` |
| `options` | list of strings | conditional | Required for `SELECT` / `MULTI_SELECT` |
| `help_text` | string | no | The source doc's "Description" column, e.g. "Recommendation provided by EA/ARB" |
| `is_required` | boolean | yes | Whether a case must supply this value |
| `display_order` | integer | yes | Form/column ordering |
| `is_active` | boolean | yes | Soft-delete flag — inactive fields are hidden from new-case forms but preserved on historical cases |

### 3. KpiEntry ("Case")

One recorded data point against a KPI — "enter a new case where I record the values used to
calculate the KPI."

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | UUID | yes | Primary key |
| `kpi_id` | FK → KPI | yes | Owning KPI |
| `entry_date` | date | yes | The date the case pertains to (review date, session date, engagement date, etc.) |
| `counts_toward_target` | boolean | yes | Default `true`. Whether this case satisfies the KPI's qualification criteria (numerator contributor) |
| `evidence_source` | string | no | Reference/link to supporting evidence (ARR, meeting minutes, SharePoint page, etc.) |
| `notes` | long text | no | Freeform commentary |
| `created_at`, `updated_at`, `created_by` | metadata | yes | Audit trail |

### 4. KpiEntryFieldValue

The actual data entered for each of a case's KPI-specific fields (the EAV table backing
`KpiFieldDefinition`).

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | UUID | yes | Primary key |
| `entry_id` | FK → KpiEntry | yes | Owning case |
| `field_definition_id` | FK → KpiFieldDefinition | yes | Which field this value is for |
| `value` | typed (text / number / date / boolean / string[]) | depends | Stored according to the field's `field_type` |

### 5. KpiStatusSnapshot *(optional, v2 candidate)*

Mirrors the source doc's "Suggested Mid-Year Status" narrative blurbs. Not required to
satisfy create/edit/delete-KPI and log-a-case, but noted here since the source document
treats it as part of KPI reporting.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `kpi_id` | FK → KPI | Owning KPI |
| `snapshot_date` | date | |
| `current_value_snapshot` | decimal | Computed value at time of writing, kept for historical record |
| `narrative` | long text | Free-text commentary, e.g. "3 initiated, 1 major technology standardization case identified" |
| `created_at`, `created_by` | metadata | |

## Calculating the "current value"

Recomputed on demand (on every case create/update/delete), never cached:

- **`COUNT`** — `current = COUNT(entries WHERE counts_toward_target = true)`
  Compared directly against `target_value` (e.g. "8 of 12 reviews completed").
- **`PERCENTAGE_OF_ENTRIES`** — `current = COUNT(qualifying entries) / COUNT(all entries) × 100`
  Used when every logged case represents one unit of the population being measured (e.g. every
  ARB-relevant project gets a case; qualifying ones are those actually reviewed).
- **`PERCENTAGE_OF_FIXED_POPULATION`** — `current = COUNT(DISTINCT value of primary_field WHERE counts_toward_target = true) / population_size × 100`
  Used when the population is an external constant larger than/independent of the number of
  cases logged (e.g. "ITS Teams Engaged" — total ITS teams is a fixed org fact; a team can have
  several engagement cases but should only count once).

If the denominator is `0` (no entries yet, or `population_size` unset), display **"No data
yet"** rather than `0%` or an error.

## Field catalogue (extracted from kpis.docx)

Reference schema per KPI, to be seeded as `KpiFieldDefinition` rows. `measurement_type` and
`primary_field` are this document's mapping of the source doc's formula into the model above.

| KPI | measurement_type | primary_field | Case fields (label — type) |
|---|---|---|---|
| Documented EA Impact Cases | COUNT | Project Name | Project Name — TEXT · Date — DATE · Situation — LONG_TEXT · EA Recommendation — LONG_TEXT · Outcome — LONG_TEXT · Benefit Type — SELECT (Risk Reduction, Standardization, Cost Avoidance, Delivery Acceleration, Security Improvement) · Impact Description — LONG_TEXT · Evidence Source — TEXT |
| Projects with EA-Driven Architectural Improvements | COUNT | Project Name | Project Name — TEXT · Type of Engagement — SELECT (Advisory, Architecture Review, ARB) · Improvement Identified — LONG_TEXT · Recommendation Implemented — BOOLEAN · Improvement Category — SELECT (Governance, Security, Integration, Technology, Documentation) · Evidence — TEXT |
| EA Presentations and Communications Delivered | COUNT | Topic | Date — DATE · Communication Type — SELECT (Presentation, Briefing, Email, SharePoint Update, Workshop, Other) · Audience — TEXT · Topic — TEXT · Participants — NUMBER · Outcome — LONG_TEXT · Evidence Source — TEXT |
| ITS Teams Engaged in EA/ARB | PERCENTAGE_OF_FIXED_POPULATION (`population_size` = total ITS teams) | Team Name | Team Name — TEXT · Engagement Date — DATE · Engagement Type — SELECT (ARB Participation, Briefing, Review, Advisory Session, Other) · Topic — TEXT · Participants — LONG_TEXT · Outcome — LONG_TEXT · Evidence — TEXT |
| Projects Supported with Enterprise Architecture | COUNT | Project Name | Project Name — TEXT · Engagement Date — DATE · Type of Support — SELECT (Architecture Review, Solution Design, Integration Guidance, Standards Advisory, Implementation Support) · Project Type — SELECT (Custom Development, Integration, SaaS, COTS, AI/Chatbot, Platform Enhancement) · EA Deliverable — SELECT (Solution Architecture, ARR, Standards Review, Advisory Recommendation) · Outcome — LONG_TEXT · Evidence Source — TEXT |
| Alignment with PAHO Technical Standards | PERCENTAGE_OF_ENTRIES | Project Name | Project Name — TEXT · Review Date — DATE · Standards Evaluated — MULTI_SELECT (Technology, Security, Integration, Documentation, Infrastructure) · Alignment Status — SELECT (Aligned, Partially Aligned, Non-Aligned) · Recommendation — LONG_TEXT · Final Outcome — LONG_TEXT · Evidence — TEXT |
| ARB Sessions Executed | PERCENTAGE_OF_ENTRIES | Session Date | Session Date — DATE · Session Status — SELECT (Held, Cancelled, Rescheduled) · Agenda Items — LONG_TEXT · Participants — LONG_TEXT · Quorum Achieved — BOOLEAN · Decisions Made — LONG_TEXT · Evidence Source — TEXT |
| Relevant Projects Reviewed by ARB | PERCENTAGE_OF_ENTRIES | Project Name | Project Name — TEXT · Review Date — DATE · Project Type — SELECT (SaaS, Custom Development, Integration, COTS, AI, Other) · Review Reason — LONG_TEXT · Review Outcome — SELECT (Approved, Approved with Recommendations, Rework Required, Deferred) · Evidence — TEXT |
| ARB Reviews Completed | COUNT | Project Name | Project Name — TEXT · Review Date — DATE · ARR Produced — BOOLEAN · Review Outcome — SELECT (Approved, Approved with Recommendations, Rework Required, Deferred) · Recommendations Issued — NUMBER · Stakeholder Notification — DATE · Evidence — TEXT |
| Architecture Template Adoption | PERCENTAGE_OF_ENTRIES | Project Name | Project Name — TEXT · Submission Date — DATE · Template Used — BOOLEAN · Completion Status — SELECT (Complete, Partial, In Progress) · Architecture Sections Completed — NUMBER (%) · Review Status — SELECT (Submitted, Reviewed, Approved) · Evidence — TEXT |
| Solution Architectures and ARR Artifacts Created | COUNT | Project Name | Project Name — TEXT · Artifact Type — SELECT (Solution Architecture, ARR) · Creation Date — DATE · Repository Location — TEXT · Review Status — SELECT (Draft, Final, Published) · Related ARB Review — BOOLEAN · Evidence — TEXT |

See [business-rules.md](business-rules.md) for how these entities behave (validation,
lifecycle, calculation edge cases, and open questions).
