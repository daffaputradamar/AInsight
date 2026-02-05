export interface AgentInput {
  query: string;
  schemaMetadata?: unknown;
}

export interface QueryUnderstandingOutput {
  shouldVisualize: boolean;
  intent: string;
}

export interface CodeGenerationOutput {
  code: string;
  language: 'sql' | 'javascript';
  requiresVisualization: boolean;
}

export interface ExecutionResult {
  success: boolean;
  data?: unknown[];
  error?: string;
  executionTime: number;
}

export interface ReasoningOutput {
  explanation: string;
  insights: string[];
}

export interface DataInsightOutput {
  datasetDescription: string;
  suggestedQuestions: string[];
  tableCount: number;
}

export interface VisualizationSpec {
  type: 'bar' | 'line' | 'scatter' | 'pie' | 'table';
  title: string;
  xAxis?: string;
  yAxis?: string;
  data?: unknown[];
}

export interface AgentResponse {
  stage: 'understanding' | 'generation' | 'execution' | 'reasoning' | 'insight';
  output: unknown;
  timestamp: Date;
}
