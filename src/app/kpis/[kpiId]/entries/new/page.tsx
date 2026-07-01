import { notFound, redirect } from "next/navigation";
import { getKpi } from "@/lib/kpi-queries";
import { logKpiEntry } from "@/actions/entry";
import { EntryForm } from "@/components/kpi/entry-form";

export default async function NewEntryPage({ params }: { params: Promise<{ kpiId: string }> }) {
  const { kpiId } = await params;
  const kpi = await getKpi(kpiId);
  if (!kpi) notFound();

  const activeFields = kpi.fieldDefinitions.filter((f) => f.isActive);
  if (activeFields.length === 0) redirect(`/kpis/${kpiId}`);

  const boundAction = logKpiEntry.bind(null, kpiId);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Log a case — {kpi.name}</h1>
      </div>
      <EntryForm action={boundAction} fieldDefinitions={activeFields} submitLabel="Log case" />
    </div>
  );
}
