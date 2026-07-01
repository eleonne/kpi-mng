"use server";

import { revalidatePath } from "next/cache";
import { fieldDefinitionFormSchema } from "@/lib/validation/field-definition";
import {
  addFieldDefinitionRecord,
  deactivateFieldDefinitionRecord,
  deleteFieldDefinitionRecord,
} from "@/lib/services/field-definition-service";
import type { ActionState } from "./kpi";

export async function addKpiField(
  kpiId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = fieldDefinitionFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await addFieldDefinitionRecord(kpiId, parsed.data);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to add field." };
  }

  revalidatePath(`/kpis/${kpiId}`);
  revalidatePath(`/kpis/${kpiId}/edit`);
}

export async function deactivateKpiField(kpiId: string, fieldId: string) {
  await deactivateFieldDefinitionRecord(kpiId, fieldId);
  revalidatePath(`/kpis/${kpiId}`);
  revalidatePath(`/kpis/${kpiId}/edit`);
}

export async function deleteKpiField(kpiId: string, fieldId: string) {
  await deleteFieldDefinitionRecord(kpiId, fieldId);
  revalidatePath(`/kpis/${kpiId}`);
  revalidatePath(`/kpis/${kpiId}/edit`);
}
