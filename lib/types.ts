/**
 * Frontend Types for AInsight
 * Mirrors backend types for type safety
 */

// Database Schema Types
export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
}

export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
  rowCount: number;
}

export interface SchemaMetadata {
  tables: TableSchema[];
  lastUpdated: Date;
}

// Agent Response Types
export interface QueryUnderstandingOutput {
  intent: string;
  entities: string[];
  shouldVisualize: boolean;
  visualizationType?: "bar" | "line" | "scatter" | "pie" | "table";
}

export interface CodeGenerationOutput {
  code: string;
  language: "sql" | "javascript";
  explanation: string;
  requiresVisualization: boolean;
}

export interface ExecutionResult {
  success: boolean;
  data?: Record<string, unknown>[];
  error?: string;
  executionTime: number;
}

export interface ReasoningOutput {
  explanation: string;
  keyFindings: string[];
  suggestedFollowUp?: string[];
}

export interface DataInsightOutput {
  datasetDescription: string;
  suggestedQuestions: string[];
  tableCount: number;
}

export interface VisualizationSpec {
  type: "bar" | "line" | "scatter" | "pie" | "table";
  title: string;
  xAxis?: string;
  yAxis?: string;
  data?: unknown[];
}

// Orchestration Types
export type AgentStage = "understanding" | "generation" | "execution" | "reasoning" | "insight";

export interface AgentResponse {
  stage: AgentStage;
  output: unknown;
  timestamp: Date;
}

export interface EvaluationOutput {
  satisfiesQuery: boolean;
  reason: string;
  suggestedRefinement?: string;
}

export interface IterationInfo {
  iteration: number;
  refinementContext?: string;
  evaluation?: EvaluationOutput;
}

export interface OrchestrationState {
  query: string;
  schemaMetadata: SchemaMetadata;
  responses: AgentResponse[];
  finalResult: {
    data: Record<string, unknown>[];
    explanation: string;
    insights: string[];
    executionTime: number;
    requiresVisualization: boolean;
    visualizationSpec?: VisualizationSpec;
    iterations?: number;
    iterationHistory?: IterationInfo[];
  } | null;
  iterations?: number;
  iterationHistory?: IterationInfo[];
}

// Chat UI Types
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  result?: OrchestrationState;
  error?: string;
}

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

// Streaming Types
export interface StreamChunk {
  type: "stage" | "progress" | "result" | "error";
  stage?: AgentStage;
  message?: string;
  data?: unknown;
}

// Database Configuration Types
export interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
}

// Model Selection Types
export interface ModelInfo {
  id: string;
  name: string;
  model: string;
}

export interface ModelsResponse {
  models: ModelInfo[];
  current: string;
}

// App Settings (stored in sessionStorage)
export interface AppSettings {
  dbConfig?: DbConfig;
  selectedModel?: string;
}
