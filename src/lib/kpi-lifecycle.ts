import type { Kpi, KpiFieldDefinition } from "@/generated/prisma/client";
import { FieldType, MeasurementType } from "@/generated/prisma/enums";

/**
 * Business rules from docs/business-rules.md §1/§2, expressed as eligibility
 * checks shared by the UI (disable a button, explain why) and the Server
 * Actions (reject the mutation server-side regardless of what the UI showed).
 */

export function getActivationBlockers(
  kpi: Pick<Kpi, "measurementType" | "populationSize" | "primaryFieldKey">,
  activeFieldDefinitions: KpiFieldDefinition[],
): string[] {
  const blockers: string[] = [];

  if (activeFieldDefinitions.length === 0) {
    blockers.push("Add at least one field definition before activating this KPI.");
  }

  if (kpi.measurementType === MeasurementType.PERCENTAGE_OF_FIXED_POPULATION) {
    if (!kpi.populationSize || kpi.populationSize <= 0) {
      blockers.push("Set a population size (this measurement type requires one).");
    }

    const primaryField = activeFieldDefinitions.find((f) => f.fieldKey === kpi.primaryFieldKey);
    if (!primaryField) {
      blockers.push("Choose a primary field (this measurement type requires one).");
    } else if (primaryField.fieldType !== FieldType.TEXT && primaryField.fieldType !== FieldType.SELECT) {
      blockers.push("The primary field must be a Text or Select field.");
    }
  }

  return blockers;
}

export function canDeleteKpi(entryCount: number): boolean {
  return entryCount === 0;
}

export function canHardDeleteField(valueCount: number): boolean {
  return valueCount === 0;
}
