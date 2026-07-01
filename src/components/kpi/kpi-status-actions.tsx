"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { activateKpi, archiveKpi, deleteKpi } from "@/actions/kpi";
import { KpiStatus } from "@/generated/prisma/enums";

export function KpiStatusActions({
  kpiId,
  status,
  activationBlockers,
}: {
  kpiId: string;
  status: KpiStatus;
  activationBlockers: string[];
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
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status !== KpiStatus.ACTIVE && (
          <Button
            type="button"
            variant="outline"
            disabled={isPending || activationBlockers.length > 0}
            onClick={() => run(() => activateKpi(kpiId))}
          >
            Activate
          </Button>
        )}
        {status !== KpiStatus.ARCHIVED && (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => run(() => archiveKpi(kpiId))}
          >
            Archive
          </Button>
        )}
        <Button
          type="button"
          variant="destructive"
          disabled={isPending}
          onClick={() => {
            if (confirm("Delete this KPI? This can't be undone.")) {
              run(() => deleteKpi(kpiId));
            }
          }}
        >
          Delete
        </Button>
      </div>
      {status !== KpiStatus.ACTIVE && activationBlockers.length > 0 && (
        <ul className="list-inside list-disc text-xs text-muted-foreground">
          {activationBlockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
