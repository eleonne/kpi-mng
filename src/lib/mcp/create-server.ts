import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import { getKpi, listArchivedKpis, listKpis, parseCriteria } from "@/lib/kpi-queries";
import { readFieldValue } from "@/lib/field-values";
import { serializeEntry, serializeFieldDefinition, serializeKpiDetail, serializeKpiListItem } from "@/lib/serializers";
import { kpiApiSchema, kpiBaseObjectSchema } from "@/lib/validation/kpi";
import { fieldDefinitionApiSchema, fieldDefinitionBaseSchema } from "@/lib/validation/field-definition";
import { buildEntryFieldValuesSchema, entryCoreSchema } from "@/lib/validation/entry";
import {
  activateKpiRecord,
  archiveKpiRecord,
  createKpiRecord,
  deleteKpiRecord,
  updateKpiRecord,
} from "@/lib/services/kpi-service";
import {
  addFieldDefinitionRecord,
  deactivateFieldDefinitionRecord,
  deleteFieldDefinitionRecord,
} from "@/lib/services/field-definition-service";
import {
  createEntryRecord,
  deleteEntryRecord,
  getActiveFieldDefinitions,
  updateEntryRecord,
} from "@/lib/services/entry-service";

/**
 * Tool definitions shared by both MCP transports:
 * - stdio, for local clients (Claude Code, Claude Desktop) — mcp/server.ts
 * - Streamable HTTP, for remote clients — src/app/api/mcp/route.ts
 *
 * Each call to createMcpServer() returns a fresh, independent McpServer
 * instance (cheap — registration is synchronous, no I/O), which is the
 * pattern the SDK's stateless HTTP examples use: one server+transport pair
 * per request, no shared mutable state between requests.
 *
 * A third thin entry point over the same lib/services/* functions the
 * Server Actions and the REST API (docs/api.md) use, so business rules stay
 * defined in exactly one place. See docs/mcp.md.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({ name: "kpi-dashboard", version: "0.1.0" });

  function ok(data: unknown): CallToolResult {
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }

  function fail(err: unknown): CallToolResult {
    const message = err instanceof AppError || err instanceof Error ? err.message : "Unknown error.";
    return { content: [{ type: "text", text: message }], isError: true };
  }

  // ---------------------------------------------------------------------------
  // KPIs
  // ---------------------------------------------------------------------------

  server.registerTool(
    "list_kpis",
    {
      title: "List KPIs",
      description: "List KPIs (default: non-archived, matching the dashboard) with their computed current value.",
      inputSchema: {
        includeArchived: z.boolean().optional().describe("List archived KPIs instead of active/draft ones."),
      },
    },
    async ({ includeArchived }) => {
      try {
        const kpis = includeArchived ? await listArchivedKpis() : await listKpis();
        return ok(kpis.map(serializeKpiListItem));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "get_kpi",
    {
      title: "Get KPI detail",
      description: "Full detail for one KPI: core fields, computed summary, field definitions, and cases.",
      inputSchema: { kpiId: z.string() },
    },
    async ({ kpiId }) => {
      try {
        const kpi = await getKpi(kpiId);
        if (!kpi) throw new NotFoundError("KPI not found.");
        return ok(serializeKpiDetail(kpi));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "create_kpi",
    {
      title: "Create KPI",
      description:
        "Create a new KPI. Always starts as DRAFT — add fields with add_kpi_field, then activate_kpi once it has at least one.",
      inputSchema: {
        ...kpiBaseObjectSchema.shape,
        qualificationCriteria: z
          .array(z.string())
          .optional()
          .describe('The "counts toward target if..." checklist, shown as a reminder when logging a case.'),
      },
    },
    async (args) => {
      try {
        const parsed = kpiApiSchema.parse(args);
        const kpi = await createKpiRecord(parsed);
        return ok(serializeKpiListItem({ ...kpi, entries: [], fieldDefinitions: [] }));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "update_kpi",
    {
      title: "Update KPI",
      description:
        'Partially update a KPI. Omit a field to leave it unchanged; send "" (not null) to clear an optional text field.',
      inputSchema: {
        kpiId: z.string(),
        name: kpiBaseObjectSchema.shape.name.optional(),
        theme: kpiBaseObjectSchema.shape.theme,
        objective: kpiBaseObjectSchema.shape.objective.optional(),
        owner: kpiBaseObjectSchema.shape.owner,
        measurementType: kpiBaseObjectSchema.shape.measurementType.optional(),
        targetValue: kpiBaseObjectSchema.shape.targetValue.optional(),
        targetUnit: kpiBaseObjectSchema.shape.targetUnit,
        targetPeriodLabel: kpiBaseObjectSchema.shape.targetPeriodLabel,
        measurementFormulaText: kpiBaseObjectSchema.shape.measurementFormulaText,
        qualificationCriteria: z.array(z.string()).optional(),
        populationSize: kpiBaseObjectSchema.shape.populationSize,
        primaryFieldKey: kpiBaseObjectSchema.shape.primaryFieldKey,
      },
    },
    async ({ kpiId, ...partial }) => {
      try {
        const current = await prisma.kpi.findUnique({ where: { id: kpiId } });
        if (!current) throw new NotFoundError("KPI not found.");

        const merged = {
          name: partial.name ?? current.name,
          theme: partial.theme ?? current.theme ?? undefined,
          objective: partial.objective ?? current.objective,
          owner: partial.owner ?? current.owner ?? undefined,
          measurementType: partial.measurementType ?? current.measurementType,
          targetValue: partial.targetValue ?? current.targetValue,
          targetUnit: partial.targetUnit ?? current.targetUnit ?? undefined,
          targetPeriodLabel: partial.targetPeriodLabel ?? current.targetPeriodLabel ?? undefined,
          measurementFormulaText:
            partial.measurementFormulaText ?? current.measurementFormulaText ?? undefined,
          qualificationCriteria: partial.qualificationCriteria ?? parseCriteria(current.qualificationCriteria),
          populationSize: partial.populationSize ?? current.populationSize ?? undefined,
          primaryFieldKey: partial.primaryFieldKey ?? current.primaryFieldKey ?? undefined,
        };

        const parsed = kpiApiSchema.parse(merged);
        await updateKpiRecord(kpiId, parsed);

        const updated = await getKpi(kpiId);
        return ok(serializeKpiDetail(updated!));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "delete_kpi",
    {
      title: "Delete KPI",
      description: "Hard-delete a KPI. Only allowed if it has zero logged cases — archive it instead otherwise.",
      inputSchema: { kpiId: z.string() },
    },
    async ({ kpiId }) => {
      try {
        await deleteKpiRecord(kpiId);
        return ok({ success: true });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "activate_kpi",
    {
      title: "Activate KPI",
      description:
        "Move a Draft/Archived KPI to Active. Fails if it has no active fields, or (for PERCENTAGE_OF_FIXED_POPULATION KPIs) no population size / primary field.",
      inputSchema: { kpiId: z.string() },
    },
    async ({ kpiId }) => {
      try {
        await activateKpiRecord(kpiId);
        const kpi = await getKpi(kpiId);
        if (!kpi) throw new NotFoundError("KPI not found.");
        return ok(serializeKpiDetail(kpi));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "archive_kpi",
    {
      title: "Archive KPI",
      description: "Hide a KPI from the dashboard while preserving its history. Reversible via activate_kpi.",
      inputSchema: { kpiId: z.string() },
    },
    async ({ kpiId }) => {
      try {
        await archiveKpiRecord(kpiId);
        const kpi = await getKpi(kpiId);
        if (!kpi) throw new NotFoundError("KPI not found.");
        return ok(serializeKpiDetail(kpi));
      } catch (err) {
        return fail(err);
      }
    },
  );

  // ---------------------------------------------------------------------------
  // Field definitions
  // ---------------------------------------------------------------------------

  server.registerTool(
    "list_kpi_fields",
    {
      title: "List a KPI's field definitions",
      description:
        "All field definitions for a KPI (active and inactive) — the schema a case's `fields` must satisfy.",
      inputSchema: { kpiId: z.string() },
    },
    async ({ kpiId }) => {
      try {
        const kpi = await prisma.kpi.findUnique({ where: { id: kpiId } });
        if (!kpi) throw new NotFoundError("KPI not found.");

        const fields = await prisma.kpiFieldDefinition.findMany({
          where: { kpiId },
          orderBy: { displayOrder: "asc" },
        });
        return ok(fields.map(serializeFieldDefinition));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "add_kpi_field",
    {
      title: "Add a field to a KPI",
      description:
        "Add a field a case can supply a value for. A unique fieldKey is derived from label and returned — use it (not the label) when submitting a case's `fields`.",
      inputSchema: {
        kpiId: z.string(),
        ...fieldDefinitionBaseSchema.shape,
        options: z
          .array(z.string())
          .optional()
          .describe("Required (non-empty) for SELECT/MULTI_SELECT fieldType, ignored otherwise."),
      },
    },
    async ({ kpiId, ...rest }) => {
      try {
        const parsed = fieldDefinitionApiSchema.parse(rest);
        const field = await addFieldDefinitionRecord(kpiId, parsed);
        return ok(serializeFieldDefinition(field));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "deactivate_kpi_field",
    {
      title: "Deactivate a KPI field",
      description:
        "Hide a field from future cases while preserving its historical values. Use this instead of delete_kpi_field once a field has recorded values.",
      inputSchema: { kpiId: z.string(), fieldId: z.string() },
    },
    async ({ kpiId, fieldId }) => {
      try {
        const field = await deactivateFieldDefinitionRecord(kpiId, fieldId);
        return ok(serializeFieldDefinition(field));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "delete_kpi_field",
    {
      title: "Delete a KPI field",
      description:
        "Hard-delete a field. Only allowed if no case has a recorded value for it (409-equivalent otherwise).",
      inputSchema: { kpiId: z.string(), fieldId: z.string() },
    },
    async ({ kpiId, fieldId }) => {
      try {
        await deleteFieldDefinitionRecord(kpiId, fieldId);
        return ok({ success: true });
      } catch (err) {
        return fail(err);
      }
    },
  );

  // ---------------------------------------------------------------------------
  // Cases (entries)
  // ---------------------------------------------------------------------------

  const caseFieldsSchema = z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Values keyed by fieldKey (see list_kpi_fields) — must satisfy every field currently marked isRequired.",
    );

  server.registerTool(
    "list_kpi_cases",
    {
      title: "List a KPI's cases",
      description: "All cases logged against a KPI, newest first, with resolved `fields` values.",
      inputSchema: { kpiId: z.string() },
    },
    async ({ kpiId }) => {
      try {
        const kpi = await prisma.kpi.findUnique({ where: { id: kpiId } });
        if (!kpi) throw new NotFoundError("KPI not found.");

        const entries = await prisma.kpiEntry.findMany({
          where: { kpiId },
          include: { fieldValues: { include: { fieldDefinition: true } } },
          orderBy: { entryDate: "desc" },
        });
        return ok(entries.map(serializeEntry));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "add_kpi_case",
    {
      title: "Add a case to a KPI",
      description:
        "Log one case (data point) against a KPI. The KPI needs at least one active field first. countsTowardTarget is a human judgment call against the KPI's qualification criteria — it is NOT auto-derived, set it explicitly.",
      inputSchema: {
        kpiId: z.string(),
        entryDate: z.string().describe("ISO date, e.g. 2026-01-15"),
        countsTowardTarget: z.boolean().optional().describe("Default true."),
        evidenceSource: z.string().optional(),
        notes: z.string().optional(),
        fields: caseFieldsSchema,
      },
    },
    async ({ kpiId, fields, ...core }) => {
      try {
        const activeFields = await getActiveFieldDefinitions(kpiId);
        const parsedCore = entryCoreSchema.parse(core);
        const parsedFields = buildEntryFieldValuesSchema(activeFields).parse(fields ?? {});

        const entry = await createEntryRecord(kpiId, parsedCore, parsedFields, activeFields);
        return ok(serializeEntry(entry));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "update_kpi_case",
    {
      title: "Update a case",
      description:
        "Partially update a case. Omit a core field or a fields.<key> entry to leave it unchanged. Only currently-active fields can be set.",
      inputSchema: {
        kpiId: z.string(),
        entryId: z.string(),
        entryDate: z.string().optional(),
        countsTowardTarget: z.boolean().optional(),
        evidenceSource: z.string().optional(),
        notes: z.string().optional(),
        fields: caseFieldsSchema,
      },
    },
    async ({ kpiId, entryId, fields, ...partial }) => {
      try {
        const current = await prisma.kpiEntry.findUnique({
          where: { id: entryId },
          include: { fieldValues: { include: { fieldDefinition: true } } },
        });
        if (!current || current.kpiId !== kpiId) throw new NotFoundError("Case not found.");

        const mergedCore = {
          entryDate: partial.entryDate ?? current.entryDate,
          countsTowardTarget: partial.countsTowardTarget ?? current.countsTowardTarget,
          evidenceSource: partial.evidenceSource ?? current.evidenceSource ?? undefined,
          notes: partial.notes ?? current.notes ?? undefined,
        };
        const parsedCore = entryCoreSchema.parse(mergedCore);

        const activeFields = await getActiveFieldDefinitions(kpiId);
        const currentFieldValues: Record<string, unknown> = {};
        for (const field of activeFields) {
          const stored = current.fieldValues.find((v) => v.fieldDefinitionId === field.id) ?? null;
          currentFieldValues[field.fieldKey] = readFieldValue(field.fieldType, stored) ?? undefined;
        }
        const mergedFields = { ...currentFieldValues, ...(fields ?? {}) };
        const parsedFields = buildEntryFieldValuesSchema(activeFields).parse(mergedFields);

        const updated = await updateEntryRecord(kpiId, entryId, parsedCore, parsedFields, activeFields);
        return ok(serializeEntry(updated));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "delete_kpi_case",
    {
      title: "Delete a case",
      description: "Delete one logged case.",
      inputSchema: { kpiId: z.string(), entryId: z.string() },
    },
    async ({ kpiId, entryId }) => {
      try {
        await deleteEntryRecord(kpiId, entryId);
        return ok({ success: true });
      } catch (err) {
        return fail(err);
      }
    },
  );

  return server;
}
