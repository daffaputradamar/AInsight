"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface DataTableProps {
  data: Record<string, unknown>[];
  maxRows?: number;
}

export function DataTable({ data, maxRows = 100 }: DataTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No data to display
      </div>
    );
  }

  // Get all unique column names from the data
  const columns = Array.from(
    new Set(data.flatMap((row) => Object.keys(row)))
  );

  // Limit rows for performance
  const displayData = data.slice(0, maxRows);
  const hasMore = data.length > maxRows;

  return (
    <div className="space-y-2">
      <ScrollArea className="w-full whitespace-nowrap rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column} className="font-semibold">
                  {formatColumnName(column)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayData.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {columns.map((column) => (
                  <TableCell key={column} className="font-mono text-xs">
                    {formatCellValue(row[column])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing {displayData.length} of {data.length} rows
        </span>
        {hasMore && (
          <span className="text-amber-600">
            {data.length - maxRows} more rows not shown (full data used for AI analysis)
          </span>
        )}
      </div>
    </div>
  );
}

function formatColumnName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    // Format numbers with locale-specific separators
    return value.toLocaleString();
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  // Truncate long strings
  const str = String(value);
  if (str.length > 100) {
    return str.slice(0, 100) + "...";
  }
  return str;
}
