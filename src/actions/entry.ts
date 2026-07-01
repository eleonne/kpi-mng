"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { buildEntryFieldValuesSchema, entryCoreSchema } from "@/lib/validation/entry";
import { writeFieldValue } from "@/lib/field-values";
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

async function loadActiveFields(kpiId: string) {
  return prisma.kpiFieldDefinition.findMany({
    where: { kpiId, isActive: true },
    orderBy: { displayOrder: "asc" },
  });
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

  const fields = await loadActiveFields(kpiId);
  const dynamicSchema = buildEntryFieldValuesSchema(fields);
  const dynamicParsed = dynamicSchema.safeParse(readDynamicRawValues(formData, fields));
  if (!dynamicParsed.success) {
    return { fieldErrors: dynamicParsed.error.flatten().fieldErrors };
  }

  await prisma.kpiEntry.create({
    data: {
      kpiId,
      entryDate: core.data.entryDate,
      countsTowardTarget: core.data.countsTowardTarget,
      evidenceSource: core.data.evidenceSource || null,
      notes: core.data.notes || null,
      fieldValues: {
        create: fields.map((field) => ({
          fieldDefinitionId: field.id,
          ...writeFieldValue(
            field.fieldType,
            dynamicParsed.data[field.fieldKey as keyof typeof dynamicParsed.data] as never,
          ),
        })),
      },
    },
  });

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

  const fields = await loadActiveFields(kpiId);
  const dynamicSchema = buildEntryFieldValuesSchema(fields);
  const dynamicParsed = dynamicSchema.safeParse(readDynamicRawValues(formData, fields));
  if (!dynamicParsed.success) {
    return { fieldErrors: dynamicParsed.error.flatten().fieldErrors };
  }

  await prisma.$transaction([
    prisma.kpiEntry.update({
      where: { id: entryId },
      data: {
        entryDate: core.data.entryDate,
        countsTowardTarget: core.data.countsTowardTarget,
        evidenceSource: core.data.evidenceSource || null,
        notes: core.data.notes || null,
      },
    }),
    ...fields.map((field) =>
      prisma.kpiEntryFieldValue.upsert({
        where: { entryId_fieldDefinitionId: { entryId, fieldDefinitionId: field.id } },
        create: {
          entryId,
          fieldDefinitionId: field.id,
          ...writeFieldValue(
            field.fieldType,
            dynamicParsed.data[field.fieldKey as keyof typeof dynamicParsed.data] as never,
          ),
        },
        update: writeFieldValue(
          field.fieldType,
          dynamicParsed.data[field.fieldKey as keyof typeof dynamicParsed.data] as never,
        ),
      }),
    ),
  ]);

  revalidatePath(`/kpis/${kpiId}`);
  redirect(`/kpis/${kpiId}`);
}

export async function deleteKpiEntry(kpiId: string, entryId: string) {
  await prisma.kpiEntry.delete({ where: { id: entryId } });
  revalidatePath(`/kpis/${kpiId}`);
}
