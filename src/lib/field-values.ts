import { FieldType } from "@/generated/prisma/enums";

export type FieldValue = string | number | boolean | Date | string[] | null;

/**
 * The typed-column subset of KpiEntryFieldValue — exactly one column is populated,
 * matching the owning field definition's fieldType (see prisma/schema.prisma).
 */
export interface StoredFieldValue {
  valueText: string | null;
  valueNumber: number | null;
  valueDate: Date | null;
  valueBoolean: boolean | null;
  valueJson: string | null;
}

export function readFieldValue(
  fieldType: FieldType,
  stored: StoredFieldValue | null | undefined,
): FieldValue {
  if (!stored) return null;

  switch (fieldType) {
    case FieldType.TEXT:
    case FieldType.LONG_TEXT:
    case FieldType.SELECT:
      return stored.valueText ?? null;
    case FieldType.NUMBER:
      return stored.valueNumber ?? null;
    case FieldType.DATE:
      return stored.valueDate ?? null;
    case FieldType.BOOLEAN:
      return stored.valueBoolean ?? null;
    case FieldType.MULTI_SELECT:
      return stored.valueJson ? (JSON.parse(stored.valueJson) as string[]) : null;
    default:
      return null;
  }
}

/**
 * Maps a raw form value into the typed-column shape ready to persist on
 * KpiEntryFieldValue. Callers are expected to have already validated the raw
 * value against the field definition (see lib/validation).
 */
export function writeFieldValue(fieldType: FieldType, raw: FieldValue): StoredFieldValue {
  const empty: StoredFieldValue = {
    valueText: null,
    valueNumber: null,
    valueDate: null,
    valueBoolean: null,
    valueJson: null,
  };

  if (raw === null || raw === undefined) return empty;

  switch (fieldType) {
    case FieldType.TEXT:
    case FieldType.LONG_TEXT:
    case FieldType.SELECT:
      return { ...empty, valueText: String(raw) };
    case FieldType.NUMBER:
      return { ...empty, valueNumber: Number(raw) };
    case FieldType.DATE:
      return { ...empty, valueDate: raw instanceof Date ? raw : new Date(raw as string) };
    case FieldType.BOOLEAN:
      return { ...empty, valueBoolean: Boolean(raw) };
    case FieldType.MULTI_SELECT:
      return { ...empty, valueJson: JSON.stringify(raw) };
    default:
      return empty;
  }
}

export function fieldValueToDisplayString(value: FieldValue): string {
  if (value === null || value === undefined || value === "") return "—";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
