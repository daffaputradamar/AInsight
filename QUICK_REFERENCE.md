# ADK.js Agent System - Quick Reference

## Setup (Copy-Paste)

```bash
# 1. Navigate to backend
cd backend

# 2. Install dependencies
npm install

# 3. Setup database
createdb agent_db
psql -U postgres -d agent_db < examples/sample_db_setup.sql

# 4. Configure environment
cp .env.example .env
# Edit .env with your OpenAI API key and DB credentials

# 5. Run the system
npm run dev              # HTTP API
npm run cli              # Interactive terminal
```

## Environment Variables

```bash
# Critical
AI_API_KEY=sk-your-key-here
DB_HOST=localhost
DB_NAME=agent_db
DB_USER=postgres
DB_PASSWORD=your_password

# Optional (defaults provided)
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o
TEMPERATURE=0.7
MAX_TOKENS=2000
PORT=3000
```

## HTTP API Quick Test

```bash
# Query the system
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What are the top 5 customers by revenue?"}'

# Get database schema
curl http://localhost:3000/api/schema

# Get dataset insights
curl http://localhost:3000/api/insights

# Health check
curl http://localhost:3000/health
```

## Example Queries

```
"Show me the top 10 customers by total spending"
"What is the average order value by country?"
"Which products have the lowest stock levels?"
"How many orders were placed each month?"
"What is the revenue breakdown by product category?"
"List all customers from the United States"
"Show me the most popular products"
```

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
├── examples/
│   └── sample_db_setup.sql
├── package.json
├── tsconfig.json
└── README.md
```

## Common Commands

```bash
# Development
npm run dev                 # Start HTTP server
npm run cli                 # Start interactive CLI
npm run build              # Build for production

# Production
npm start                  # Run compiled HTTP server
npm run start:cli          # Run compiled CLI

# Database
createdb agent_db                              # Create database
psql -d agent_db < examples/sample_db_setup.sql # Load sample data
psql -U postgres -d agent_db -c "\dt"          # List tables
```

## API Response Structure

```json
{
  "query": "User's original question",
  "schemaMetadata": {
    "tables": [
      {
        "name": "table_name",
        "columns": [
          {"name": "col", "type": "type", "nullable": false}
        ],
        "rowCount": 1000
      }
    ],
    "lastUpdated": "2025-02-05T..."
  },
  "responses": [
    {
      "stage": "understanding",
      "output": {"shouldVisualize": true, "intent": "analytics"},
      "timestamp": "2025-02-05T..."
    },
    {
      "stage": "generation",
      "output": {"code": "SELECT...", "language": "sql", "requiresVisualization": true},
      "timestamp": "2025-02-05T..."
    },
    {
      "stage": "execution",
      "output": {"success": true, "data": [...], "executionTime": 45},
      "timestamp": "2025-02-05T..."
    },
    {
      "stage": "reasoning",
      "output": {"explanation": "...", "insights": [...]},
      "timestamp": "2025-02-05T..."
    }
  ],
  "finalResult": {
    "data": [...],
    "explanation": "Natural language explanation",
    "insights": ["insight 1", "insight 2"],
    "executionTime": 45,
    "requiresVisualization": true
  }
}
```

## Agent Loop Stages

| Stage | Agent | Input | Output |
|-------|-------|-------|--------|
| 1 | QueryUnderstandingAgent | Query string | `{shouldVisualize, intent}` |
| 2 | CodeGenerationAgent | Query + schema | `{code, language, requiresVisualization}` |
| 3 | ExecutionAgent | Code + language | `{success, data, executionTime}` |
| 4 | ReasoningAgent | Query + results | `{explanation, insights}` |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `AI_API_KEY is required` | Add to `.env`: `AI_API_KEY=sk-...` |
| PostgreSQL connection failed | Check `.env` DB credentials, ensure PostgreSQL is running |
| "Port 3000 already in use" | Change PORT in `.env` or kill existing process |
| Module not found | Run `npm install` in backend directory |
| Schema is empty | Load sample data: `psql -d agent_db < examples/sample_db_setup.sql` |
| Dangerous SQL operation | Queries with DROP/DELETE/ALTER/CREATE are blocked |

## Sample Database

The example database includes:
- **customers**: 10 sample customers from different countries
- **products**: 10 products across different categories
- **orders**: 10 sample orders with related items
- **order_items**: 20 line items linking orders to products

To load:
```bash
psql -U postgres -d agent_db < backend/examples/sample_db_setup.sql
```

## Performance Tips

```bash
# Faster responses (trade-off: less creative)
TEMPERATURE=0.3
MAX_TOKENS=1000
npm run dev

# More detailed responses (trade-off: slower)
TEMPERATURE=0.9
MAX_TOKENS=4000
npm run dev

# Use faster model
AI_MODEL=gpt-4-mini
npm run dev
```

## Testing

```bash
# Test database connection
npm run dev

# Test API endpoint
curl http://localhost:3000/api/schema

# Test with sample query
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT COUNT(*) FROM customers"}'
```

## Production Deployment

### Docker
```bash
docker build -t adk-agent .
docker run -p 3000:3000 \
  -e AI_API_KEY=sk-... \
  -e DB_HOST=postgres \
  adk-agent
```

### Environment Variables (Production)
```bash
NODE_ENV=production
PORT=3000
AI_API_KEY=sk-your-production-key
DB_HOST=your-db-host
DB_NAME=your-db-name
DB_USER=your-db-user
DB_PASSWORD=your-db-password
```

## Documentation

- **Full Setup**: See `GETTING_STARTED.md`
- **Architecture**: See `SYSTEM_ARCHITECTURE.md`
- **API Reference**: See `backend/README.md`
- **Source Code**: See `backend/src/`

## Key Features

✅ Deterministic sequential agent loop  
✅ Safe SQL execution (no injection, no dangerous ops)  
✅ Sandboxed JavaScript environment  
✅ OpenAI-compatible LLM integration  
✅ PostgreSQL database support  
✅ HTTP API + Interactive CLI  
✅ Full error handling  
✅ Production-ready code  
✅ TypeScript with strict types  
✅ Comprehensive logging  

## Next Steps

1. Copy-paste the setup commands above
2. Start the system with `npm run dev`
3. Try example queries
4. Load your own data
5. Deploy to production
6. Read full documentation

---

**For detailed information**: See `GETTING_STARTED.md` and `SYSTEM_ARCHITECTURE.md`
