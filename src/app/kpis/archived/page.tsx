import { listArchivedKpis } from "@/lib/kpi-queries";
import { summarizeKpi } from "@/lib/calculations/kpi-summary";
import { KpiCard } from "@/components/kpi/kpi-card";

export default async function ArchivedKpisPage() {
  const kpis = await listArchivedKpis();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Archived KPIs</h1>
        <p className="text-sm text-muted-foreground">
          Hidden from the dashboard, kept for historical reference.
        </p>
      </div>

      {kpis.length === 0 ? (
        <p className="text-sm text-muted-foreground">No archived KPIs.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.id} kpi={kpi} summary={summarizeKpi(kpi)} />
          ))}
        </div>
      )}
    </div>
  );
}
