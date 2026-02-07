"use client";

import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/lib/types";
import { ResultPanel } from "@/components/results/result-panel";
import { User, Bot, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 p-4 w-full",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-xs mt-1",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div className={cn(
        "flex flex-col space-y-2 overflow-hidden",
        isUser ? "items-end max-w-[80%]" : "items-start flex-1"
      )}>
        <div className={cn(
          "flex items-center gap-2 px-1",
          isUser && "flex-row-reverse"
        )}>
          <span className="font-medium text-sm">
            {isUser ? "You" : "AInsight"}
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {isUser ? (
          <div className="bg-primary text-primary-foreground px-4 py-2 rounded-2xl rounded-tr-none shadow-xs text-sm">
            {message.content}
          </div>
        ) : (
          <div className="w-full bg-muted/30 p-4 rounded-2xl rounded-tl-none border border-border/50">
            <AssistantContent message={message} />
          </div>
        )}
      </div>
    </div>
  );
}

function AssistantContent({ message }: { message: ChatMessageType }) {
  if (message.isLoading) {
    return <LoadingState />;
  }

  if (message.error) {
    return <ErrorState error={message.error} />;
  }

  if (message.result) {
    // Check for errors in finalResult
    if (message.result.finalResult && 'error' in message.result.finalResult && typeof message.result.finalResult.error === 'string') {
      return <ErrorState error={message.result.finalResult.error} />;
    }

    // Extract generated code from the generation response
    const generationResponse = message.result.responses?.find(
      (r) => r.stage === 'generation'
    );
    const generatedCode =
      generationResponse?.output && typeof generationResponse.output === 'object' && generationResponse.output !== null && 'code' in generationResponse.output
        ? {
            code: (generationResponse.output as any).code,
            language: (generationResponse.output as any).language,
          }
        : undefined;

    // Get unique stages (since loops create duplicates)
    const uniqueStages = Array.from(
      new Set(message.result.responses?.map(r => r.stage) || [])
    );
    
    // Get iteration count
    const iterations = message.result.finalResult?.iterations ?? message.result.iterations ?? 0;

    return (
      <div className="space-y-3">
        {/* Show unique stages and iteration info */}
        <div className="flex flex-wrap gap-1 items-center">
          {uniqueStages.map((stage, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs">
              {stage}
            </Badge>
          ))}
          {/* Show iteration badge if refined more than once */}
          {iterations > 1 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs gap-1">
                    <RefreshCw className="h-3 w-3" />
                    Refined {iterations - 1}x
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">
                    AI refined the query {iterations - 1} time(s) to improve results.
                    {message.result.iterationHistory?.slice(-1)[0]?.evaluation?.reason && (
                      <span className="block mt-1 text-muted-foreground">
                        Final evaluation: {message.result.iterationHistory.slice(-1)[0].evaluation?.reason}
                      </span>
                    )}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Explanation text */}
        {message.result.finalResult?.explanation && (
          <p className="text-sm">{message.result.finalResult.explanation}</p>
        )}

        {/* Results panel with table/chart/code */}
        {message.result.finalResult?.data &&
          message.result.finalResult.data.length > 0 && (
            <ResultPanel
              data={message.result.finalResult.data}
              insights={message.result.finalResult.insights}
              visualizationSpec={message.result.finalResult.visualizationSpec}
              executionTime={message.result.finalResult.executionTime}
              generatedCode={generatedCode}
            />
          )}

        {/* Key insights */}
        {message.result.finalResult?.insights &&
          message.result.finalResult.insights.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Key Insights:
              </p>
              <ul className="text-sm space-y-1">
                {message.result.finalResult.insights.map((insight, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}
      </div>
    );
  }

  return <p className="text-sm">{message.content}</p>;
}

function LoadingState() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>Analyzing your query...</span>
    </div>
  );
}

function ErrorState({ error }: { error: string }) {
  return (
    <div className="flex items-start gap-2 text-sm text-destructive">
      <AlertCircle className="h-4 w-4 mt-0.5" />
      <div>
        <p className="font-medium">Error processing query</p>
        <p className="text-xs opacity-80">{error}</p>
      </div>
    </div>
  );
}
