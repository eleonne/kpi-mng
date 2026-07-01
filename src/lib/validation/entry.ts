import { z } from "zod";
import type { KpiFieldDefinition } from "@/generated/prisma/client";
import { FieldType } from "@/generated/prisma/enums";

export const entryCoreSchema = z.object({
  entryDate: z.coerce.date({ error: "A valid date is required" }),
  // Real boolean expected here, not "on"/undefined — callers must resolve the
  // checkbox's presence via formData.has(...) before parsing (unchecked
  // checkboxes are omitted from FormData entirely, which would otherwise
  // collide with a z.coerce.boolean().default(true) fallback).
  countsTowardTarget: z.boolean().default(true),
  evidenceSource: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type EntryCoreInput = z.input<typeof entryCoreSchema>;
export type EntryCoreValues = z.output<typeof entryCoreSchema>;

/**
 * A KPI's case form is dynamic — one input per active field definition.
 * This builds the matching Zod schema on the fly, keyed by fieldKey, so form
 * data can be validated against whatever fields the KPI currently defines.
 */
export function buildEntryFieldValuesSchema(fieldDefinitions: KpiFieldDefinition[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fieldDefinitions) {
    shape[field.fieldKey] = fieldValueSchemaFor(field);
  }

  return z.object(shape);
}

/** "" / undefined / null all mean "no value" for a form/JSON input — treat them alike. */
const emptyToUndefined = (v: unknown) => (v === "" || v === undefined || v === null ? undefined : v);

function fieldValueSchemaFor(field: KpiFieldDefinition): z.ZodTypeAny {
  let schema: z.ZodTypeAny;

  switch (field.fieldType) {
    case FieldType.TEXT:
    case FieldType.LONG_TEXT:
    case FieldType.SELECT:
      schema = z.string().trim();
      if (!field.isRequired) schema = schema.optional().or(z.literal(""));
      break;
    case FieldType.NUMBER: {
      // z.coerce.number() still runs Number(...) on undefined/"" (-> NaN) rather than
      // cleanly rejecting a missing value, producing a confusing "expected number,
      // received NaN" message — normalize emptiness first so the custom message applies
      // to both "missing" and "not actually a number" cases.
      const message = field.isRequired ? `${field.label} is required` : `${field.label} must be a number`;
      const base = z.coerce.number({ error: () => message });
      schema = z.preprocess(emptyToUndefined, field.isRequired ? base : base.optional());
      break;
    }
    case FieldType.DATE: {
      // Same z.coerce quirk as NUMBER above, but with Invalid Date instead of NaN.
      const message = field.isRequired ? `${field.label} is required` : `${field.label} must be a valid date`;
      const base = z.coerce.date({ error: () => message });
      schema = z.preprocess(emptyToUndefined, field.isRequired ? base : base.optional());
      break;
    }
    case FieldType.BOOLEAN:
      schema = z.coerce.boolean().default(false);
      break;
    case FieldType.MULTI_SELECT:
      schema = z.array(z.string()).default([]);
      if (field.isRequired) schema = schema.pipe(z.array(z.string()).min(1, `${field.label} is required`));
      break;
    default:
      schema = z.unknown();
  }

  const selfValidatingTypes: FieldType[] = [FieldType.MULTI_SELECT, FieldType.NUMBER, FieldType.DATE];
  const needsGenericRequiredCheck = field.isRequired && !selfValidatingTypes.includes(field.fieldType);

  return needsGenericRequiredCheck
    ? schema.refine((v) => v !== undefined && v !== "" && v !== null, {
        message: `${field.label} is required`,
      })
    : schema;
}
