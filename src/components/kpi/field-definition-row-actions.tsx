"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deactivateKpiField, deleteKpiField } from "@/actions/field-definition";

export function FieldDefinitionRowActions({
  kpiId,
  fieldId,
  isActive,
  canHardDelete,
}: {
  kpiId: string;
  fieldId: string;
  isActive: boolean;
  canHardDelete: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {isActive && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => run(() => deactivateKpiField(kpiId, fieldId))}
          >
            Deactivate
          </Button>
        )}
        {canHardDelete && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isPending}
            onClick={() => {
              if (confirm("Delete this field? This can't be undone.")) {
                run(() => deleteKpiField(kpiId, fieldId));
              }
            }}
          >
            Delete
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
