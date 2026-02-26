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
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { VisualizationSpec } from "@/lib/types";

interface DataChartProps {
  data: Record<string, unknown>[];
  spec?: VisualizationSpec;
}

// Vibrant chart colors palette
const CHART_COLORS = [
  "#3b82f6", // Blue
  "#ec4899", // Pink
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#8b5cf6", // Violet
  "#06b6d4", // Cyan
  "#ef4444", // Red
  "#14b8a6", // Teal
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
    <div className="space-y-4 w-full">
      {spec?.title && (
        <h4 className="text-base font-semibold text-foreground">{spec.title}</h4>
      )}

      <div className="w-full h-[350px] rounded-lg border border-border bg-card p-4 shadow-sm">
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
  const chartConfig: ChartConfig = {
    value: {
      label: yAxis,
      color: CHART_COLORS[0],
    },
  };

  switch (chartType) {
    case "bar":
      return (
        <ChartContainer config={chartConfig} className="h-full w-full">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="value"
              name={yAxis}
              fill="var(--color-value)"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      );

    case "line":
      return (
        <ChartContainer config={chartConfig} className="h-full w-full">
          <LineChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              type="monotone"
              dataKey="value"
              name={yAxis}
              stroke="var(--color-value)"
              strokeWidth={3}
              dot={{ fill: "var(--color-value)", r: 5 }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ChartContainer>
      );

    case "pie":
      return (
        <div className="h-full w-full flex items-center justify-center">
          <PieChart width={300} height={300}>
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
              {(chartData as Array<{ name: string; value: number }>).map(
                (_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                  />
                )
              )}
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
        </div>
      );

    case "scatter":
      return (
        <ChartContainer config={chartConfig} className="h-full w-full">
          <ScatterChart
            margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
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
            <ChartTooltip
              content={<ChartTooltipContent hideLabel />}
              cursor={{ strokeDasharray: "3 3" }}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Scatter
              name={`${xAxis} vs ${yAxis}`}
              data={chartData}
              fill="var(--color-value)"
            />
          </ScatterChart>
        </ChartContainer>
      );

    default:
      // Fallback to bar chart
      return (
        <ChartContainer config={chartConfig} className="h-full w-full">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Bar dataKey="value" fill="var(--color-value)" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ChartContainer>
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
