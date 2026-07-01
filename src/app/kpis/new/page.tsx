import { createKpi } from "@/actions/kpi";
import { KpiForm } from "@/components/kpi/kpi-form";

export default function NewKpiPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New KPI</h1>
        <p className="text-sm text-muted-foreground">
          Created as a draft. Add field definitions afterward, then activate it.
        </p>
      </div>
      <KpiForm action={createKpi} submitLabel="Create KPI" />
    </div>
  );
}
