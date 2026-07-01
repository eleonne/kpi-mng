import { z } from "zod";
import { FieldType } from "@/generated/prisma/enums";

const SELECT_TYPES = new Set<FieldType>([FieldType.SELECT, FieldType.MULTI_SELECT]);

/** Textarea input, one option per line -> string[]. */
const optionsTextSchema = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  );

function checkOptions(fieldType: FieldType, options: string[], ctx: z.RefinementCtx) {
  if (SELECT_TYPES.has(fieldType) && options.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["options"],
      message: "At least one option is required for select fields",
    });
  }
}

/** Exported so other JSON-input entry points (e.g. the MCP server) can reuse
 * the same field shapes as tool-input hints without redeclaring them. */
export const fieldDefinitionBaseSchema = z.object({
  label: z.string().trim().min(1, "Label is required"),
  fieldType: z.enum(FieldType),
  helpText: z.string().trim().optional(),
  isRequired: z.coerce.boolean().default(false),
  displayOrder: z.coerce.number().int().default(0),
});

/** Used by the "add field" form — options come in as one textarea, one per line. */
export const fieldDefinitionFormSchema = fieldDefinitionBaseSchema
  .extend({ optionsText: optionsTextSchema })
  .transform((data, ctx) => {
    checkOptions(data.fieldType, data.optionsText, ctx);
    return { ...data, options: data.optionsText };
  });

/** Used by the JSON API — options come in as a plain string array. */
export const fieldDefinitionApiSchema = fieldDefinitionBaseSchema
  .extend({ options: z.array(z.string()).default([]) })
  .transform((data, ctx) => {
    checkOptions(data.fieldType, data.options, ctx);
    return data;
  });

export type FieldDefinitionFormInput = z.input<typeof fieldDefinitionFormSchema>;
export type FieldDefinitionFormValues = z.output<typeof fieldDefinitionFormSchema>;
export type FieldDefinitionApiInput = z.input<typeof fieldDefinitionApiSchema>;
export type FieldDefinitionApiValues = z.output<typeof fieldDefinitionApiSchema>;

export function slugifyFieldKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
