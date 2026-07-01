import { notFound } from "next/navigation";
import { updateKpi } from "@/actions/kpi";
import { KpiForm } from "@/components/kpi/kpi-form";
import { getKpi, parseCriteria } from "@/lib/kpi-queries";
import { FieldType } from "@/generated/prisma/enums";

export default async function EditKpiPage({ params }: { params: Promise<{ kpiId: string }> }) {
  const { kpiId } = await params;
  const kpi = await getKpi(kpiId);
  if (!kpi) notFound();

  const primaryFieldOptions = kpi.fieldDefinitions
    .filter((f) => f.isActive && (f.fieldType === FieldType.TEXT || f.fieldType === FieldType.SELECT))
    .map((f) => ({ fieldKey: f.fieldKey, label: f.label }));

  const boundAction = updateKpi.bind(null, kpiId);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Edit {kpi.name}</h1>
      </div>
      <KpiForm
        action={boundAction}
        submitLabel="Save changes"
        primaryFieldOptions={primaryFieldOptions}
        defaultValues={{
          name: kpi.name,
          theme: kpi.theme ?? undefined,
          objective: kpi.objective,
          owner: kpi.owner ?? undefined,
          measurementType: kpi.measurementType,
          targetValue: kpi.targetValue,
          targetUnit: kpi.targetUnit ?? undefined,
          targetPeriodLabel: kpi.targetPeriodLabel ?? undefined,
          measurementFormulaText: kpi.measurementFormulaText ?? undefined,
          qualificationCriteriaText: parseCriteria(kpi.qualificationCriteria).join("\n"),
          populationSize: kpi.populationSize ?? undefined,
          primaryFieldKey: kpi.primaryFieldKey ?? undefined,
        }}
      />
    </div>
  );
}
