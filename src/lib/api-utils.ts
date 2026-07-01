import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { parseCriteria } from "@/lib/kpi-queries";
import { readFieldValue } from "@/lib/field-values";
import {
  summarizeKpi,
  type KpiEntryWithValues,
  type KpiWithEntriesAndFields,
} from "@/lib/calculations/kpi-summary";
import type { Kpi, KpiFieldDefinition } from "@/generated/prisma/client";

/** Maps a thrown error to a consistent `{ error, fieldErrors? }` JSON response. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", fieldErrors: err.flatten().fieldErrors },
      { status: 400 },
    );
  }
  console.error(err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export function serializeFieldDefinition(field: KpiFieldDefinition) {
  return {
    id: field.id,
    kpiId: field.kpiId,
    fieldKey: field.fieldKey,
    label: field.label,
    fieldType: field.fieldType,
    options: field.options ? (JSON.parse(field.options) as string[]) : null,
    helpText: field.helpText,
    isRequired: field.isRequired,
    displayOrder: field.displayOrder,
    isActive: field.isActive,
    createdAt: field.createdAt,
    updatedAt: field.updatedAt,
  };
}

/** Flattens the entry's EAV field values into `{ fieldKey: value }`, keyed by
 * fieldKey rather than exposing the underlying typed-column storage shape. */
export function serializeEntry(entry: KpiEntryWithValues) {
  const fields: Record<string, ReturnType<typeof readFieldValue>> = {};
  for (const value of entry.fieldValues) {
    fields[value.fieldDefinition.fieldKey] = readFieldValue(value.fieldDefinition.fieldType, value);
  }

  return {
    id: entry.id,
    kpiId: entry.kpiId,
    entryDate: entry.entryDate,
    countsTowardTarget: entry.countsTowardTarget,
    evidenceSource: entry.evidenceSource,
    notes: entry.notes,
    fields,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

/** Base KPI fields shared by both list and detail responses. */
function serializeKpiCore(kpi: Kpi) {
  return {
    id: kpi.id,
    name: kpi.name,
    theme: kpi.theme,
    objective: kpi.objective,
    owner: kpi.owner,
    status: kpi.status,
    measurementType: kpi.measurementType,
    targetValue: kpi.targetValue,
    targetUnit: kpi.targetUnit,
    targetPeriodLabel: kpi.targetPeriodLabel,
    measurementFormulaText: kpi.measurementFormulaText,
    qualificationCriteria: parseCriteria(kpi.qualificationCriteria),
    populationSize: kpi.populationSize,
    primaryFieldKey: kpi.primaryFieldKey,
    createdAt: kpi.createdAt,
    updatedAt: kpi.updatedAt,
  };
}

/** For list endpoints: core fields + computed summary, no nested collections. */
export function serializeKpiListItem(kpi: KpiWithEntriesAndFields) {
  return { ...serializeKpiCore(kpi), summary: summarizeKpi(kpi) };
}

/** For detail endpoints: core fields + summary + fields/cases. */
export function serializeKpiDetail(kpi: KpiWithEntriesAndFields) {
  return {
    ...serializeKpiCore(kpi),
    summary: summarizeKpi(kpi),
    fieldDefinitions: kpi.fieldDefinitions.map(serializeFieldDefinition),
    entries: kpi.entries.map(serializeEntry),
  };
}
