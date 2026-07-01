import { prisma } from "@/lib/db";
import { AppError, BusinessRuleError, ConflictError, NotFoundError } from "@/lib/errors";
import { canDeleteKpi, getActivationBlockers } from "@/lib/kpi-lifecycle";
import { KpiStatus } from "@/generated/prisma/enums";
import type { KpiFormValues } from "@/lib/validation/kpi";

/**
 * Business-rule logic for the Kpi entity, shared by the Server Actions
 * (src/actions/kpi.ts, form input) and the REST API (src/app/api/kpis/**,
 * JSON input) so neither has to re-implement uniqueness/activation/deletion
 * rules from docs/business-rules.md §1.
 */

async function assertNameAvailable(name: string, ignoreKpiId?: string) {
  // Simplification: uniqueness is enforced case-insensitively across ALL KPIs
  // (not just non-archived ones, as docs/business-rules.md §1 technically
  // scopes it) — SQLite has no case-insensitive unique index via Prisma, and
  // reusing an archived KPI's exact name is a rare enough edge case to defer.
  const existing = await prisma.kpi.findMany({ select: { id: true, name: true } });
  const clash = existing.find(
    (k) => k.id !== ignoreKpiId && k.name.toLowerCase() === name.toLowerCase(),
  );
  if (clash) {
    throw new ConflictError(`A KPI named "${name}" already exists.`);
  }
}

function toKpiData(data: KpiFormValues) {
  return {
    name: data.name,
    theme: data.theme || null,
    objective: data.objective,
    owner: data.owner || null,
    measurementType: data.measurementType,
    targetValue: data.targetValue,
    targetUnit: data.targetUnit || null,
    targetPeriodLabel: data.targetPeriodLabel || null,
    measurementFormulaText: data.measurementFormulaText || null,
    qualificationCriteria: JSON.stringify(data.qualificationCriteria),
    populationSize: data.populationSize ?? null,
  };
}

export async function createKpiRecord(data: KpiFormValues) {
  await assertNameAvailable(data.name);
  return prisma.kpi.create({
    data: { ...toKpiData(data), status: KpiStatus.DRAFT },
  });
}

export async function updateKpiRecord(kpiId: string, data: KpiFormValues) {
  const current = await prisma.kpi.findUnique({
    where: { id: kpiId },
    include: { _count: { select: { entries: true } } },
  });
  if (!current) throw new NotFoundError("KPI not found.");

  if (current.measurementType !== data.measurementType && current._count.entries > 0) {
    throw new ConflictError(
      "Measurement type can't be changed once cases have been logged. Archive this KPI and create a new one instead.",
    );
  }

  await assertNameAvailable(data.name, kpiId);

  const primaryFieldKey =
    data.primaryFieldKey && data.primaryFieldKey !== "__none__" ? data.primaryFieldKey : null;

  return prisma.kpi.update({
    where: { id: kpiId },
    data: { ...toKpiData(data), primaryFieldKey },
  });
}

export async function activateKpiRecord(kpiId: string) {
  const kpi = await prisma.kpi.findUnique({
    where: { id: kpiId },
    include: { fieldDefinitions: { where: { isActive: true } } },
  });
  if (!kpi) throw new NotFoundError("KPI not found.");

  const blockers = getActivationBlockers(kpi, kpi.fieldDefinitions);
  if (blockers.length > 0) throw new BusinessRuleError(blockers.join(" "));

  return prisma.kpi.update({ where: { id: kpiId }, data: { status: KpiStatus.ACTIVE } });
}

export async function archiveKpiRecord(kpiId: string) {
  const kpi = await prisma.kpi.findUnique({ where: { id: kpiId } });
  if (!kpi) throw new NotFoundError("KPI not found.");

  return prisma.kpi.update({ where: { id: kpiId }, data: { status: KpiStatus.ARCHIVED } });
}

export async function deleteKpiRecord(kpiId: string) {
  const kpi = await prisma.kpi.findUnique({ where: { id: kpiId } });
  if (!kpi) throw new NotFoundError("KPI not found.");

  const entryCount = await prisma.kpiEntry.count({ where: { kpiId } });
  if (!canDeleteKpi(entryCount)) {
    throw new AppError("This KPI has logged cases and can't be deleted — archive it instead.", 409);
  }

  await prisma.kpi.delete({ where: { id: kpiId } });
}
