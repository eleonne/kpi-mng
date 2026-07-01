import { NextRequest, NextResponse } from "next/server";
import { errorResponse, serializeKpiDetail } from "@/lib/api-utils";
import { getKpi } from "@/lib/kpi-queries";
import { activateKpiRecord } from "@/lib/services/kpi-service";
import { NotFoundError } from "@/lib/errors";

/**
 * POST /api/kpis/:kpiId/activate — moves a Draft KPI to Active. Fails with
 * 422 if activation preconditions aren't met (see docs/business-rules.md §1):
 * at least one active field, and for PERCENTAGE_OF_FIXED_POPULATION KPIs, a
 * population size and a Text/Select primary field.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ kpiId: string }> }) {
  try {
    const { kpiId } = await params;
    await activateKpiRecord(kpiId);

    const kpi = await getKpi(kpiId);
    if (!kpi) throw new NotFoundError("KPI not found.");
    return NextResponse.json(serializeKpiDetail(kpi));
  } catch (err) {
    return errorResponse(err);
  }
}
