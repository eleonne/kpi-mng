import { describe, expect, it } from "vitest";
import { getKpiStatus, getThemeColor } from "@/lib/calculations/kpi-status";
import type { KpiSummary } from "@/lib/calculations/kpi-summary";
import { MeasurementType } from "@/generated/prisma/enums";

function makeSummary(overrides: Partial<KpiSummary>): KpiSummary {
  return {
    kpiId: "kpi-1",
    measurementType: MeasurementType.COUNT,
    hasData: true,
    currentValue: 0,
    numerator: 0,
    denominator: null,
    targetValue: 10,
    targetMet: false,
    displayValue: "0 / 10",
    ...overrides,
  };
}

describe("getKpiStatus", () => {
  it("returns 'No Data' when the KPI has no entries yet", () => {
    const status = getKpiStatus(makeSummary({ hasData: false, currentValue: null }));
    expect(status.label).toBe("No Data");
    expect(status.progressPercent).toBe(0);
  });

  it("returns 'On Track' once the target is met, regardless of raw progress math", () => {
    const status = getKpiStatus(makeSummary({ currentValue: 10, targetValue: 10, targetMet: true }));
    expect(status.label).toBe("On Track");
    expect(status.progressPercent).toBe(100);
  });

  it("returns 'In Progress' below target but at or above the halfway point", () => {
    const status = getKpiStatus(makeSummary({ currentValue: 6, targetValue: 10, targetMet: false }));
    expect(status.label).toBe("In Progress");
    expect(status.progressPercent).toBe(60);
  });

  it("returns 'At Risk' below the halfway point", () => {
    const status = getKpiStatus(makeSummary({ currentValue: 2, targetValue: 10, targetMet: false }));
    expect(status.label).toBe("At Risk");
    expect(status.progressPercent).toBe(20);
  });

  it("clamps progress at 100 even if current overshoots the target", () => {
    const status = getKpiStatus(makeSummary({ currentValue: 25, targetValue: 10, targetMet: true }));
    expect(status.progressPercent).toBe(100);
  });
});

describe("getThemeColor", () => {
  it("assigns the same color to the same theme consistently", () => {
    const themes = ["Alpha", "Beta", "Gamma"];
    expect(getThemeColor("Beta", themes)).toBe(getThemeColor("Beta", themes));
  });

  it("assigns different colors to different themes within the palette size", () => {
    const themes = ["Alpha", "Beta", "Gamma"];
    const colors = new Set(themes.map((t) => getThemeColor(t, themes)));
    expect(colors.size).toBe(themes.length);
  });
});
