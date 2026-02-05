# ADK.js Agent System

A production-grade, multi-agent orchestration system implementing a sequential agent loop for intelligent data analysis and code generation. Built with TypeScript, OpenAI-compatible APIs, and PostgreSQL.

## Architecture

The system implements a deterministic sequential agent pipeline:

```
User Query
    ↓
QueryUnderstandingAgent (Intent Classification)
    ↓
CodeGenerationAgent (SQL/JS Generation)
    ↓
ExecutionAgent (Safe Sandboxed Execution)
    ↓
ReasoningAgent (Natural Language Explanation)
    ↓
Final User Response
```

### Agents

1. **QueryUnderstandingAgent**: Classifies user intent and determines if visualization is needed. Returns strict boolean output.

2. **CodeGenerationAgent**: Generates executable SQL or JavaScript based on user query and database schema. Output is code-only with no explanations.

3. **ExecutionAgent**: Safely executes generated code with:
   - SQL: Parameterized queries with injection protection
   - JavaScript: Sandboxed execution environment (no fs, network, require)

4. **ReasoningAgent**: Produces concise 2-3 sentence natural language explanations of results without mentioning technical details.

5. **DataInsightAgent**: Analyzes database schema on startup to generate dataset description and suggested analytical questions.

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 12+
- OpenAI API key (or compatible endpoint)

### Setup

1. **Install dependencies**:

```bash
cd backend
npm install
```

2. **Configure environment**:

```bash
cp .env.example .env
# Edit .env with your credentials
```

3. **Run the system**:

**HTTP Server**:
```bash
npm run dev
```

**Interactive CLI**:
```bash
npm run cli
```

## API Endpoints

### POST /api/query
Process a natural language query through the agent loop.

**Request**:
```json
{
  "query": "What are the top 5 customers by revenue?"
}
```

**Response**:
```json
{
  "query": "What are the top 5 customers by revenue?",
  "schemaMetadata": { /* ... */ },
  "responses": [
    {
      "stage": "understanding",
      "output": { "shouldVisualize": true, "intent": "analytics" },
      "timestamp": "2025-02-05T..."
    },
    {
      "stage": "generation",
      "output": { "code": "SELECT...", "language": "sql", "requiresVisualization": true },
      "timestamp": "2025-02-05T..."
    },
    {
      "stage": "execution",
      "output": { "success": true, "data": [...], "executionTime": 45 },
      "timestamp": "2025-02-05T..."
    },
    {
      "stage": "reasoning",
      "output": { "explanation": "...", "insights": [...] },
      "timestamp": "2025-02-05T..."
    }
  ],
  "finalResult": {
    "data": [...],
    "explanation": "...",
    "insights": [...],
    "executionTime": 45,
    "requiresVisualization": true
  }
}
```

### GET /api/schema
Retrieve current database schema metadata.

**Response**:
```json
{
  "tables": [
    {
      "name": "customers",
      "columns": [
        { "name": "id", "type": "integer", "nullable": false },
        { "name": "name", "type": "text", "nullable": false }
      ],
      "rowCount": 1250
    }
  ],
  "lastUpdated": "2025-02-05T..."
}
```

### GET /api/insights
Get AI-generated insights about the dataset.

**Response**:
```json
{
  "stage": "insight",
  "output": {
    "datasetDescription": "This database contains customer and order data...",
    "suggestedQuestions": [
      "What are the top 10 customers by revenue?",
      "How many orders are placed daily?",
      "What is the average order value?"
    ],
    "tableCount": 5
  },
  "timestamp": "2025-02-05T..."
}
```

### GET /health
Health check endpoint.

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| AI_API_KEY | - | OpenAI API key (required) |
| AI_BASE_URL | https://api.openai.com/v1 | LLM endpoint URL |
| AI_MODEL | gpt-4o | Model identifier |
| DB_HOST | localhost | PostgreSQL host |
| DB_PORT | 5432 | PostgreSQL port |
| DB_NAME | agent_db | Database name |
| DB_USER | postgres | Database user |
| DB_PASSWORD | postgres | Database password |
| TEMPERATURE | 0.7 | LLM temperature (0-1) |
| MAX_TOKENS | 2000 | Maximum response tokens |
| ENABLE_REASONING | true | Enable reasoning agent |
| PORT | 3000 | Server port |
| NODE_ENV | development | Environment |

## Security

- **SQL Injection Protection**: Uses parameterized queries via pg library
- **Dangerous Operations Blocked**: Prevents DROP, DELETE, TRUNCATE, ALTER, CREATE
- **Sandboxed JavaScript**: No access to fs, network, or require()
- **Read-Only by Design**: Execution agent validates SQL before running

## Project Structure

```
backend/
├── src/
│   ├── agents/
│   │   ├── QueryUnderstandingAgent.ts
│   │   ├── CodeGenerationAgent.ts
│   │   ├── ExecutionAgent.ts
│   │   ├── ReasoningAgent.ts
│   │   ├── DataInsightAgent.ts
│   │   └── types.ts
│   ├── adapters/
│   │   └── postgres.ts
│   ├── config/
│   │   └── llm.ts
│   ├── orchestration/
│   │   └── AgentOrchestrator.ts
│   ├── server.ts
│   └── cli.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Development

### Build

```bash
npm run build
```

### Type Checking

```bash
npx tsc --noEmit
```

### Running in Development

```bash
npm run dev      # HTTP server with hot reload
npm run cli      # Interactive CLI
```

## Example Usage

### Via HTTP

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Show me sales trends over time"}'
```

### Via CLI

```
Query: What are the top revenue-generating products?

=== Agent Loop Results ===

1. Query Understanding:
   Intent: analytics
   Visualize: true

2. Code Generation:
   Language: sql
   Code:
   SELECT product_id, SUM(amount) as total_revenue
   FROM orders
   GROUP BY product_id
   ORDER BY total_revenue DESC
   LIMIT 10;

3. Execution:
   Success: true
   Time: 23ms
   Rows: 10
   Sample: {"product_id": 42, "total_revenue": 45230.50}

4. Reasoning:
   The analysis reveals that product 42 generates the highest revenue at $45,230.50. Products 15 and 28 follow closely, suggesting strong market demand for these items.
```

## Advanced Features

### Custom Models

Change the AI model by setting `AI_MODEL`:

```bash
AI_MODEL=gpt-4-turbo npm run dev
AI_MODEL=claude-3-opus npm run dev
```

### Local LLM Support

Use a local OpenAI-compatible endpoint:

```bash
AI_BASE_URL=http://localhost:8000/v1 npm run dev
```

### Reasoning Enhancement

Enable extended reasoning (if supported by model):

```bash
ENABLE_REASONING=true npm run dev
```

## Troubleshooting

### Database Connection Error

```
Error: Failed to connect to PostgreSQL
```

- Check `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- Ensure PostgreSQL is running
- Test connection: `psql -h localhost -U postgres -d agent_db`

### API Key Error

```
AI_API_KEY environment variable is required
```

- Set `AI_API_KEY` in your `.env` file
- Or export it: `export AI_API_KEY=sk-...`

### Schema Not Found

- Run the system after creating tables in PostgreSQL
- Use `GET /api/schema` to verify tables are detected

## License

MIT
