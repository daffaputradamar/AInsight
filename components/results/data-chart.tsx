"use client";

import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { VisualizationSpec } from "@/lib/types";

interface DataChartProps {
  data: Record<string, unknown>[];
  spec?: VisualizationSpec;
}

// Chart colors from CSS variables
const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function DataChart({ data, spec }: DataChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No data to visualize
      </div>
    );
  }

  // Auto-detect chart type and axes if not specified
  const chartType = spec?.type || detectChartType(data);
  const { xAxis, yAxis } = spec?.xAxis && spec?.yAxis
    ? { xAxis: spec.xAxis, yAxis: spec.yAxis }
    : detectAxes(data);

  // Transform data for charting
  const chartData = transformDataForChart(data, xAxis, yAxis);

  return (
    <div className="space-y-2">
      {spec?.title && (
        <h4 className="text-sm font-medium text-center">{spec.title}</h4>
      )}
      
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "bar" ? (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
              />
              <Legend />
              <Bar
                dataKey="value"
                fill={CHART_COLORS[0]}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          ) : chartType === "line" ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke={CHART_COLORS[0]}
                strokeWidth={2}
                dot={{ fill: CHART_COLORS[0] }}
              />
            </LineChart>
          ) : chartType === "pie" ? (
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name} (${(percent * 100).toFixed(0)}%)`
                }
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
              />
              <Legend />
            </PieChart>
          ) : (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill={CHART_COLORS[0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function detectChartType(data: Record<string, unknown>[]): "bar" | "line" | "pie" {
  if (data.length <= 5) return "pie";
  
  // Check if data looks like time series (has date/time column)
  const keys = Object.keys(data[0] || {});
  const hasDateColumn = keys.some(
    (k) =>
      k.toLowerCase().includes("date") ||
      k.toLowerCase().includes("time") ||
      k.toLowerCase().includes("month") ||
      k.toLowerCase().includes("year")
  );
  
  return hasDateColumn ? "line" : "bar";
}

function detectAxes(data: Record<string, unknown>[]): { xAxis: string; yAxis: string } {
  const keys = Object.keys(data[0] || {});
  
  // Find a string column for X axis (category)
  const xAxis = keys.find((k) => typeof data[0][k] === "string") || keys[0];
  
  // Find a numeric column for Y axis
  const yAxis = keys.find(
    (k) => typeof data[0][k] === "number" && k !== xAxis
  ) || keys[1] || keys[0];
  
  return { xAxis, yAxis };
}

function transformDataForChart(
  data: Record<string, unknown>[],
  xAxis: string,
  yAxis: string
): { name: string; value: number }[] {
  return data.slice(0, 20).map((row) => ({
    name: String(row[xAxis] || "Unknown"),
    value: Number(row[yAxis]) || 0,
  }));
}
