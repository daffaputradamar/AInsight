/**
 * API Client for AInsight Backend
 */

import type { OrchestrationState, SchemaMetadata, DataInsightOutput, StreamChunk, DbConfig, ModelsResponse, ChatHistoryMessage } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * Get or create a unique session ID for this browser tab
 */
function getSessionId(): string {
  if (typeof window === "undefined") {
    return "server-side";
  }
  
  let sessionId = sessionStorage.getItem("ainsight_session_id");
  if (!sessionId) {
    sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem("ainsight_session_id", sessionId);
  }
  return sessionId;
}

/**
 * Get common headers including model selection and session ID
 */
function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  
  if (typeof window !== "undefined") {
    // Add session ID for session isolation
    headers["X-Session-Id"] = getSessionId();
    
    const selectedModel = sessionStorage.getItem("ainsight_model");
    if (selectedModel) {
      headers["X-AI-Model"] = selectedModel;
    }
  }
  
  return headers;
}

/**
 * Process a natural language query
 */
export async function processQuery(query: string, chatHistory?: ChatHistoryMessage[]): Promise<OrchestrationState> {
  const response = await fetch(`${API_BASE_URL}/api/query`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ query, chatHistory }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Process query with streaming updates
 */
export async function processQueryStream(
  query: string,
  onChunk: (chunk: StreamChunk) => void,
  chatHistory?: ChatHistoryMessage[]
): Promise<OrchestrationState> {
  // For now, simulate streaming with progress updates
  // The backend can be updated later to support actual SSE streaming
  
  onChunk({ type: "stage", stage: "understanding", message: "Understanding your query..." });
  
  const response = await fetch(`${API_BASE_URL}/api/query`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ query, chatHistory }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    onChunk({ type: "error", message: error.error || `HTTP ${response.status}` });
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  const result = await response.json();
  
  // Emit stage completions based on response
  if (result.responses) {
    for (const resp of result.responses) {
      onChunk({ type: "stage", stage: resp.stage, message: `Completed ${resp.stage}` });
    }
  }
  
  onChunk({ type: "result", data: result });
  return result;
}

/**
 * Get database schema metadata
 */
export async function getSchema(): Promise<SchemaMetadata> {
  const response = await fetch(`${API_BASE_URL}/api/schema`, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Get AI-generated insights about the data
 */
export async function getInsights(): Promise<DataInsightOutput> {
  const response = await fetch(`${API_BASE_URL}/api/insights`, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  // Extract insights from the response
  const data = await response.json();
  // The response is an AgentResponse with { stage, output, timestamp }
  return data.output || {
    datasetDescription: "Unable to analyze dataset",
    suggestedQuestions: [],
    tableCount: 0,
  };
}

/**
 * Health check
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get current database configuration
 */
export async function getDbConfig(): Promise<Omit<DbConfig, 'password'>> {
  const response = await fetch(`${API_BASE_URL}/api/config/db`, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Check if database is configured
 */
export async function checkDbStatus(): Promise<{ configured: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/config/db/status`, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Update database configuration
 */
export async function setDbConfig(config: DbConfig): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/config/db`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  
  // Store in sessionStorage for this tab
  if (typeof window !== "undefined") {
    sessionStorage.setItem("ainsight_db_config", JSON.stringify(config));
  }
}

/**
 * Get available AI models
 */
export async function getAvailableModels(): Promise<ModelsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/config/models`, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Set selected AI model (stored in sessionStorage, sent via header)
 */
export function setSelectedModel(modelId: string): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem("ainsight_model", modelId);
  }
}

/**
 * Get selected AI model from sessionStorage
 */
export function getSelectedModel(): string | null {
  if (typeof window !== "undefined") {
    return sessionStorage.getItem("ainsight_model");
  }
  return null;
}

/**
 * Get stored DB config from sessionStorage
 */
export function getStoredDbConfig(): DbConfig | null {
  if (typeof window !== "undefined") {
    const stored = sessionStorage.getItem("ainsight_db_config");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Check if DB is configured locally (without API call)
 */
export function isDbConfiguredLocally(): boolean {
  return getStoredDbConfig() !== null;
}

/**
 * Clear all session data (for reset)
 */
export function clearSessionData(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("ainsight_db_config");
    sessionStorage.removeItem("ainsight_model");
    // Keep session ID so the backend can clean up the old connection
  }
}

/**
 * Get the current session ID
 */
export { getSessionId };
