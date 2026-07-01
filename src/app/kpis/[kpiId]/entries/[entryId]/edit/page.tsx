import { notFound } from "next/navigation";
import { getKpi } from "@/lib/kpi-queries";
import { updateKpiEntry } from "@/actions/entry";
import { EntryForm } from "@/components/kpi/entry-form";
import { readFieldValue } from "@/lib/field-values";
import type { FieldValue } from "@/lib/field-values";

export default async function EditEntryPage({
  params,
}: {
  params: Promise<{ kpiId: string; entryId: string }>;
}) {
  const { kpiId, entryId } = await params;
  const kpi = await getKpi(kpiId);
  if (!kpi) notFound();

  const entry = kpi.entries.find((e) => e.id === entryId);
  if (!entry) notFound();

  // Editing only exposes currently-active fields, consistent with the
  // "new case" form — a field deactivated after this entry was created keeps
  // its stored value (visible when browsing the case list) but isn't editable
  // here until reactivated.
  const activeFields = kpi.fieldDefinitions.filter((f) => f.isActive);

  const fieldValues: Record<string, FieldValue> = {};
  for (const field of activeFields) {
    fieldValues[field.fieldKey] = readFieldValue(
      field.fieldType,
      entry.fieldValues.find((v) => v.fieldDefinitionId === field.id) ?? null,
    );
  }

  const boundAction = updateKpiEntry.bind(null, kpiId, entryId);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Edit case — {kpi.name}</h1>
      </div>
      <EntryForm
        action={boundAction}
        fieldDefinitions={activeFields}
        submitLabel="Save changes"
        defaultValues={{
          entryDate: entry.entryDate.toISOString().slice(0, 10),
          countsTowardTarget: entry.countsTowardTarget,
          evidenceSource: entry.evidenceSource ?? undefined,
          notes: entry.notes ?? undefined,
          fieldValues,
        }}
      />
    </div>
  );
}
