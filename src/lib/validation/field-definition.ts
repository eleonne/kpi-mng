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

export const fieldDefinitionFormSchema = z
  .object({
    label: z.string().trim().min(1, "Label is required"),
    fieldType: z.enum(FieldType),
    optionsText: optionsTextSchema,
    helpText: z.string().trim().optional(),
    isRequired: z.coerce.boolean().default(false),
    displayOrder: z.coerce.number().int().default(0),
  })
  .superRefine((data, ctx) => {
    if (SELECT_TYPES.has(data.fieldType) && data.optionsText.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["optionsText"],
        message: "At least one option is required for select fields",
      });
    }
  });

export type FieldDefinitionFormInput = z.input<typeof fieldDefinitionFormSchema>;
export type FieldDefinitionFormValues = z.output<typeof fieldDefinitionFormSchema>;

export function slugifyFieldKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
