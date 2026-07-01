import { prisma } from "@/lib/db";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { canHardDeleteField } from "@/lib/kpi-lifecycle";
import type { FieldDefinitionApiValues } from "@/lib/validation/field-definition";
import { slugifyFieldKey } from "@/lib/validation/field-definition";

/**
 * Business-rule logic for KpiFieldDefinition, shared by the Server Actions
 * (src/actions/field-definition.ts, form input) and the REST API
 * (src/app/api/kpis/[kpiId]/fields/**, JSON input).
 */

export async function addFieldDefinitionRecord(kpiId: string, data: FieldDefinitionApiValues) {
  const kpi = await prisma.kpi.findUnique({ where: { id: kpiId } });
  if (!kpi) throw new NotFoundError("KPI not found.");

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

  return prisma.kpiFieldDefinition.create({
    data: {
      kpiId,
      fieldKey,
      label: data.label,
      fieldType: data.fieldType,
      options: data.options.length > 0 ? JSON.stringify(data.options) : null,
      helpText: data.helpText || null,
      isRequired: data.isRequired,
      displayOrder: nextOrder,
    },
  });
}

async function getOwnedField(kpiId: string, fieldId: string) {
  const field = await prisma.kpiFieldDefinition.findUnique({ where: { id: fieldId } });
  if (!field || field.kpiId !== kpiId) throw new NotFoundError("Field not found.");
  return field;
}

export async function deactivateFieldDefinitionRecord(kpiId: string, fieldId: string) {
  await getOwnedField(kpiId, fieldId);

  return prisma.$transaction(async (tx) => {
    const field = await tx.kpiFieldDefinition.update({
      where: { id: fieldId },
      data: { isActive: false },
    });

    // A deactivated field can no longer serve as the KPI's primary field.
    await tx.kpi.updateMany({
      where: { id: kpiId, primaryFieldKey: field.fieldKey },
      data: { primaryFieldKey: null },
    });

    return field;
  });
}

export async function deleteFieldDefinitionRecord(kpiId: string, fieldId: string) {
  await getOwnedField(kpiId, fieldId);

  const valueCount = await prisma.kpiEntryFieldValue.count({ where: { fieldDefinitionId: fieldId } });
  if (!canHardDeleteField(valueCount)) {
    throw new ConflictError("This field has recorded values and can't be deleted — deactivate it instead.");
  }

  await prisma.kpiFieldDefinition.delete({ where: { id: fieldId } });
}
