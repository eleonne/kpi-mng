import { NextRequest, NextResponse } from "next/server";
import { errorResponse, serializeEntry } from "@/lib/api-utils";
import { prisma } from "@/lib/db";
import { readFieldValue } from "@/lib/field-values";
import { buildEntryFieldValuesSchema, entryCoreSchema } from "@/lib/validation/entry";
import {
  deleteEntryRecord,
  getActiveFieldDefinitions,
  updateEntryRecord,
} from "@/lib/services/entry-service";
import { NotFoundError } from "@/lib/errors";

async function loadOwnedEntry(kpiId: string, entryId: string) {
  const entry = await prisma.kpiEntry.findUnique({
    where: { id: entryId },
    include: { fieldValues: { include: { fieldDefinition: true } } },
  });
  if (!entry || entry.kpiId !== kpiId) throw new NotFoundError("Case not found.");
  return entry;
}

/** GET /api/kpis/:kpiId/entries/:entryId */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ kpiId: string; entryId: string }> },
) {
  try {
    const { kpiId, entryId } = await params;
    const entry = await loadOwnedEntry(kpiId, entryId);
    return NextResponse.json(serializeEntry(entry));
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * PATCH /api/kpis/:kpiId/entries/:entryId — partial update. Omitted core
 * fields and omitted entries in `fields` keep their current value. Only
 * currently-active fields can be set (matches the "log a case" form).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ kpiId: string; entryId: string }> },
) {
  try {
    const { kpiId, entryId } = await params;
    const current = await loadOwnedEntry(kpiId, entryId);
    const body = await request.json();

    const mergedCore = {
      entryDate: body.entryDate ?? current.entryDate,
      countsTowardTarget: body.countsTowardTarget ?? current.countsTowardTarget,
      evidenceSource: body.evidenceSource ?? current.evidenceSource ?? undefined,
      notes: body.notes ?? current.notes ?? undefined,
    };
    const core = entryCoreSchema.parse(mergedCore);

    const activeFields = await getActiveFieldDefinitions(kpiId);
    const currentFieldValues: Record<string, unknown> = {};
    for (const field of activeFields) {
      const stored = current.fieldValues.find((v) => v.fieldDefinitionId === field.id) ?? null;
      currentFieldValues[field.fieldKey] = readFieldValue(field.fieldType, stored) ?? undefined;
    }
    const mergedFields = { ...currentFieldValues, ...(body.fields ?? {}) };
    const fieldValues = buildEntryFieldValuesSchema(activeFields).parse(mergedFields);

    const updated = await updateEntryRecord(kpiId, entryId, core, fieldValues, activeFields);
    return NextResponse.json(serializeEntry(updated));
  } catch (err) {
    return errorResponse(err);
  }
}

/** DELETE /api/kpis/:kpiId/entries/:entryId */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ kpiId: string; entryId: string }> },
) {
  try {
    const { kpiId, entryId } = await params;
    await deleteEntryRecord(kpiId, entryId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
