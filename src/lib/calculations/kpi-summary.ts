import type {
  Kpi,
  KpiEntry,
  KpiEntryFieldValue,
  KpiFieldDefinition,
} from "@/generated/prisma/client";
import { MeasurementType } from "@/generated/prisma/enums";
import { calculateCurrentValue, type CalculationResult } from "./current-value";

export type KpiEntryWithValues = KpiEntry & {
  fieldValues: (KpiEntryFieldValue & { fieldDefinition: KpiFieldDefinition })[];
};
export type KpiWithEntriesAndFields = Kpi & {
  entries: KpiEntryWithValues[];
  fieldDefinitions: KpiFieldDefinition[];
};

export interface KpiSummary extends CalculationResult {
  kpiId: string;
  /** Human-readable "8 / 12 reviews" or "83% / 90%" or "No data yet". */
  displayValue: string;
}

export function summarizeKpi(kpi: KpiWithEntriesAndFields): KpiSummary {
  const entries = kpi.entries.map((entry) => ({
    countsTowardTarget: entry.countsTowardTarget,
  }));

  const result = calculateCurrentValue({
    measurementType: kpi.measurementType,
    targetValue: kpi.targetValue,
    populationSize: kpi.populationSize,
    entries,
  });

  return {
    ...result,
    kpiId: kpi.id,
    displayValue: formatDisplayValue(result, kpi.targetUnit),
  };
}

function formatDisplayValue(result: CalculationResult, targetUnit: string | null): string {
  if (!result.hasData || result.currentValue === null) return "No data yet";

  const unit = targetUnit ? ` ${targetUnit}` : "";

  if (result.measurementType === MeasurementType.COUNT) {
    return `${result.currentValue} / ${result.targetValue}${unit}`;
  }

  return `${Math.round(result.currentValue)}% / ${result.targetValue}%`;
}
