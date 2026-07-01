import { describe, expect, it } from "vitest";
import { calculateCurrentValue } from "@/lib/calculations/current-value";
import { MeasurementType } from "@/generated/prisma/enums";

describe("calculateCurrentValue — COUNT", () => {
  it("counts only qualifying entries", () => {
    const result = calculateCurrentValue({
      measurementType: MeasurementType.COUNT,
      targetValue: 12,
      entries: [
        { countsTowardTarget: true },
        { countsTowardTarget: true },
        { countsTowardTarget: false },
      ],
    });

    expect(result.hasData).toBe(true);
    expect(result.currentValue).toBe(2);
    expect(result.numerator).toBe(2);
    expect(result.denominator).toBeNull();
    expect(result.targetMet).toBe(false);
  });

  it("reports 0 (not 'no data') when there are zero qualifying entries", () => {
    const result = calculateCurrentValue({
      measurementType: MeasurementType.COUNT,
      targetValue: 5,
      entries: [],
    });

    expect(result.hasData).toBe(true);
    expect(result.currentValue).toBe(0);
  });

  it("marks the target met once the count reaches it", () => {
    const result = calculateCurrentValue({
      measurementType: MeasurementType.COUNT,
      targetValue: 2,
      entries: [{ countsTowardTarget: true }, { countsTowardTarget: true }],
    });

    expect(result.targetMet).toBe(true);
  });
});

describe("calculateCurrentValue — PERCENTAGE_OF_ENTRIES", () => {
  it("divides qualifying entries by all logged entries", () => {
    const result = calculateCurrentValue({
      measurementType: MeasurementType.PERCENTAGE_OF_ENTRIES,
      targetValue: 90,
      entries: [
        { countsTowardTarget: true },
        { countsTowardTarget: true },
        { countsTowardTarget: false },
        { countsTowardTarget: false },
      ],
    });

    expect(result.hasData).toBe(true);
    expect(result.numerator).toBe(2);
    expect(result.denominator).toBe(4);
    expect(result.currentValue).toBe(50);
    expect(result.targetMet).toBe(false);
  });

  it("shows 'no data' instead of dividing by zero when no entries exist", () => {
    const result = calculateCurrentValue({
      measurementType: MeasurementType.PERCENTAGE_OF_ENTRIES,
      targetValue: 90,
      entries: [],
    });

    expect(result.hasData).toBe(false);
    expect(result.currentValue).toBeNull();
    expect(result.targetMet).toBe(false);
  });
});

describe("calculateCurrentValue — PERCENTAGE_OF_FIXED_POPULATION", () => {
  it("counts distinct qualifying primary-field values against the fixed population", () => {
    const result = calculateCurrentValue({
      measurementType: MeasurementType.PERCENTAGE_OF_FIXED_POPULATION,
      targetValue: 100,
      populationSize: 6,
      entries: [
        { countsTowardTarget: true, primaryFieldValue: "Team A" },
        { countsTowardTarget: true, primaryFieldValue: "Team A" }, // same team, two engagements
        { countsTowardTarget: true, primaryFieldValue: "Team B" },
        { countsTowardTarget: false, primaryFieldValue: "Team C" },
      ],
    });

    expect(result.hasData).toBe(true);
    expect(result.numerator).toBe(2); // Team A + Team B, distinct
    expect(result.denominator).toBe(6);
    expect(result.currentValue).toBeCloseTo((2 / 6) * 100);
  });

  it("shows 'no data' when population size is unset or zero", () => {
    const result = calculateCurrentValue({
      measurementType: MeasurementType.PERCENTAGE_OF_FIXED_POPULATION,
      targetValue: 100,
      populationSize: null,
      entries: [{ countsTowardTarget: true, primaryFieldValue: "Team A" }],
    });

    expect(result.hasData).toBe(false);
    expect(result.currentValue).toBeNull();
  });
});
