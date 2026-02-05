# ADK.js Agent System - Architecture & Design

A comprehensive guide to the system architecture, agent design, and integration patterns.

## Executive Summary

The ADK.js Agent System is a production-grade multi-agent orchestration framework that implements a deterministic sequential agent loop for intelligent data analysis. It processes natural language queries through five specialized agents, each with a specific responsibility, ensuring safe execution and comprehensible output.

**Key Features**:
- ✅ Deterministic sequential processing (no branching or autonomy)
- ✅ Five specialized agents with distinct responsibilities
- ✅ OpenAI-compatible LLM integration
- ✅ PostgreSQL database with safe query execution
- ✅ Sandboxed JavaScript execution environment
- ✅ Comprehensive error handling and validation
- ✅ HTTP API and interactive CLI interfaces

## Agent Architecture

### 1. QueryUnderstandingAgent

**Purpose**: Classify user intent and determine if visualization is needed.

**Input**: Natural language query string

**Output**:
```typescript
{
  shouldVisualize: boolean;
  intent: string;
}
```

**Implementation Details**:
- Uses LLM classification (NOT keyword heuristics)
- Temperature: 0.3 (deterministic)
- Maximum tokens: 100 (fast)
- Strict JSON parsing with fallback
- Never explains reasoning

**Example**:
```
Input: "Show me sales by region over time"
Output: { shouldVisualize: true, intent: "analytics" }
```

### 2. CodeGenerationAgent

**Purpose**: Generate executable code (SQL or JavaScript) based on user query and database schema.

**Input**:
```typescript
{
  query: string;
  schema: SchemaMetadata;
  requiresVisualization: boolean;
}
```

**Output**:
```typescript
{
  code: string;          // Executable code
  language: 'sql' | 'javascript';
  requiresVisualization: boolean;
}
```

**Implementation Details**:
- Receives full schema metadata (tables, columns, types)
- Output is CODE ONLY (no explanations or comments)
- Never uses INSERT, UPDATE, DELETE, or DROP statements
- Automatically chooses SQL vs JavaScript based on task
- Extracts code from markdown fences (```sql, ```javascript)

**Schema Information Provided**:
```
Table: customers (1250 rows)
  - id: integer (not nullable)
  - name: text (not nullable)
  - email: text (nullable)
  - city: text (nullable)
  - country: text (nullable)
  - created_at: timestamp (nullable)

Table: orders (5000 rows)
  - id: integer (not nullable)
  - customer_id: integer (not nullable)
  - order_date: timestamp (nullable)
  - total_amount: numeric (not nullable)
  - status: text (nullable)
```

**Example**:
```
Input Query: "What are the top 5 customers by revenue?"
Schema: Full database schema
Output Code:
SELECT customer_id, SUM(total_amount) as revenue
FROM orders
GROUP BY customer_id
ORDER BY revenue DESC
LIMIT 5;
```

### 3. ExecutionAgent

**Purpose**: Safely execute generated code with protection against malicious operations.

**Input**:
```typescript
{
  code: string;
  language: 'sql' | 'javascript';
}
```

**Output**:
```typescript
{
  success: boolean;
  data?: unknown[];
  error?: string;
  executionTime: number;
}
```

**Safety Mechanisms**:

**SQL Validation**:
- Blocks dangerous patterns: DROP, DELETE, TRUNCATE, ALTER, CREATE
- Uses parameterized queries to prevent injection
- Validates patterns using regex
- Read-only by design

**JavaScript Sandboxing**:
- No access to `fs` module
- No access to `process` object
- No access to `network` APIs
- No `require()` available
- Operates in strict mode
- Receives clean data context only

**Example**:
```
Input SQL: SELECT customer_id, SUM(total_amount) FROM orders GROUP BY customer_id;
Output: { success: true, data: [{customer_id: 1, sum: 1299.97}, ...], executionTime: 45 }

Input JS: return data.map(x => ({...x, doubled: x.amount * 2}));
Output: { success: true, data: [...], executionTime: 12 }
```

### 4. ReasoningAgent

**Purpose**: Generate concise, natural language explanations of execution results.

**Input**:
```typescript
{
  query: string;
  executionResult: unknown;
}
```

**Output**:
```typescript
{
  explanation: string;      // 2-3 sentences max
  insights: string[];
}
```

**Implementation Details**:
- Response limited to 2-3 sentences
- Natural language ONLY (no code, no technical details)
- No mention of SQL, JavaScript, or internal mechanics
- Focuses on business insights
- Maximum tokens: 300

**Example**:
```
Query: "What are the top 5 customers by revenue?"
Data: [{customer_id: 3, revenue: 2499.96}, {customer_id: 6, revenue: 1099.99}, ...]
Output:
  explanation: "Customer 3 is your top spender with $2,499.96 in total revenue. Customers 6 and 1 follow with $1,099.99 and $1,299.97 respectively. These three customers represent significant revenue streams."
  insights: ["Top 3 customers account for 25% of revenue", "Average order value for top customer is $833.32"]
```

### 5. DataInsightAgent

**Purpose**: Analyze database schema and generate insights on startup.

**Input**: Database schema metadata

**Output**:
```typescript
{
  datasetDescription: string;    // 1-2 sentences
  suggestedQuestions: string[];  // 3-5 realistic questions
  tableCount: number;
}
```

**Implementation Details**:
- Runs once on system initialization
- Cached for performance
- Generates realistic, analytical questions
- Provides dataset overview

**Example**:
```
Output:
  datasetDescription: "This database contains customer, product, and order information with 5 tables representing an e-commerce system. It tracks customers across multiple countries and their purchases over time."
  suggestedQuestions: [
    "What are the top 10 customers by revenue?",
    "How many orders are placed daily?",
    "What is the average order value by country?",
    "Which products have the highest margins?",
    "What is the customer acquisition trend?"
  ]
  tableCount: 5
```

## System Flow

### Orchestration Loop

The system processes queries through a deterministic sequential pipeline:

```
1. USER INPUT
   └─ User submits natural language query

2. QUERY UNDERSTANDING
   ├─ Classify intent
   ├─ Determine visualization needs
   └─ Return boolean + intent description

3. CODE GENERATION
   ├─ Receive query + schema metadata
   ├─ Choose SQL or JavaScript
   ├─ Generate executable code
   └─ Return code-only output

4. EXECUTION
   ├─ Validate SQL (if applicable)
   ├─ Execute in sandbox
   ├─ Return results or error
   └─ Record execution time

5. REASONING
   ├─ Analyze results
   ├─ Generate explanation
   ├─ Extract insights
   └─ Return natural language output

6. RESPONSE
   └─ Combine all outputs for user
```

### State Management

The orchestrator maintains full state:

```typescript
interface OrchestrationState {
  query: string;                          // Original user query
  schemaMetadata: SchemaMetadata;         // Full schema for reference
  responses: Array<{
    stage: string;                        // 'understanding' | 'generation' | ...
    output: unknown;                      // Agent output
    timestamp: Date;                      // When stage completed
  }>;
  finalResult: {
    data: unknown[];                      // Execution results
    explanation: string;                  // Reasoning output
    insights: string[];                   // Key insights
    executionTime: number;                // Total time
    requiresVisualization: boolean;       // From understanding stage
  };
}
```

## Data Flow Architecture

```
┌─────────────────┐
│  User Query     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ QueryUnderstandingAgent              │
│ (LLM Classification)                 │
│ Temperature: 0.3, MaxTokens: 100     │
└────────┬────────────────────────────┘
         │ Output: {shouldVisualize, intent}
         │
         ▼
┌─────────────────────────────────────┐
│ CodeGenerationAgent                  │
│ + Schema Metadata                    │
│ (LLM Code Generation)                │
│ Temperature: 0.7, MaxTokens: 2000    │
└────────┬────────────────────────────┘
         │ Output: {code, language, requiresVisualization}
         │
         ▼
┌─────────────────────────────────────┐
│ ExecutionAgent                       │
│ ├─ SQL Validator (pattern matching)  │
│ ├─ SQL Executor (pg library)         │
│ └─ JS Sandbox (Function constructor) │
└────────┬────────────────────────────┘
         │ Output: {success, data, executionTime}
         │
         ▼
┌─────────────────────────────────────┐
│ ReasoningAgent                       │
│ (LLM Explanation)                    │
│ Temperature: 0.7, MaxTokens: 300     │
└────────┬────────────────────────────┘
         │ Output: {explanation, insights}
         │
         ▼
┌─────────────────────────────────────┐
│ Final Response                       │
│ ├─ Original Query                    │
│ ├─ All Stage Outputs                 │
│ ├─ Execution Results                 │
│ ├─ Natural Language Explanation      │
│ └─ Key Insights                      │
└─────────────────────────────────────┘
```

## Integration Points

### PostgreSQL Adapter

**Responsibilities**:
- Connection management
- Schema introspection
- Query execution
- SQL validation
- Result transformation

**Schema Introspection**:
```sql
-- Discovers all public tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public'

-- Discovers columns for each table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = $1

-- Counts rows
SELECT COUNT(*) FROM [table_name]
```

**Caching**:
- Schema cached for 5 minutes
- Manual refresh available
- Last updated timestamp

### LLM Client

**Configuration**:
```typescript
{
  apiKey: string;                    // From environment
  baseURL: string;                   // Supports OpenAI-compatible endpoints
  model: string;                     // e.g., 'gpt-4o', 'claude-3', etc.
  temperature: number;               // Per-agent configuration
  maxTokens: number;                 // Per-agent configuration
}
```

**Supported Providers**:
- OpenAI (default)
- Anthropic Claude
- Local LLMs (Ollama, LocalAI)
- Any OpenAI-compatible endpoint

## Security Architecture

### Input Validation

**SQL Validation**:
```typescript
const forbiddenPatterns = [
  /DROP\s+TABLE/i,
  /DELETE\s+FROM/i,
  /TRUNCATE/i,
  /ALTER\s+TABLE/i,
  /CREATE\s+TABLE/i,
];
```

**Query Parameters**:
- All queries use parameterized statements
- No string concatenation
- Prevents SQL injection

### Execution Sandboxing

**JavaScript**:
```typescript
const sandbox = {
  require: () => { throw new Error('...') },
  process: undefined,
  fs: undefined,
  fetch: undefined,
  XMLHttpRequest: undefined,
};
```

**Environment**:
- Strict mode enabled
- Function scope only
- No module access
- No I/O operations
- Limited computation time

### Error Handling

```typescript
try {
  // Execution
} catch (error) {
  return {
    success: false,
    error: error.message,
    executionTime: elapsed,
  };
}
```

## Performance Considerations

### Token Optimization

| Stage | Temperature | MaxTokens | Purpose |
|-------|------------|-----------|---------|
| Understanding | 0.3 | 100 | Fast, deterministic classification |
| Generation | 0.7 | 2000 | Balanced creativity and consistency |
| Execution | - | - | N/A (no LLM) |
| Reasoning | 0.7 | 300 | Natural explanation |

### Caching Strategy

- **Schema Cache**: 5 minutes TTL
- **Results**: Optional (via HTTP layer)
- **Manual Refresh**: Available via API

### Database Optimization

- Indexes on frequently queried columns
- Row count caching in schema metadata
- Connection pooling (pg library)
- Query timeout configuration

## Extension Points

### Adding Custom Agents

1. Create new agent class inheriting from base pattern
2. Implement input/output types
3. Add to orchestrator
4. Update agent loop

### Custom LLM Providers

- Any OpenAI-compatible endpoint
- Custom base URL configuration
- Per-provider API key handling

### Database Adapters

- Implement `SchemaMetadata` interface
- Add `executeQuery` method
- Integrate with orchestrator

## Testing Architecture

### Unit Tests

- Agent input/output validation
- SQL pattern matching
- JavaScript sandbox execution
- Error handling

### Integration Tests

- End-to-end query processing
- Database integration
- LLM response parsing
- Schema introspection

### Example Test Query

```typescript
const query = "Show me top 5 customers";
const result = await orchestrator.processQuery(query);

expect(result.responses).toHaveLength(4);
expect(result.responses[0].stage).toBe('understanding');
expect(result.finalResult.data).toBeDefined();
expect(result.finalResult.explanation).toBeTruthy();
```

## Deployment Architecture

### Development

```bash
npm run dev      # HTTP server with nodemon
npm run cli      # Interactive CLI
```

### Production

```bash
npm run build    # TypeScript → JavaScript
npm start        # HTTP server
```

### Docker

```dockerfile
FROM node:18-alpine
COPY backend /app
WORKDIR /app
RUN npm ci --production
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Variables

All configuration via environment (12-factor app):

```bash
# Required
AI_API_KEY=sk-...
DB_HOST=host
DB_NAME=name
DB_USER=user
DB_PASSWORD=pass

# Optional (with defaults)
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o
TEMPERATURE=0.7
MAX_TOKENS=2000
PORT=3000
```

## Monitoring and Logging

### Request Logging

```typescript
console.log('[Orchestrator] Starting agent loop for query:', query);
console.log('[Orchestrator] Stage 1: Query Understanding');
// ... per-stage logs
```

### Error Logging

```typescript
console.error('[Orchestrator] Execution failed:', error);
```

### Metrics

- Execution time per stage
- Row count returned
- Token usage per request
- Cache hit rate
- Error rate

## Future Enhancements

1. **Parallel Agent Execution** - Process independent stages concurrently
2. **Agent Reasoning** - Extended reasoning traces for complex queries
3. **Custom Prompts** - User-provided system prompts per agent
4. **Result Caching** - Cache identical queries
5. **MCP Integration** - Dockerized MCP tool support
6. **Workflow Persistence** - Save and resume agent loops
7. **Multi-Turn Conversations** - Context-aware follow-up queries
8. **Visualization Generation** - Direct chart generation

---

For deployment guides, API reference, and troubleshooting, see:
- `GETTING_STARTED.md` - Quick start and setup
- `backend/README.md` - Complete API documentation
