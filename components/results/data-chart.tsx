"use client";

import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  Scatter,
  ScatterChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ZAxis,
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

  // If spec says table, don't render a chart
  if (spec?.type === "table") {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Data is best viewed as a table
      </div>
    );
  }

  // Auto-detect chart type and axes if not specified
  const chartType = spec?.type || detectChartType(data);
  const { xAxis, yAxis } = spec?.xAxis && spec?.yAxis
    ? { xAxis: spec.xAxis, yAxis: spec.yAxis }
    : detectAxes(data);

  // Transform data for charting
  const chartData = chartType === "scatter"
    ? transformDataForScatter(data, xAxis, yAxis)
    : transformDataForChart(data, xAxis, yAxis);

  return (
    <div className="space-y-2">
      {spec?.title && (
        <h4 className="text-sm font-medium text-center">{spec.title}</h4>
      )}
      
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart(chartType, chartData, xAxis, yAxis)}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function renderChart(
  chartType: string,
  chartData: { name: string; value: number }[] | { x: number; y: number }[],
  xAxis: string,
  yAxis: string
) {
  switch (chartType) {
    case "bar":
      return (
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
            }}
          />
          <Legend />
          <Bar dataKey="value" name={yAxis} fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
        </BarChart>
      );

    case "line":
      return (
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
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
            name={yAxis}
            stroke={CHART_COLORS[0]}
            strokeWidth={2}
            dot={{ fill: CHART_COLORS[0] }}
          />
        </LineChart>
      );

    case "pie":
      return (
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
      );

    case "scatter":
      return (
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            type="number"
            dataKey="x"
            name={xAxis}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={yAxis}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <ZAxis range={[60, 60]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
            }}
          />
          <Legend />
          <Scatter name={`${xAxis} vs ${yAxis}`} data={chartData} fill={CHART_COLORS[0]} />
        </ScatterChart>
      );

    default:
      // Fallback to bar chart
      return (
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="value" fill={CHART_COLORS[0]} />
        </BarChart>
      );
  }
}

function detectChartType(data: Record<string, unknown>[]): "bar" | "line" | "pie" | "scatter" {
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
  
  // Check if data looks like correlation (two numeric columns)
  const numericColumns = keys.filter((k) => typeof data[0][k] === "number");
  if (numericColumns.length >= 2 && !hasDateColumn) {
    return "scatter";
  }
  
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

function transformDataForScatter(
  data: Record<string, unknown>[],
  xAxis: string,
  yAxis: string
): { x: number; y: number }[] {
  return data.slice(0, 50).map((row) => ({
    x: Number(row[xAxis]) || 0,
    y: Number(row[yAxis]) || 0,
  }));
}
