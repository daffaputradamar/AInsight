"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "./data-table";
import { DataChart } from "./data-chart";
import { CodeBlock } from "./code-block";
import type { VisualizationSpec } from "@/lib/types";
import { Table2, BarChart3, Code2, Clock, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ResultPanelProps {
  data: Record<string, unknown>[];
  insights?: string[];
  visualizationSpec?: VisualizationSpec;
  executionTime?: number;
  generatedCode?: { code: string; language: 'sql' | 'javascript' };
  error?: string;
}

export function ResultPanel({
  data,
  insights,
  visualizationSpec,
  executionTime,
  generatedCode,
  error,
}: ResultPanelProps) {
  const [activeTab, setActiveTab] = useState<string>(
    visualizationSpec ? "chart" : "table"
  );

  const showChart = data.length > 0 && data.length <= 100;

  // Display error if present
  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Query Error</AlertTitle>
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between px-4 pt-3">
          <TabsList>
            {generatedCode && (
              <TabsTrigger value="code" className="gap-1.5">
                <Code2 className="h-4 w-4" />
                Query
              </TabsTrigger>
            )}
            <TabsTrigger value="table" className="gap-1.5">
              <Table2 className="h-4 w-4" />
              Table
            </TabsTrigger>
            {showChart && (
              <TabsTrigger value="chart" className="gap-1.5">
                <BarChart3 className="h-4 w-4" />
                Chart
              </TabsTrigger>
            )}
          </TabsList>

          {executionTime !== undefined && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {executionTime}ms
            </div>
          )}
        </div>

        <CardContent className="pt-4">
          {generatedCode && (
            <TabsContent value="code" className="mt-0">
              <CodeBlock
                code={generatedCode.code}
                language={generatedCode.language}
                title={`Generated ${generatedCode.language.toUpperCase()}`}
              />
            </TabsContent>
          )}

          <TabsContent value="table" className="mt-0">
            <DataTable data={data} />
          </TabsContent>

          {showChart && (
            <TabsContent value="chart" className="mt-0">
              <DataChart data={data} spec={visualizationSpec} />
            </TabsContent>
          )}
        </CardContent>
      </Tabs>
    </Card>
  );
}
