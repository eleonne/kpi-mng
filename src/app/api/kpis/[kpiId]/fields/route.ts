import { NextRequest, NextResponse } from "next/server";
import { errorResponse, serializeFieldDefinition } from "@/lib/api-utils";
import { prisma } from "@/lib/db";
import { fieldDefinitionApiSchema } from "@/lib/validation/field-definition";
import { addFieldDefinitionRecord } from "@/lib/services/field-definition-service";
import { NotFoundError } from "@/lib/errors";

/** GET /api/kpis/:kpiId/fields — all field definitions (active and inactive). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ kpiId: string }> }) {
  try {
    const { kpiId } = await params;
    const kpi = await prisma.kpi.findUnique({ where: { id: kpiId } });
    if (!kpi) throw new NotFoundError("KPI not found.");

    const fields = await prisma.kpiFieldDefinition.findMany({
      where: { kpiId },
      orderBy: { displayOrder: "asc" },
    });
    return NextResponse.json(fields.map(serializeFieldDefinition));
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * POST /api/kpis/:kpiId/fields — add a field a case can supply a value for.
 * `fieldKey` is derived from `label` and returned in the response; use it
 * (not the label) as the key when submitting `fields` on a case.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ kpiId: string }> }) {
  try {
    const { kpiId } = await params;
    const body = await request.json();
    const parsed = fieldDefinitionApiSchema.parse(body);
    const field = await addFieldDefinitionRecord(kpiId, parsed);
    return NextResponse.json(serializeFieldDefinition(field), { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
