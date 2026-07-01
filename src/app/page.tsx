import Link from "next/link";
import { listKpis } from "@/lib/kpi-queries";
import { summarizeKpi } from "@/lib/calculations/kpi-summary";
import { KpiCard } from "@/components/kpi/kpi-card";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const kpis = await listKpis();

  const groups = new Map<string, typeof kpis>();
  for (const kpi of kpis) {
    const theme = kpi.theme ?? "Uncategorized";
    if (!groups.has(theme)) groups.set(theme, []);
    groups.get(theme)!.push(kpi);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Current progress across all KPIs.
          </p>
        </div>
        <Button render={<Link href="/kpis/new" />} nativeButton={false}>
          New KPI
        </Button>
      </div>

      {kpis.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No KPIs yet.{" "}
          <Link href="/kpis/new" className="underline">
            Create the first one
          </Link>
          .
        </p>
      ) : (
        Array.from(groups.entries()).map(([theme, themeKpis]) => (
          <section key={theme} className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {theme}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {themeKpis.map((kpi) => (
                <KpiCard key={kpi.id} kpi={kpi} summary={summarizeKpi(kpi)} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
