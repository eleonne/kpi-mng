import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EntryRowActions } from "./entry-row-actions";
import { fieldValueToDisplayString, readFieldValue } from "@/lib/field-values";
import type { KpiEntryWithValues } from "@/lib/calculations/kpi-summary";
import type { KpiFieldDefinition } from "@/generated/prisma/client";

export function EntryList({
  kpiId,
  entries,
  fieldDefinitions,
  primaryFieldKey,
}: {
  kpiId: string;
  entries: KpiEntryWithValues[];
  fieldDefinitions: KpiFieldDefinition[];
  primaryFieldKey: string | null;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No cases logged yet.</p>;
  }

  const summaryField =
    fieldDefinitions.find((f) => f.fieldKey === primaryFieldKey) ?? fieldDefinitions[0];

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          {summaryField && <TableHead>{summaryField.label}</TableHead>}
          <TableHead>Counts</TableHead>
          <TableHead>Evidence</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => {
          const summaryValue = summaryField
            ? fieldValueToDisplayString(
                readFieldValue(
                  summaryField.fieldType,
                  entry.fieldValues.find((v) => v.fieldDefinitionId === summaryField.id) ?? null,
                ),
              )
            : "—";

          return (
            <TableRow key={entry.id}>
              <TableCell>{entry.entryDate.toISOString().slice(0, 10)}</TableCell>
              {summaryField && <TableCell>{summaryValue}</TableCell>}
              <TableCell>
                <Badge variant={entry.countsTowardTarget ? "default" : "secondary"}>
                  {entry.countsTowardTarget ? "Yes" : "No"}
                </Badge>
              </TableCell>
              <TableCell className="max-w-[16rem] truncate text-sm text-muted-foreground">
                {entry.evidenceSource || "—"}
              </TableCell>
              <TableCell className="text-right">
                <EntryRowActions kpiId={kpiId} entryId={entry.id} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
