import { MeasurementType } from "@/generated/prisma/enums";

/**
 * Pure, DB-agnostic implementation of the three calculation modes defined in
 * docs/data-model.md ("Calculating the current value"). Kept free of Prisma
 * shapes on purpose so it's cheap to unit test — see kpi-summary.ts for the
 * adapter that maps Prisma query results into this shape.
 */
export interface CalculationEntry {
  countsTowardTarget: boolean;
  /**
   * The KPI's primary-field value for this entry, as a display string.
   * Only required for PERCENTAGE_OF_FIXED_POPULATION (distinct-value counting);
   * ignored otherwise.
   */
  primaryFieldValue?: string | null;
}

export interface CalculationInput {
  measurementType: MeasurementType;
  targetValue: number;
  /** Required (> 0) only for PERCENTAGE_OF_FIXED_POPULATION. */
  populationSize?: number | null;
  entries: CalculationEntry[];
}

export interface CalculationResult {
  measurementType: MeasurementType;
  hasData: boolean;
  /** null when hasData is false ("No data yet"). */
  currentValue: number | null;
  numerator: number;
  /** null when not applicable (COUNT) or unknown (denominator would be 0). */
  denominator: number | null;
  targetValue: number;
  /** current >= target. Always false when hasData is false. */
  targetMet: boolean;
}

export function calculateCurrentValue(input: CalculationInput): CalculationResult {
  switch (input.measurementType) {
    case MeasurementType.COUNT:
      return calculateCount(input);
    case MeasurementType.PERCENTAGE_OF_ENTRIES:
      return calculatePercentageOfEntries(input);
    case MeasurementType.PERCENTAGE_OF_FIXED_POPULATION:
      return calculatePercentageOfFixedPopulation(input);
    default:
      throw new Error(`Unknown measurement type: ${input.measurementType satisfies never}`);
  }
}

function calculateCount(input: CalculationInput): CalculationResult {
  const numerator = input.entries.filter((e) => e.countsTowardTarget).length;

  return {
    measurementType: input.measurementType,
    hasData: true,
    currentValue: numerator,
    numerator,
    denominator: null,
    targetValue: input.targetValue,
    targetMet: numerator >= input.targetValue,
  };
}

function calculatePercentageOfEntries(input: CalculationInput): CalculationResult {
  const denominator = input.entries.length;
  const numerator = input.entries.filter((e) => e.countsTowardTarget).length;
  const hasData = denominator > 0;
  const currentValue = hasData ? (numerator / denominator) * 100 : null;

  return {
    measurementType: input.measurementType,
    hasData,
    currentValue,
    numerator,
    denominator,
    targetValue: input.targetValue,
    targetMet: hasData && currentValue !== null && currentValue >= input.targetValue,
  };
}

function calculatePercentageOfFixedPopulation(input: CalculationInput): CalculationResult {
  const denominator = input.populationSize ?? 0;
  const distinctValues = new Set(
    input.entries
      .filter((e) => e.countsTowardTarget)
      .map((e) => e.primaryFieldValue)
      .filter((value): value is string => Boolean(value)),
  );
  const numerator = distinctValues.size;
  const hasData = denominator > 0;
  const currentValue = hasData ? (numerator / denominator) * 100 : null;

  return {
    measurementType: input.measurementType,
    hasData,
    currentValue,
    numerator,
    denominator: hasData ? denominator : null,
    targetValue: input.targetValue,
    targetMet: hasData && currentValue !== null && currentValue >= input.targetValue,
  };
}
