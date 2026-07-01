import Link from "next/link";
import { getKpiStatus, getThemeColor } from "@/lib/calculations/kpi-status";
import type { KpiSummary } from "@/lib/calculations/kpi-summary";

interface ProgressListKpi {
  id: string;
  name: string;
  theme: string | null;
  summary: KpiSummary;
}

export function KpiProgressList({ kpis }: { kpis: ProgressListKpi[] }) {
  const themes = Array.from(new Set(kpis.map((k) => k.theme ?? "Uncategorized")));

  // Worst-first within each theme so risk items surface immediately.
  const sorted = [...kpis].sort(
    (a, b) => getKpiStatus(a.summary).progressPercent - getKpiStatus(b.summary).progressPercent,
  );

  const grouped = new Map<string, typeof sorted>();
  for (const kpi of sorted) {
    const theme = kpi.theme ?? "Uncategorized";
    if (!grouped.has(theme)) grouped.set(theme, []);
    grouped.get(theme)!.push(kpi);
  }

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([theme, themeKpis]) => (
        <div key={theme}>
          <div className="mb-2 flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: getThemeColor(theme, themes) }}
            />
            <h3 className="text-sm font-semibold">{theme}</h3>
          </div>
          <div className="space-y-2">
            {themeKpis.map((kpi) => {
              const status = getKpiStatus(kpi.summary);
              return (
                <Link
                  key={kpi.id}
                  href={`/kpis/${kpi.id}`}
                  className="block rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{kpi.name}</span>
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <span className={`text-xs font-semibold ${status.textClass}`}>{status.label}</span>
                      <span className="text-muted-foreground">{kpi.summary.displayValue}</span>
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${status.bgClass} transition-[width]`}
                      style={{ width: `${status.progressPercent}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
