import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { KpiSummary } from "@/lib/calculations/kpi-summary";
import { KpiStatus } from "@/generated/prisma/enums";

interface KpiCardProps {
  kpi: {
    id: string;
    name: string;
    theme: string | null;
    status: KpiStatus;
    targetPeriodLabel: string | null;
  };
  summary: KpiSummary;
}

const statusVariant: Record<KpiStatus, "default" | "secondary" | "outline"> = {
  [KpiStatus.DRAFT]: "outline",
  [KpiStatus.ACTIVE]: "default",
  [KpiStatus.ARCHIVED]: "secondary",
};

export function KpiCard({ kpi, summary }: KpiCardProps) {
  return (
    <Link href={`/kpis/${kpi.id}`}>
      <Card className="h-full transition-colors hover:border-foreground/30">
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">{kpi.name}</CardTitle>
          <Badge variant={statusVariant[kpi.status]}>{kpi.status}</Badge>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className={`text-2xl font-semibold ${summary.targetMet ? "text-green-600" : ""}`}>
            {summary.displayValue}
          </p>
          <p className="text-sm text-muted-foreground">
            {kpi.theme ?? "Uncategorized"}
            {kpi.targetPeriodLabel ? ` · ${kpi.targetPeriodLabel}` : ""}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
