"use client";

import { useActionState, useState } from "react";
import { addKpiField } from "@/actions/field-definition";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldType } from "@/generated/prisma/enums";

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  [FieldType.TEXT]: "Text",
  [FieldType.LONG_TEXT]: "Long text",
  [FieldType.NUMBER]: "Number",
  [FieldType.DATE]: "Date",
  [FieldType.BOOLEAN]: "Yes / No",
  [FieldType.SELECT]: "Select (one option)",
  [FieldType.MULTI_SELECT]: "Multi-select",
};

const SELECT_TYPES = new Set<FieldType>([FieldType.SELECT, FieldType.MULTI_SELECT]);

export function FieldDefinitionForm({ kpiId }: { kpiId: string }) {
  const action = addKpiField.bind(null, kpiId);
  const [state, formAction, pending] = useActionState(action, undefined);
  const [fieldType, setFieldType] = useState<FieldType>(FieldType.TEXT);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-3 rounded-md border p-4">
      <h3 className="text-sm font-medium">Add a field</h3>
      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="label">Label</Label>
          <Input id="label" name="label" placeholder="e.g. Project Name" required />
          {errors.label && <p className="text-xs text-destructive">{errors.label[0]}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fieldType">Type</Label>
          <Select name="fieldType" value={fieldType} onValueChange={(v) => setFieldType(v as FieldType)}>
            <SelectTrigger id="fieldType" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(FieldType).map((type) => (
                <SelectItem key={type} value={type}>
                  {FIELD_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {SELECT_TYPES.has(fieldType) && (
        <div className="space-y-1.5">
          <Label htmlFor="optionsText">Options (one per line)</Label>
          <Textarea id="optionsText" name="optionsText" rows={3} placeholder={"Option A\nOption B"} />
          {errors.optionsText && <p className="text-xs text-destructive">{errors.optionsText[0]}</p>}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="helpText">Help text</Label>
        <Input id="helpText" name="helpText" placeholder="Shown under the input when logging a case" />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isRequired" className="h-4 w-4" />
        Required when logging a case
      </label>

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Adding…" : "Add field"}
      </Button>
    </form>
  );
}
