"use client";

import { useActionState } from "react";
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
import type { KpiFieldDefinition } from "@/generated/prisma/client";
import type { ActionState } from "@/actions/kpi";
import type { FieldValue } from "@/lib/field-values";

interface EntryFormProps {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  fieldDefinitions: KpiFieldDefinition[];
  defaultValues?: {
    entryDate?: string;
    countsTowardTarget?: boolean;
    evidenceSource?: string;
    notes?: string;
    fieldValues?: Record<string, FieldValue>;
  };
  submitLabel: string;
}

export function EntryForm({ action, fieldDefinitions, defaultValues, submitLabel }: EntryFormProps) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="entryDate">Date</Label>
          <Input
            id="entryDate"
            name="entryDate"
            type="date"
            defaultValue={defaultValues?.entryDate}
            required
          />
          {errors.entryDate && <p className="text-xs text-destructive">{errors.entryDate[0]}</p>}
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input
            type="checkbox"
            name="countsTowardTarget"
            className="h-4 w-4"
            defaultChecked={defaultValues?.countsTowardTarget ?? true}
          />
          Counts toward target
        </label>
      </div>

      {fieldDefinitions.map((field) => (
        <DynamicField
          key={field.id}
          field={field}
          defaultValue={defaultValues?.fieldValues?.[field.fieldKey]}
          error={errors[field.fieldKey]}
        />
      ))}

      <div className="space-y-1.5">
        <Label htmlFor="evidenceSource">Evidence source</Label>
        <Input
          id="evidenceSource"
          name="evidenceSource"
          placeholder="Link or reference to supporting evidence"
          defaultValue={defaultValues?.evidenceSource}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={3} defaultValue={defaultValues?.notes} />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

function DynamicField({
  field,
  defaultValue,
  error,
}: {
  field: KpiFieldDefinition;
  defaultValue?: FieldValue;
  error?: string[];
}) {
  const name = `field_${field.fieldKey}`;
  const options: string[] = field.options ? JSON.parse(field.options) : [];

  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {field.label}
        {field.isRequired && <span className="text-destructive"> *</span>}
      </Label>

      {field.fieldType === FieldType.LONG_TEXT && (
        <Textarea id={name} name={name} rows={3} defaultValue={(defaultValue as string) ?? ""} />
      )}

      {field.fieldType === FieldType.TEXT && (
        <Input id={name} name={name} defaultValue={(defaultValue as string) ?? ""} />
      )}

      {field.fieldType === FieldType.NUMBER && (
        <Input
          id={name}
          name={name}
          type="number"
          step="any"
          defaultValue={defaultValue as number | undefined}
        />
      )}

      {field.fieldType === FieldType.DATE && (
        <Input
          id={name}
          name={name}
          type="date"
          defaultValue={defaultValue ? toDateInputValue(defaultValue) : ""}
        />
      )}

      {field.fieldType === FieldType.BOOLEAN && (
        <div className="pt-1">
          <input
            type="checkbox"
            id={name}
            name={name}
            className="h-4 w-4"
            defaultChecked={Boolean(defaultValue)}
          />
        </div>
      )}

      {field.fieldType === FieldType.SELECT && (
        <Select name={name} defaultValue={(defaultValue as string) ?? undefined}>
          <SelectTrigger id={name} className="w-full">
            <SelectValue placeholder="Choose…" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field.fieldType === FieldType.MULTI_SELECT && (
        <div className="flex flex-wrap gap-3 pt-1">
          {options.map((option) => (
            <label key={option} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                name={name}
                value={option}
                className="h-4 w-4"
                defaultChecked={Array.isArray(defaultValue) && defaultValue.includes(option)}
              />
              {option}
            </label>
          ))}
        </div>
      )}

      {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
      {error && <p className="text-xs text-destructive">{error[0]}</p>}
    </div>
  );
}

function toDateInputValue(value: FieldValue): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") return value.slice(0, 10);
  return "";
}
