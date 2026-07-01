import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getKpi, parseCriteria } from "@/lib/kpi-queries";
import { summarizeKpi } from "@/lib/calculations/kpi-summary";
import { getActivationBlockers } from "@/lib/kpi-lifecycle";
import { KpiStatusActions } from "@/components/kpi/kpi-status-actions";
import { FieldDefinitionForm } from "@/components/kpi/field-definition-form";
import { FieldDefinitionList } from "@/components/kpi/field-definition-list";
import { EntryList } from "@/components/kpi/entry-list";

export default async function KpiDetailPage({ params }: { params: Promise<{ kpiId: string }> }) {
  const { kpiId } = await params;
  const kpi = await getKpi(kpiId);
  if (!kpi) notFound();

  const summary = summarizeKpi(kpi);
  const activeFields = kpi.fieldDefinitions.filter((f) => f.isActive);
  const blockers = getActivationBlockers(kpi, activeFields);
  const allFieldValues = kpi.entries.flatMap((e) => e.fieldValues);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{kpi.name}</h1>
            <Badge>{kpi.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {kpi.theme ?? "Uncategorized"}
            {kpi.targetPeriodLabel ? ` · ${kpi.targetPeriodLabel}` : ""}
            {kpi.owner ? ` · Owner: ${kpi.owner}` : ""}
          </p>
        </div>
        <Button
          variant="outline"
          render={<Link href={`/kpis/${kpi.id}/edit`} />}
          nativeButton={false}
        >
          Edit KPI
        </Button>
      </div>

      <div className="rounded-md border p-4">
        <p className={`text-3xl font-semibold ${summary.targetMet ? "text-green-600" : ""}`}>
          {summary.displayValue}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{kpi.objective}</p>
        {kpi.measurementFormulaText && (
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="font-medium">Formula:</span> {kpi.measurementFormulaText}
          </p>
        )}
      </div>

      {parseCriteria(kpi.qualificationCriteria).length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium">A case counts toward the target if…</h2>
          <ul className="list-inside list-disc text-sm text-muted-foreground">
            {parseCriteria(kpi.qualificationCriteria).map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      <KpiStatusActions kpiId={kpi.id} status={kpi.status} activationBlockers={blockers} />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Fields</h2>
        <FieldDefinitionList
          kpiId={kpi.id}
          fieldDefinitions={kpi.fieldDefinitions}
          fieldValues={allFieldValues}
        />
        <FieldDefinitionForm kpiId={kpi.id} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Cases</h2>
          {activeFields.length > 0 && (
            <Button render={<Link href={`/kpis/${kpi.id}/entries/new`} />} nativeButton={false}>
              Log a case
            </Button>
          )}
        </div>
        {activeFields.length === 0 && (
          <p className="text-xs text-muted-foreground">Add at least one field before logging a case.</p>
        )}
        <EntryList
          kpiId={kpi.id}
          entries={kpi.entries}
          fieldDefinitions={activeFields}
          primaryFieldKey={kpi.primaryFieldKey}
        />
      </section>
    </div>
  );
}
