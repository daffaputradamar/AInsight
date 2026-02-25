"use client";

import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/lib/types";
import { ResultPanel } from "@/components/results/result-panel";
import { Button } from "@/components/ui/button";
import { User, Bot, AlertCircle, Loader2, RefreshCw, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChatMessageProps {
  message: ChatMessageType;
  onApproveQuery?: () => void;
  onModifyQuery?: (instruction: string) => void;
  onSelectChart?: (chartType: string) => void;
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

  // Handle query confirmation
  if (message.messageType === "query-confirmation" && message.result?.confirmation?.type === "query") {
    return <QueryConfirmation message={message} />;
  }

  // Handle chart recommendation
  if (message.messageType === "chart-recommendation" && message.result?.confirmation?.type === "chart") {
    return <ChartRecommendation message={message} />;
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

function QueryConfirmation({ message }: { message: ChatMessageType }) {
  const [copied, setCopied] = useState(false);
  const [modifyInput, setModifyInput] = useState("");
  const [showModifyInput, setShowModifyInput] = useState(false);

  const code = message.result?.confirmation?.type === "query" 
    ? message.result.confirmation.pendingCode.code 
    : "";
  const language = message.result?.confirmation?.type === "query" 
    ? message.result.confirmation.pendingCode.language 
    : "sql";

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleModify = () => {
    if (modifyInput.trim() && message.onModifyQuery) {
      message.onModifyQuery(modifyInput);
      setModifyInput("");
      setShowModifyInput(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          <RefreshCw className="h-3 w-3 mr-1" />
          Query Generated
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        I've generated a query for your request. Please review it before execution:
      </p>

      {/* Code Block */}
      <div className="bg-slate-950 rounded-lg p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">{language.toUpperCase()}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-6 w-6 p-0"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-slate-400 hover:text-slate-200" />
            )}
          </Button>
        </div>
        <pre className="text-xs text-slate-100 overflow-x-auto max-h-48 font-mono">
          <code>{code}</code>
        </pre>
      </div>

      {/* Modify Input */}
      {showModifyInput && (
        <div className="space-y-2">
          <label className="text-xs font-medium">What would you like to change?</label>
          <textarea
            value={modifyInput}
            onChange={(e) => setModifyInput(e.target.value)}
            placeholder="e.g., Add WHERE clause for 2024 only"
            className="w-full px-3 py-2 text-sm border rounded-lg bg-background"
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          variant="default"
          size="sm"
          onClick={() => message.onApproveQuery?.()}
          className="flex-1"
        >
          Approve & Execute
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (showModifyInput) {
              handleModify();
            } else {
              setShowModifyInput(true);
            }
          }}
          className="flex-1"
        >
          {showModifyInput ? "Apply Changes" : "Modify"}
        </Button>
      </div>
    </div>
  );
}

function ChartRecommendation({ message }: { message: ChatMessageType }) {
  const chartOptions = message.result?.confirmation?.type === "chart"
    ? message.result.confirmation.chartOptions
    : [];

  if (!chartOptions || chartOptions.length === 0) {
    return <p className="text-sm">Unable to load chart options.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          <RefreshCw className="h-3 w-3 mr-1" />
          Choose Chart Type
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        Data is ready! Here are my chart recommendations:
      </p>

      {/* Chart Options Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {chartOptions.map((option) => (
          <Button
            key={option.type}
            onClick={() => message.onSelectChart?.(option.type)}
            variant={option.isRecommended ? "default" : "outline"}
            className="h-auto py-3 px-4 justify-start flex-col items-start gap-1"
          >
            <div className="flex items-center gap-2 w-full">
              <span className="font-medium">{option.label}</span>
              {option.isRecommended && (
                <Badge variant="secondary" className="text-xs ml-auto">
                  Recommended
                </Badge>
              )}
            </div>
            <p className="text-xs opacity-75 text-left">
              {option.reasoning}
            </p>
          </Button>
        ))}
      </div>
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
