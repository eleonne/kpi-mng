import { NextRequest, NextResponse } from "next/server";
import { errorResponse, serializeEntry } from "@/lib/api-utils";
import { prisma } from "@/lib/db";
import { buildEntryFieldValuesSchema, entryCoreSchema } from "@/lib/validation/entry";
import { createEntryRecord, getActiveFieldDefinitions } from "@/lib/services/entry-service";
import { NotFoundError } from "@/lib/errors";

/** GET /api/kpis/:kpiId/entries — all logged cases for this KPI, newest first. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ kpiId: string }> }) {
  try {
    const { kpiId } = await params;
    const kpi = await prisma.kpi.findUnique({ where: { id: kpiId } });
    if (!kpi) throw new NotFoundError("KPI not found.");

    const entries = await prisma.kpiEntry.findMany({
      where: { kpiId },
      include: { fieldValues: { include: { fieldDefinition: true } } },
      orderBy: { entryDate: "desc" },
    });
    return NextResponse.json(entries.map(serializeEntry));
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * POST /api/kpis/:kpiId/entries — add a case. Body: `entryDate` (required),
 * `countsTowardTarget` (default true), `evidenceSource`, `notes`, and
 * `fields` — an object keyed by each active field's `fieldKey` (see
 * GET /api/kpis/:kpiId/fields). A KPI needs at least one active field before
 * it can accept cases.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ kpiId: string }> }) {
  try {
    const { kpiId } = await params;
    const body = await request.json();

    const fields = await getActiveFieldDefinitions(kpiId);
    const core = entryCoreSchema.parse(body);
    const fieldValues = buildEntryFieldValuesSchema(fields).parse(body.fields ?? {});

    const entry = await createEntryRecord(kpiId, core, fieldValues, fields);
    return NextResponse.json(serializeEntry(entry), { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
