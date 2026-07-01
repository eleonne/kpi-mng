"use client";

import { useActionState, useState } from "react";
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
import { MeasurementType } from "@/generated/prisma/enums";
import type { ActionState } from "@/actions/kpi";

const MEASUREMENT_TYPE_LABELS: Record<MeasurementType, string> = {
  [MeasurementType.COUNT]: "Count — raw number of qualifying cases",
  [MeasurementType.PERCENTAGE_OF_ENTRIES]: "Percentage of logged cases",
  [MeasurementType.PERCENTAGE_OF_FIXED_POPULATION]: "Percentage of a fixed population",
};

export interface KpiFormDefaultValues {
  name?: string;
  theme?: string;
  objective?: string;
  owner?: string;
  measurementType?: MeasurementType;
  targetValue?: number;
  targetUnit?: string;
  targetPeriodLabel?: string;
  measurementFormulaText?: string;
  qualificationCriteriaText?: string;
  populationSize?: number;
  primaryFieldKey?: string;
}

interface KpiFormProps {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: KpiFormDefaultValues;
  primaryFieldOptions?: { fieldKey: string; label: string }[];
  submitLabel: string;
}

export function KpiForm({ action, defaultValues, primaryFieldOptions, submitLabel }: KpiFormProps) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);
  const [measurementType, setMeasurementType] = useState<MeasurementType>(
    defaultValues?.measurementType ?? MeasurementType.COUNT,
  );

  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" error={errors.name}>
          <Input id="name" name="name" defaultValue={defaultValues?.name} required />
        </Field>
        <Field label="Theme" name="theme" error={errors.theme} hint="Dashboard grouping tag, optional">
          <Input id="theme" name="theme" defaultValue={defaultValues?.theme} />
        </Field>
      </div>

      <Field label="Objective" name="objective" error={errors.objective}>
        <Textarea id="objective" name="objective" rows={2} defaultValue={defaultValues?.objective} required />
      </Field>

      <Field label="Owner" name="owner" error={errors.owner} hint="Person or role accountable, optional">
        <Input id="owner" name="owner" defaultValue={defaultValues?.owner} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Measurement type" name="measurementType" error={errors.measurementType}>
          <Select
            name="measurementType"
            value={measurementType}
            onValueChange={(v) => setMeasurementType(v as MeasurementType)}
          >
            <SelectTrigger id="measurementType" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(MeasurementType).map((type) => (
                <SelectItem key={type} value={type}>
                  {MEASUREMENT_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Target value" name="targetValue" error={errors.targetValue}>
          <Input
            id="targetValue"
            name="targetValue"
            type="number"
            step="any"
            defaultValue={defaultValues?.targetValue}
            required
          />
        </Field>
        <Field label="Target unit" name="targetUnit" error={errors.targetUnit} hint="e.g. cases, sessions">
          <Input id="targetUnit" name="targetUnit" defaultValue={defaultValues?.targetUnit} />
        </Field>
      </div>

      {measurementType === MeasurementType.PERCENTAGE_OF_FIXED_POPULATION && (
        <div className="grid gap-4 rounded-md border p-4 sm:grid-cols-2">
          <Field
            label="Population size"
            name="populationSize"
            error={errors.populationSize}
            hint="e.g. total number of teams"
          >
            <Input
              id="populationSize"
              name="populationSize"
              type="number"
              min={1}
              defaultValue={defaultValues?.populationSize}
            />
          </Field>
          <Field
            label="Primary field"
            name="primaryFieldKey"
            error={errors.primaryFieldKey}
            hint="Text/Select field used to count distinct qualifying cases"
          >
            <Select name="primaryFieldKey" defaultValue={defaultValues?.primaryFieldKey ?? "__none__"}>
              <SelectTrigger id="primaryFieldKey" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  {primaryFieldOptions?.length ? "Choose a field…" : "No fields yet — add one first"}
                </SelectItem>
                {primaryFieldOptions?.map((f) => (
                  <SelectItem key={f.fieldKey} value={f.fieldKey}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      )}

      <Field label="Target period" name="targetPeriodLabel" error={errors.targetPeriodLabel} hint="e.g. Year-end 2026">
        <Input id="targetPeriodLabel" name="targetPeriodLabel" defaultValue={defaultValues?.targetPeriodLabel} />
      </Field>

      <Field
        label="Measurement formula"
        name="measurementFormulaText"
        error={errors.measurementFormulaText}
        hint="Human-readable formula, shown as help text"
      >
        <Textarea
          id="measurementFormulaText"
          name="measurementFormulaText"
          rows={2}
          defaultValue={defaultValues?.measurementFormulaText}
        />
      </Field>

      <Field
        label="Qualification criteria"
        name="qualificationCriteria"
        error={errors.qualificationCriteria}
        hint="One per line — shown as a reminder when logging a case"
      >
        <Textarea
          id="qualificationCriteria"
          name="qualificationCriteria"
          rows={4}
          defaultValue={defaultValues?.qualificationCriteriaText}
        />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  error,
  hint,
  children,
}: {
  label: string;
  name: string;
  error?: string[];
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error[0]}</p>}
    </div>
  );
}
