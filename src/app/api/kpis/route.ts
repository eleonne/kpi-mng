import { NextRequest, NextResponse } from "next/server";
import { errorResponse, serializeKpiListItem } from "@/lib/api-utils";
import { listArchivedKpis, listKpis } from "@/lib/kpi-queries";
import { kpiApiSchema } from "@/lib/validation/kpi";
import { createKpiRecord } from "@/lib/services/kpi-service";

/** GET /api/kpis?includeArchived=true */
export async function GET(request: NextRequest) {
  try {
    const includeArchived = request.nextUrl.searchParams.get("includeArchived") === "true";
    const kpis = includeArchived ? await listArchivedKpis() : await listKpis();
    return NextResponse.json(kpis.map(serializeKpiListItem));
  } catch (err) {
    return errorResponse(err);
  }
}

/** POST /api/kpis — create a new KPI (always starts as DRAFT). */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = kpiApiSchema.parse(body);
    const kpi = await createKpiRecord(parsed);
    return NextResponse.json(serializeKpiListItem({ ...kpi, entries: [], fieldDefinitions: [] }), {
      status: 201,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
