import { NextRequest, NextResponse } from "next/server";
import { errorResponse, serializeKpiDetail } from "@/lib/api-utils";
import { getKpi, parseCriteria } from "@/lib/kpi-queries";
import { kpiApiSchema } from "@/lib/validation/kpi";
import { deleteKpiRecord, updateKpiRecord } from "@/lib/services/kpi-service";
import { NotFoundError } from "@/lib/errors";

async function loadKpiOrThrow(kpiId: string) {
  const kpi = await getKpi(kpiId);
  if (!kpi) throw new NotFoundError("KPI not found.");
  return kpi;
}

/** GET /api/kpis/:kpiId — full detail: fields, cases, and computed summary. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ kpiId: string }> }) {
  try {
    const { kpiId } = await params;
    const kpi = await loadKpiOrThrow(kpiId);
    return NextResponse.json(serializeKpiDetail(kpi));
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * PATCH /api/kpis/:kpiId — partial update. Any field omitted from the body
 * keeps its current value (send `""` rather than `null` to clear an optional
 * text field — see docs/api.md).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ kpiId: string }> }) {
  try {
    const { kpiId } = await params;
    const current = await loadKpiOrThrow(kpiId);
    const body = await request.json();

    const merged = {
      name: body.name ?? current.name,
      theme: body.theme ?? current.theme ?? undefined,
      objective: body.objective ?? current.objective,
      owner: body.owner ?? current.owner ?? undefined,
      measurementType: body.measurementType ?? current.measurementType,
      targetValue: body.targetValue ?? current.targetValue,
      targetUnit: body.targetUnit ?? current.targetUnit ?? undefined,
      targetPeriodLabel: body.targetPeriodLabel ?? current.targetPeriodLabel ?? undefined,
      measurementFormulaText: body.measurementFormulaText ?? current.measurementFormulaText ?? undefined,
      qualificationCriteria: body.qualificationCriteria ?? parseCriteria(current.qualificationCriteria),
      populationSize: body.populationSize ?? current.populationSize ?? undefined,
      primaryFieldKey: body.primaryFieldKey ?? current.primaryFieldKey ?? undefined,
    };

    const parsed = kpiApiSchema.parse(merged);
    await updateKpiRecord(kpiId, parsed);

    const updated = await loadKpiOrThrow(kpiId);
    return NextResponse.json(serializeKpiDetail(updated));
  } catch (err) {
    return errorResponse(err);
  }
}

/** DELETE /api/kpis/:kpiId — only allowed when the KPI has no logged cases. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ kpiId: string }> }) {
  try {
    const { kpiId } = await params;
    await deleteKpiRecord(kpiId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
