"use client";

import { useEffect, useState } from "react";
import { getInsights } from "@/lib/api";
import type { DataInsightOutput } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Lightbulb, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SuggestedQuestionsProps {
  onQuestionSelect: (question: string) => void;
}

export function SuggestedQuestions({ onQuestionSelect }: SuggestedQuestionsProps) {
  const [insights, setInsights] = useState<DataInsightOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getInsights();
      setInsights(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load insights");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInsights();
  }, []);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-4/5" />
        <Skeleton className="h-6 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        <Lightbulb className="mx-auto mb-2 h-8 w-8 opacity-50" />
        <p className="text-center">Unable to load suggestions</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadInsights}
          className="mt-2 w-full"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2 text-sm">
          <Lightbulb className="h-4 w-4" />
          Suggested Questions
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={loadInsights}
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>

      {insights?.datasetDescription && (
        <p className="text-xs text-muted-foreground">
          {insights.datasetDescription}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {insights?.suggestedQuestions.map((question, index) => (
          <Badge
            key={index}
            variant="outline"
            className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors py-1.5 px-3 text-xs font-normal"
            onClick={() => onQuestionSelect(question)}
          >
            {question}
          </Badge>
        ))}
      </div>

      {(!insights?.suggestedQuestions || insights.suggestedQuestions.length === 0) && (
        <p className="text-xs text-muted-foreground text-center">
          No suggestions available. Try asking a question!
        </p>
      )}
    </div>
  );
}
