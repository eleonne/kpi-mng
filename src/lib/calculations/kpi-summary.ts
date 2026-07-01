import type {
  Kpi,
  KpiEntry,
  KpiEntryFieldValue,
  KpiFieldDefinition,
} from "@/generated/prisma/client";
import { MeasurementType } from "@/generated/prisma/enums";
import { fieldValueToDisplayString, readFieldValue } from "@/lib/field-values";
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
  const primaryField = kpi.primaryFieldKey
    ? kpi.fieldDefinitions.find((f) => f.fieldKey === kpi.primaryFieldKey)
    : undefined;

  const entries = kpi.entries.map((entry) => ({
    countsTowardTarget: entry.countsTowardTarget,
    primaryFieldValue: primaryField
      ? fieldValueToDisplayString(
          readFieldValue(
            primaryField.fieldType,
            entry.fieldValues.find((v) => v.fieldDefinitionId === primaryField.id) ?? null,
          ),
        )
      : null,
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
