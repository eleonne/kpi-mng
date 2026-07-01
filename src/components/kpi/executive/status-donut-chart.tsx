"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export interface StatusSlice {
  name: string;
  value: number;
  color: string;
}

export function StatusDonutChart({ data }: { data: StatusSlice[] }) {
  const nonEmpty = data.filter((d) => d.value > 0);

  if (nonEmpty.length === 0) {
    return <p className="text-sm text-muted-foreground">No KPIs to chart yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={nonEmpty}
          dataKey="value"
          nameKey="name"
          innerRadius={60}
          outerRadius={95}
          paddingAngle={2}
          strokeWidth={2}
        >
          {nonEmpty.map((slice) => (
            <Cell key={slice.name} fill={slice.color} />
          ))}
        </Pie>
        <Tooltip />
        <Legend verticalAlign="bottom" height={36} />
      </PieChart>
    </ResponsiveContainer>
  );
}
