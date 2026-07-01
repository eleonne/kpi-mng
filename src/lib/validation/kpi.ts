import { z } from "zod";
import { MeasurementType } from "@/generated/prisma/enums";

/** Textarea input, one criterion per line -> string[], blank lines dropped. */
const criteriaTextSchema = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  );

export const kpiFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    theme: z.string().trim().optional(),
    objective: z.string().trim().min(1, "Objective is required"),
    owner: z.string().trim().optional(),
    measurementType: z.enum(MeasurementType),
    targetValue: z.coerce.number().positive("Target must be greater than 0"),
    targetUnit: z.string().trim().optional(),
    targetPeriodLabel: z.string().trim().optional(),
    measurementFormulaText: z.string().trim().optional(),
    qualificationCriteria: criteriaTextSchema,
    populationSize: z.coerce.number().int().positive().optional(),
    primaryFieldKey: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    // primaryFieldKey is intentionally not required here: a KPI can (and often
    // must, per docs/business-rules.md) be created before any field definitions
    // exist. Choosing the primary field happens on edit, once fields exist, and
    // is enforced as a precondition for activation instead — see actions/kpi.ts.
    if (data.measurementType === MeasurementType.PERCENTAGE_OF_FIXED_POPULATION) {
      if (!data.populationSize) {
        ctx.addIssue({
          code: "custom",
          path: ["populationSize"],
          message: "Population size is required for this measurement type",
        });
      }
    } else if (data.populationSize) {
      ctx.addIssue({
        code: "custom",
        path: ["populationSize"],
        message: "Population size only applies to Percentage of Fixed Population KPIs",
      });
    }
  });

export type KpiFormInput = z.input<typeof kpiFormSchema>;
export type KpiFormValues = z.output<typeof kpiFormSchema>;
