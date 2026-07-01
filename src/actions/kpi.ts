"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { kpiFormSchema } from "@/lib/validation/kpi";
import {
  activateKpiRecord,
  archiveKpiRecord,
  createKpiRecord,
  deleteKpiRecord,
  updateKpiRecord,
} from "@/lib/services/kpi-service";

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
} | undefined;

export async function createKpi(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = kpiFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  let kpiId: string;
  try {
    const kpi = await createKpiRecord(parsed.data);
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

  try {
    await updateKpiRecord(kpiId, parsed.data);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update KPI." };
  }

  revalidatePath("/");
  revalidatePath(`/kpis/${kpiId}`);
  redirect(`/kpis/${kpiId}`);
}

export async function activateKpi(kpiId: string) {
  await activateKpiRecord(kpiId);
  revalidatePath("/");
  revalidatePath(`/kpis/${kpiId}`);
}

export async function archiveKpi(kpiId: string) {
  await archiveKpiRecord(kpiId);
  revalidatePath("/");
  revalidatePath(`/kpis/${kpiId}`);
}

export async function deleteKpi(kpiId: string) {
  await deleteKpiRecord(kpiId);
  revalidatePath("/");
  redirect("/");
}
