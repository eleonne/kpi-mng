"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { fieldDefinitionFormSchema, slugifyFieldKey } from "@/lib/validation/field-definition";
import { canHardDeleteField } from "@/lib/kpi-lifecycle";
import type { ActionState } from "./kpi";

export async function addKpiField(
  kpiId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = Object.fromEntries(formData);
  const parsed = fieldDefinitionFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  try {
    const existingFields = await prisma.kpiFieldDefinition.findMany({
      where: { kpiId },
      select: { fieldKey: true, displayOrder: true },
    });

    const baseKey = slugifyFieldKey(data.label) || "field";
    let fieldKey = baseKey;
    let suffix = 2;
    const existingKeys = new Set(existingFields.map((f) => f.fieldKey));
    while (existingKeys.has(fieldKey)) {
      fieldKey = `${baseKey}_${suffix++}`;
    }

    const nextOrder = existingFields.reduce((max, f) => Math.max(max, f.displayOrder), -1) + 1;

    await prisma.kpiFieldDefinition.create({
      data: {
        kpiId,
        fieldKey,
        label: data.label,
        fieldType: data.fieldType,
        options: data.optionsText.length > 0 ? JSON.stringify(data.optionsText) : null,
        helpText: data.helpText || null,
        isRequired: data.isRequired,
        displayOrder: nextOrder,
      },
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to add field." };
  }

  revalidatePath(`/kpis/${kpiId}`);
  revalidatePath(`/kpis/${kpiId}/edit`);
}

export async function deactivateKpiField(kpiId: string, fieldId: string) {
  await prisma.$transaction(async (tx) => {
    const field = await tx.kpiFieldDefinition.update({
      where: { id: fieldId },
      data: { isActive: false },
    });

    // A deactivated field can no longer serve as the KPI's primary field.
    await tx.kpi.updateMany({
      where: { id: kpiId, primaryFieldKey: field.fieldKey },
      data: { primaryFieldKey: null },
    });
  });

  revalidatePath(`/kpis/${kpiId}`);
  revalidatePath(`/kpis/${kpiId}/edit`);
}

export async function deleteKpiField(kpiId: string, fieldId: string) {
  const valueCount = await prisma.kpiEntryFieldValue.count({ where: { fieldDefinitionId: fieldId } });
  if (!canHardDeleteField(valueCount)) {
    throw new Error("This field has recorded values and can't be deleted — deactivate it instead.");
  }

  await prisma.kpiFieldDefinition.delete({ where: { id: fieldId } });
  revalidatePath(`/kpis/${kpiId}`);
  revalidatePath(`/kpis/${kpiId}/edit`);
}
