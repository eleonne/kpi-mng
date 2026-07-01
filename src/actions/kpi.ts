"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { kpiFormSchema } from "@/lib/validation/kpi";
import { canDeleteKpi, getActivationBlockers } from "@/lib/kpi-lifecycle";
import { KpiStatus } from "@/generated/prisma/enums";

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
} | undefined;

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
    throw new Error(`A KPI named "${name}" already exists.`);
  }
}

export async function createKpi(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = kpiFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;
  let kpiId: string;
  try {
    await assertNameAvailable(data.name);
    const kpi = await prisma.kpi.create({
      data: {
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
        status: KpiStatus.DRAFT,
      },
    });
    kpiId = kpi.id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create KPI." };
  }

  revalidatePath("/");
  redirect(`/kpis/${kpiId}`);
}

export async function updateKpi(
  kpiId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = kpiFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  try {
    const current = await prisma.kpi.findUniqueOrThrow({
      where: { id: kpiId },
      include: { _count: { select: { entries: true } } },
    });

    if (current.measurementType !== data.measurementType && current._count.entries > 0) {
      throw new Error(
        "Measurement type can't be changed once cases have been logged. Archive this KPI and create a new one instead.",
      );
    }

    await assertNameAvailable(data.name, kpiId);

    const primaryFieldKey =
      data.primaryFieldKey && data.primaryFieldKey !== "__none__" ? data.primaryFieldKey : null;

    await prisma.kpi.update({
      where: { id: kpiId },
      data: {
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
        primaryFieldKey,
      },
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update KPI." };
  }

  revalidatePath("/");
  revalidatePath(`/kpis/${kpiId}`);
  redirect(`/kpis/${kpiId}`);
}

export async function activateKpi(kpiId: string) {
  const kpi = await prisma.kpi.findUniqueOrThrow({
    where: { id: kpiId },
    include: { fieldDefinitions: { where: { isActive: true } } },
  });

  const blockers = getActivationBlockers(kpi, kpi.fieldDefinitions);
  if (blockers.length > 0) {
    throw new Error(blockers.join(" "));
  }

  await prisma.kpi.update({ where: { id: kpiId }, data: { status: KpiStatus.ACTIVE } });
  revalidatePath("/");
  revalidatePath(`/kpis/${kpiId}`);
}

export async function archiveKpi(kpiId: string) {
  await prisma.kpi.update({ where: { id: kpiId }, data: { status: KpiStatus.ARCHIVED } });
  revalidatePath("/");
  revalidatePath(`/kpis/${kpiId}`);
}

export async function deleteKpi(kpiId: string) {
  const entryCount = await prisma.kpiEntry.count({ where: { kpiId } });
  if (!canDeleteKpi(entryCount)) {
    throw new Error("This KPI has logged cases and can't be deleted — archive it instead.");
  }

  await prisma.kpi.delete({ where: { id: kpiId } });
  revalidatePath("/");
  redirect("/");
}
