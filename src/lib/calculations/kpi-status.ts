import type { KpiSummary } from "./kpi-summary";

export type KpiStatusLabel = "On Track" | "In Progress" | "At Risk" | "No Data";

export interface KpiStatusInfo {
  label: KpiStatusLabel;
  /** 0–100, clamped — how far current is toward target, for bars/charts. */
  progressPercent: number;
  color: string;
  bgClass: string;
  textClass: string;
}

const STATUS_COLORS: Record<KpiStatusLabel, { color: string; bgClass: string; textClass: string }> = {
  "On Track": { color: "#16a34a", bgClass: "bg-green-600", textClass: "text-green-600" },
  "In Progress": { color: "#f59e0b", bgClass: "bg-amber-500", textClass: "text-amber-600" },
  "At Risk": { color: "#dc2626", bgClass: "bg-red-600", textClass: "text-red-600" },
  "No Data": { color: "#9ca3af", bgClass: "bg-gray-400", textClass: "text-gray-500" },
};

/**
 * Reduces any KpiSummary (regardless of measurement type) to a single 0-100
 * progress figure and a status bucket, so mixed COUNT/PERCENTAGE_* KPIs can
 * be compared side by side on an executive-style overview.
 */
export function getKpiStatus(summary: KpiSummary): KpiStatusInfo {
  if (!summary.hasData || summary.currentValue === null) {
    return { label: "No Data", progressPercent: 0, ...STATUS_COLORS["No Data"] };
  }

  const rawProgress =
    summary.targetValue > 0 ? (summary.currentValue / summary.targetValue) * 100 : 0;
  const progressPercent = Math.max(0, Math.min(100, rawProgress));

  let label: KpiStatusLabel;
  if (summary.targetMet) {
    label = "On Track";
  } else if (progressPercent >= 50) {
    label = "In Progress";
  } else {
    label = "At Risk";
  }

  return { label, progressPercent, ...STATUS_COLORS[label] };
}

export const KPI_STATUS_LABELS: KpiStatusLabel[] = ["On Track", "In Progress", "At Risk", "No Data"];

export function getStatusColor(label: KpiStatusLabel): string {
  return STATUS_COLORS[label].color;
}

// Distinct, high-contrast palette for theme-based chart coloring — cycles if
// there are more themes than colors.
const THEME_PALETTE = [
  "#6366f1", // indigo
  "#0ea5e9", // sky
  "#f97316", // orange
  "#14b8a6", // teal
  "#ec4899", // pink
  "#84cc16", // lime
  "#a855f7", // purple
];

export function getThemeColor(theme: string, allThemes: string[]): string {
  const index = allThemes.indexOf(theme);
  return THEME_PALETTE[index % THEME_PALETTE.length] ?? THEME_PALETTE[0];
}
