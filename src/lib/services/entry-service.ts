import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { writeFieldValue } from "@/lib/field-values";
import type { EntryCoreValues } from "@/lib/validation/entry";
import type { KpiFieldDefinition } from "@/generated/prisma/client";

/**
 * Business-rule logic for KpiEntry ("cases"), shared by the Server Actions
 * (src/actions/entry.ts, FormData input) and the REST API
 * (src/app/api/kpis/[kpiId]/entries/**, JSON input). Both callers resolve
 * their own raw input into `Record<fieldKey, value>` and validate it against
 * `buildEntryFieldValuesSchema(fields)` before calling in here — this layer
 * only owns "does this KPI/entry exist" and the actual Prisma writes.
 */

export async function getActiveFieldDefinitions(kpiId: string): Promise<KpiFieldDefinition[]> {
  const kpi = await prisma.kpi.findUnique({ where: { id: kpiId } });
  if (!kpi) throw new NotFoundError("KPI not found.");

  return prisma.kpiFieldDefinition.findMany({
    where: { kpiId, isActive: true },
    orderBy: { displayOrder: "asc" },
  });
}

export async function createEntryRecord(
  kpiId: string,
  core: EntryCoreValues,
  fieldValues: Record<string, unknown>,
  fields: KpiFieldDefinition[],
) {
  return prisma.kpiEntry.create({
    data: {
      kpiId,
      entryDate: core.entryDate,
      countsTowardTarget: core.countsTowardTarget,
      evidenceSource: core.evidenceSource || null,
      notes: core.notes || null,
      fieldValues: {
        create: fields.map((field) => ({
          fieldDefinitionId: field.id,
          ...writeFieldValue(field.fieldType, fieldValues[field.fieldKey] as never),
        })),
      },
    },
    include: { fieldValues: { include: { fieldDefinition: true } } },
  });
}

async function getOwnedEntry(kpiId: string, entryId: string) {
  const entry = await prisma.kpiEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.kpiId !== kpiId) throw new NotFoundError("Case not found.");
  return entry;
}

export async function updateEntryRecord(
  kpiId: string,
  entryId: string,
  core: EntryCoreValues,
  fieldValues: Record<string, unknown>,
  fields: KpiFieldDefinition[],
) {
  await getOwnedEntry(kpiId, entryId);

  const [updated] = await prisma.$transaction([
    prisma.kpiEntry.update({
      where: { id: entryId },
      data: {
        entryDate: core.entryDate,
        countsTowardTarget: core.countsTowardTarget,
        evidenceSource: core.evidenceSource || null,
        notes: core.notes || null,
      },
    }),
    ...fields.map((field) =>
      prisma.kpiEntryFieldValue.upsert({
        where: { entryId_fieldDefinitionId: { entryId, fieldDefinitionId: field.id } },
        create: {
          entryId,
          fieldDefinitionId: field.id,
          ...writeFieldValue(field.fieldType, fieldValues[field.fieldKey] as never),
        },
        update: writeFieldValue(field.fieldType, fieldValues[field.fieldKey] as never),
      }),
    ),
  ]);

  return prisma.kpiEntry.findUniqueOrThrow({
    where: { id: updated.id },
    include: { fieldValues: { include: { fieldDefinition: true } } },
  });
}

export async function deleteEntryRecord(kpiId: string, entryId: string) {
  await getOwnedEntry(kpiId, entryId);
  await prisma.kpiEntry.delete({ where: { id: entryId } });
}
