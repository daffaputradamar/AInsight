"use client";

import { useEffect, useState, useCallback } from "react";
import { getSchema } from "@/lib/api";
import type { SchemaMetadata, TableSchema } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Table, Database, Columns, Hash, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SchemaViewerProps {
  refreshTrigger?: number;
}

export function SchemaViewer({ refreshTrigger }: SchemaViewerProps) {
  const [schema, setSchema] = useState<SchemaMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSchema = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSchema();
      setSchema(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schema");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchema();
  }, [loadSchema, refreshTrigger]);

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        <Database className="mx-auto mb-2 h-8 w-8 opacity-50" />
        <p className="text-center">Unable to load schema</p>
        <p className="text-center text-xs text-destructive">{error}</p>
      </div>
    );
  }

  if (!schema || schema.tables.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        <Database className="mx-auto mb-2 h-8 w-8 opacity-50" />
        <p className="text-center">No tables found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Database className="h-4 w-4" />
            Database Schema
          </h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={loadSchema}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {schema.tables.length} tables • Click to view columns
        </p>
      </div>
      <ScrollArea className="flex-1">
        <Accordion type="multiple" className="px-2">
          {schema.tables.map((table) => (
            <TableItem
              key={table.name}
              table={table}
            />
          ))}
        </Accordion>
      </ScrollArea>
    </div>
  );
}

interface TableItemProps {
  table: TableSchema;
}

function TableItem({ table }: TableItemProps) {
  return (
    <AccordionItem value={table.name} className="border-b-0">
      <AccordionTrigger
        className="py-2 hover:no-underline hover:bg-muted/50 px-2 rounded-md"
      >
        <div className="flex items-center gap-2 text-sm">
          <Table className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{table.name}</span>
          <Badge variant="secondary" className="ml-auto text-xs">
            {table.rowCount.toLocaleString()} rows
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-2">
        <div className="ml-6 space-y-1">
          {table.columns.map((column) => (
            <div
              key={column.name}
              className="flex items-center gap-2 text-xs py-1 px-2 rounded hover:bg-muted/30"
            >
              <Columns className="h-3 w-3 text-muted-foreground" />
              <span className="font-mono">{column.name}</span>
              <span className="text-muted-foreground ml-auto">
                {column.type}
              </span>
              {column.nullable && (
                <span title="Nullable">
                  <Hash className="h-3 w-3 text-muted-foreground" />
                </span>
              )}
            </div>
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
