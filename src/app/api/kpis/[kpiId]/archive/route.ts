import { NextRequest, NextResponse } from "next/server";
import { errorResponse, serializeKpiDetail } from "@/lib/api-utils";
import { getKpi } from "@/lib/kpi-queries";
import { archiveKpiRecord } from "@/lib/services/kpi-service";
import { NotFoundError } from "@/lib/errors";

/** POST /api/kpis/:kpiId/archive — hides the KPI from the dashboard, preserving its history. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ kpiId: string }> }) {
  try {
    const { kpiId } = await params;
    await archiveKpiRecord(kpiId);

    const kpi = await getKpi(kpiId);
    if (!kpi) throw new NotFoundError("KPI not found.");
    return NextResponse.json(serializeKpiDetail(kpi));
  } catch (err) {
    return errorResponse(err);
  }
}
