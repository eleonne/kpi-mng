import { prisma } from "@/lib/db";
import { KpiStatus } from "@/generated/prisma/enums";

export const kpiWithEntriesInclude = {
  entries: {
    include: { fieldValues: { include: { fieldDefinition: true } } },
    orderBy: { entryDate: "desc" as const },
  },
  fieldDefinitions: { orderBy: { displayOrder: "asc" as const } },
} as const;

/**
 * Archived KPIs are hidden from the main dashboard per docs/business-rules.md
 * §1, but remain viewable via listArchivedKpis() below.
 */
export function listKpis() {
  return prisma.kpi.findMany({
    where: { status: { not: KpiStatus.ARCHIVED } },
    include: kpiWithEntriesInclude,
    orderBy: [{ theme: "asc" }, { name: "asc" }],
  });
}

export function listArchivedKpis() {
  return prisma.kpi.findMany({
    where: { status: KpiStatus.ARCHIVED },
    include: kpiWithEntriesInclude,
    orderBy: [{ name: "asc" }],
  });
}

export function getKpi(kpiId: string) {
  return prisma.kpi.findUnique({
    where: { id: kpiId },
    include: kpiWithEntriesInclude,
  });
}

export function parseCriteria(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
