import { Badge } from "@/components/ui/badge";
import { FieldDefinitionRowActions } from "./field-definition-row-actions";
import type { KpiFieldDefinition, KpiEntryFieldValue } from "@/generated/prisma/client";

const FIELD_TYPE_LABELS: Record<string, string> = {
  TEXT: "Text",
  LONG_TEXT: "Long text",
  NUMBER: "Number",
  DATE: "Date",
  BOOLEAN: "Yes / No",
  SELECT: "Select",
  MULTI_SELECT: "Multi-select",
};

export function FieldDefinitionList({
  kpiId,
  fieldDefinitions,
  fieldValues,
}: {
  kpiId: string;
  fieldDefinitions: KpiFieldDefinition[];
  fieldValues: KpiEntryFieldValue[];
}) {
  if (fieldDefinitions.length === 0) {
    return <p className="text-sm text-muted-foreground">No fields defined yet.</p>;
  }

  const valueCounts = new Map<string, number>();
  for (const value of fieldValues) {
    valueCounts.set(value.fieldDefinitionId, (valueCounts.get(value.fieldDefinitionId) ?? 0) + 1);
  }

  return (
    <ul className="divide-y rounded-md border">
      {fieldDefinitions.map((field) => {
        const valueCount = valueCounts.get(field.id) ?? 0;
        return (
          <li key={field.id} className="flex items-start justify-between gap-4 p-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{field.label}</span>
                <Badge variant="outline">{FIELD_TYPE_LABELS[field.fieldType]}</Badge>
                {field.isRequired && <Badge variant="secondary">Required</Badge>}
                {!field.isActive && <Badge variant="secondary">Inactive</Badge>}
              </div>
              {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
            </div>
            <FieldDefinitionRowActions
              kpiId={kpiId}
              fieldId={field.id}
              isActive={field.isActive}
              canHardDelete={valueCount === 0}
            />
          </li>
        );
      })}
    </ul>
  );
}
