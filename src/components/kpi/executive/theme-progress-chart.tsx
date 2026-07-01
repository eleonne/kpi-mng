"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface ThemeProgressDatum {
  theme: string;
  avgProgress: number;
  color: string;
}

export function ThemeProgressChart({ data }: { data: ThemeProgressDatum[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No KPIs to chart yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 56)}>
      <BarChart data={data} layout="vertical" margin={{ left: 24, right: 24 }}>
        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
        <YAxis type="category" dataKey="theme" width={160} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value) => [`${Math.round(Number(value))}%`, "Avg. progress"]} />
        <Bar dataKey="avgProgress" radius={[0, 6, 6, 0]} barSize={24}>
          {data.map((d) => (
            <Cell key={d.theme} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
