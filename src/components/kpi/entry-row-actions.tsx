"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { deleteKpiEntry } from "@/actions/entry";

export function EntryRowActions({ kpiId, entryId }: { kpiId: string; entryId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          render={<Link href={`/kpis/${kpiId}/entries/${entryId}/edit`} />}
          nativeButton={false}
        >
          Edit
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={isPending}
          onClick={() => {
            if (!confirm("Delete this case? This can't be undone.")) return;
            setError(null);
            startTransition(async () => {
              try {
                await deleteKpiEntry(kpiId, entryId);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Something went wrong.");
              }
            });
          }}
        >
          Delete
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
