"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { buildEntryFieldValuesSchema, entryCoreSchema } from "@/lib/validation/entry";
import {
  createEntryRecord,
  deleteEntryRecord,
  getActiveFieldDefinitions,
  updateEntryRecord,
} from "@/lib/services/entry-service";
import { FieldType } from "@/generated/prisma/enums";
import type { KpiFieldDefinition } from "@/generated/prisma/client";
import type { ActionState } from "./kpi";

const FIELD_PREFIX = "field_";

function readDynamicRawValues(formData: FormData, fields: KpiFieldDefinition[]) {
  const raw: Record<string, unknown> = {};
  for (const field of fields) {
    const name = `${FIELD_PREFIX}${field.fieldKey}`;
    if (field.fieldType === FieldType.MULTI_SELECT) {
      raw[field.fieldKey] = formData.getAll(name);
    } else if (field.fieldType === FieldType.BOOLEAN) {
      raw[field.fieldKey] = formData.get(name) === "on";
    } else {
      const value = formData.get(name);
      raw[field.fieldKey] = value === null ? "" : value;
    }
  }
  return raw;
}

function parseEntryCore(formData: FormData) {
  return entryCoreSchema.safeParse({
    ...Object.fromEntries(formData),
    // Unchecked checkboxes are omitted from FormData entirely — resolve
    // presence explicitly rather than leaning on a zod default.
    countsTowardTarget: formData.has("countsTowardTarget"),
  });
}

export async function logKpiEntry(
  kpiId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const core = parseEntryCore(formData);
  if (!core.success) {
    return { fieldErrors: core.error.flatten().fieldErrors };
  }

  const fields = await getActiveFieldDefinitions(kpiId);
  const dynamicSchema = buildEntryFieldValuesSchema(fields);
  const dynamicParsed = dynamicSchema.safeParse(readDynamicRawValues(formData, fields));
  if (!dynamicParsed.success) {
    return { fieldErrors: dynamicParsed.error.flatten().fieldErrors };
  }

  try {
    await createEntryRecord(kpiId, core.data, dynamicParsed.data, fields);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to log case." };
  }

  revalidatePath(`/kpis/${kpiId}`);
  redirect(`/kpis/${kpiId}`);
}

export async function updateKpiEntry(
  kpiId: string,
  entryId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const core = parseEntryCore(formData);
  if (!core.success) {
    return { fieldErrors: core.error.flatten().fieldErrors };
  }

  const fields = await getActiveFieldDefinitions(kpiId);
  const dynamicSchema = buildEntryFieldValuesSchema(fields);
  const dynamicParsed = dynamicSchema.safeParse(readDynamicRawValues(formData, fields));
  if (!dynamicParsed.success) {
    return { fieldErrors: dynamicParsed.error.flatten().fieldErrors };
  }

  try {
    await updateEntryRecord(kpiId, entryId, core.data, dynamicParsed.data, fields);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update case." };
  }

  revalidatePath(`/kpis/${kpiId}`);
  redirect(`/kpis/${kpiId}`);
}

export async function deleteKpiEntry(kpiId: string, entryId: string) {
  await deleteEntryRecord(kpiId, entryId);
  revalidatePath(`/kpis/${kpiId}`);
}
