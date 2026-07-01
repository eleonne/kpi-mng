import Link from "next/link";
import { listKpis } from "@/lib/kpi-queries";
import { summarizeKpi } from "@/lib/calculations/kpi-summary";
import { getKpiStatus, getStatusColor, getThemeColor, KPI_STATUS_LABELS } from "@/lib/calculations/kpi-status";
import { KpiStatus } from "@/generated/prisma/enums";
import { ExecutiveStatCards } from "@/components/kpi/executive/executive-stat-cards";
import { StatusDonutChart } from "@/components/kpi/executive/status-donut-chart";
import { ThemeProgressChart } from "@/components/kpi/executive/theme-progress-chart";
import { KpiProgressList } from "@/components/kpi/executive/kpi-progress-list";

export default async function ExecutiveDashboardPage() {
  const allKpis = await listKpis();
  const kpis = allKpis
    .filter((kpi) => kpi.status === KpiStatus.ACTIVE)
    .map((kpi) => ({ ...kpi, summary: summarizeKpi(kpi) }));

  const statuses = kpis.map((kpi) => getKpiStatus(kpi.summary));

  const counts = {
    total: kpis.length,
    onTrack: statuses.filter((s) => s.label === "On Track").length,
    inProgress: statuses.filter((s) => s.label === "In Progress").length,
    atRisk: statuses.filter((s) => s.label === "At Risk").length,
    noData: statuses.filter((s) => s.label === "No Data").length,
  };

  const donutData = KPI_STATUS_LABELS.map((label) => ({
    name: label,
    value: statuses.filter((s) => s.label === label).length,
    color: getStatusColor(label),
  }));

  const themes = Array.from(new Set(kpis.map((k) => k.theme ?? "Uncategorized")));
  const themeProgressData = themes
    .map((theme) => {
      const inTheme = kpis.filter((k) => (k.theme ?? "Uncategorized") === theme);
      const avgProgress =
        inTheme.reduce((sum, k) => sum + getKpiStatus(k.summary).progressPercent, 0) / inTheme.length;
      return { theme, avgProgress: Math.round(avgProgress), color: getThemeColor(theme, themes) };
    })
    .sort((a, b) => a.avgProgress - b.avgProgress);

  const overallProgress =
    statuses.length > 0
      ? Math.round(statuses.reduce((sum, s) => sum + s.progressPercent, 0) / statuses.length)
      : null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Executive Overview</h1>
          <p className="text-sm text-muted-foreground">
            Active KPIs only ·{" "}
            <Link href="/" className="underline">
              Switch to operational dashboard
            </Link>
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-8 text-white shadow-lg">
        <p className="text-sm font-medium uppercase tracking-wide opacity-80">
          Overall target attainment
        </p>
        <p className="text-6xl font-bold">
          {overallProgress === null ? "—" : `${overallProgress}%`}
        </p>
        <p className="mt-1 text-sm opacity-80">
          Average progress toward target across {counts.total} active KPI
          {counts.total === 1 ? "" : "s"}
        </p>
      </div>

      <ExecutiveStatCards {...counts} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border p-5">
          <h2 className="mb-2 text-sm font-semibold">KPI Status Distribution</h2>
          <StatusDonutChart data={donutData} />
        </div>
        <div className="rounded-xl border p-5">
          <h2 className="mb-2 text-sm font-semibold">Average Progress by Theme</h2>
          <ThemeProgressChart data={themeProgressData} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">KPI Detail — Worst First</h2>
        {kpis.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active KPIs yet.</p>
        ) : (
          <KpiProgressList kpis={kpis} />
        )}
      </div>
    </div>
  );
}
