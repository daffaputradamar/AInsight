# ADK.js Agent System - Getting Started Guide

Welcome to the production-grade ADK.js Agent System! This guide will help you set up and run the multi-agent orchestration system.

## System Overview

This is a **deterministic sequential multi-agent system** that processes natural language queries through 5 specialized agents:

1. **Query Understanding** - Classifies intent and visualization needs
2. **Code Generation** - Creates safe, executable SQL or JavaScript
3. **Execution** - Runs code in sandboxed environments
4. **Reasoning** - Generates human-readable explanations
5. **Data Insight** - Provides analytical suggestions

## Quick Start (5 minutes)

### Step 1: Setup PostgreSQL Database

```bash
# Create database
psql -U postgres -c "CREATE DATABASE agent_db;"

# Load sample data
psql -U postgres -d agent_db < backend/examples/sample_db_setup.sql
```

### Step 2: Configure Environment

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your settings:

```
AI_API_KEY=sk-your-openai-key-here
DB_HOST=localhost
DB_PORT=5432
DB_NAME=agent_db
DB_USER=postgres
DB_PASSWORD=postgres
```

### Step 3: Install and Run

```bash
npm install

# Option A: HTTP Server
npm run dev

# Option B: Interactive CLI
npm run cli
```

## Detailed Setup

### Prerequisites

- **Node.js** 18+ (download from nodejs.org)
- **PostgreSQL** 12+ (download from postgresql.org)
- **OpenAI API Key** or compatible LLM endpoint

### Installation Steps

1. **Clone and Navigate**:
   ```bash
   cd backend
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Create Database**:
   ```bash
   # Using psql
   createdb agent_db
   
   # Or via psql prompt
   psql -U postgres
   CREATE DATABASE agent_db;
   \q
   ```

4. **Load Sample Data**:
   ```bash
   psql -U postgres -d agent_db -f examples/sample_db_setup.sql
   ```

5. **Configure Environment Variables**:
   ```bash
   cp .env.example .env
   ```

   Edit `.env`:
   ```
   # LLM Configuration
   AI_API_KEY=sk-...                           # Your OpenAI API key
   AI_BASE_URL=https://api.openai.com/v1       # API endpoint
   AI_MODEL=gpt-4o                              # Model to use
   
   # Database Configuration
   DB_HOST=localhost                            # PostgreSQL host
   DB_PORT=5432                                 # PostgreSQL port
   DB_NAME=agent_db                             # Database name
   DB_USER=postgres                             # DB user
   DB_PASSWORD=your_password                    # DB password
   
   # Agent Configuration
   TEMPERATURE=0.7                              # LLM temperature
   MAX_TOKENS=2000                              # Max response size
   
   # Server
   PORT=3000                                    # HTTP server port
   ```

### Verify Installation

```bash
# Test database connection
npm run dev

# You should see:
# PostgreSQL connection established
# ADK.js Agent System running on http://localhost:3000
```

## Running the System

### Option 1: HTTP Server

Runs as REST API for programmatic access:

```bash
npm run dev
```

**Endpoints**:
- `POST /api/query` - Process a query
- `GET /api/schema` - Get database schema
- `GET /api/insights` - Get data insights
- `GET /health` - Health check

**Example**:
```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Show me top 5 customers by revenue"}'
```

### Option 2: Interactive CLI

Interactive terminal interface:

```bash
npm run cli
```

**Features**:
- Dataset overview on startup
- Real-time query processing
- Step-by-step agent output
- Agent loop visualization

**Example**:
```
=== ADK.js Agent System CLI ===
Connected to PostgreSQL

Dataset: This database contains customer and order data...

Suggested Questions:
  1. What are the top 10 customers by revenue?
  2. How many orders are placed daily?
  3. What is the average order value?

Type your query (or "exit" to quit):

Query: Show me sales trends over time
```

## Example Queries to Try

Once the system is running, try these queries:

```
1. "What are the top 5 customers by total spending?"
2. "Show me the average order value by country"
3. "Which products have the lowest stock levels?"
4. "How many orders were placed each day last week?"
5. "What is the revenue breakdown by product category?"
6. "Which customers haven't made a purchase in 30 days?"
7. "What is the correlation between customer location and order value?"
```

## Understanding the Agent Loop

### Query Flow Example

**User Query**: "What are the top 5 customers by revenue?"

**Stage 1: Query Understanding**
- Agent classifies intent as "analytics"
- Determines visualization is needed
- Output: `{ shouldVisualize: true, intent: "analytics" }`

**Stage 2: Code Generation**
- Agent receives query + database schema
- Generates SQL:
  ```sql
  SELECT customer_id, SUM(total_amount) as revenue
  FROM orders
  GROUP BY customer_id
  ORDER BY revenue DESC
  LIMIT 5;
  ```

**Stage 3: Execution**
- Agent validates SQL (no dangerous operations)
- Executes against PostgreSQL
- Returns 5 rows with customer data

**Stage 4: Reasoning**
- Agent receives raw results
- Generates explanation: "The analysis shows that customer ID 3 is your top spender with $2,499.96 in total orders. Customers 6 and 1 follow with $1,099.99 and $1,299.97 respectively."

**Final Response**
- Combined data + explanation + insights

## Development Workflow

### File Structure

```
backend/
├── src/
│   ├── agents/           # Agent implementations
│   ├── adapters/         # Database adapters
│   ├── config/           # Configuration
│   ├── orchestration/    # Agent orchestrator
│   ├── server.ts         # HTTP server
│   └── cli.ts            # CLI interface
├── examples/             # Example files
├── dist/                 # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```

### Building for Production

```bash
# Build TypeScript
npm run build

# Run compiled version
npm start                # HTTP server
npm run start:cli        # CLI
```

## Advanced Configuration

### Custom LLM Provider

Use any OpenAI-compatible endpoint:

```bash
# Anthropic Claude
AI_BASE_URL=https://api.anthropic.com
AI_API_KEY=sk-ant-...

# Local Ollama
AI_BASE_URL=http://localhost:11434/v1
AI_MODEL=mistral

# Azure OpenAI
AI_BASE_URL=https://your-resource.openai.azure.com
AI_API_KEY=your-azure-key
```

### Performance Tuning

```bash
# Reduce response time
TEMPERATURE=0.3                    # Lower = faster, more deterministic
MAX_TOKENS=1000                    # Smaller responses = faster

# Increase accuracy
TEMPERATURE=0.9                    # Higher = more creative
MAX_TOKENS=4000                    # Larger responses = better explanations
```

### Database Optimization

```bash
# For large datasets, add indexes:
CREATE INDEX idx_orders_date ON orders(order_date);
CREATE INDEX idx_products_category ON products(category);

# Clear schema cache if schema changes:
# Restart the server (cache is 5 minutes by default)
```

## Troubleshooting

### "PostgreSQL connection failed"

```bash
# Check PostgreSQL is running
psql -U postgres -d postgres -c "SELECT 1;"

# Check credentials in .env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
```

### "AI_API_KEY environment variable is required"

```bash
# Add to .env
AI_API_KEY=sk-your-actual-key-here

# Or export it
export AI_API_KEY=sk-...
npm run dev
```

### "Dangerous SQL operation detected"

The system blocks:
- `DROP TABLE`
- `DELETE FROM`
- `TRUNCATE`
- `ALTER TABLE`
- `CREATE TABLE`

This is intentional for safety. All queries are read-only by default.

### Agent Timeouts

If queries take too long:

```bash
# Reduce token limits
MAX_TOKENS=1000

# Simplify queries
# "Show revenue by country" instead of "Show me a complex multi-table analysis with..."
```

## API Response Format

All agent responses follow this format:

```typescript
interface OrchestrationState {
  query: string;
  schemaMetadata: {
    tables: Array<{
      name: string;
      columns: Array<{ name: string; type: string; nullable: boolean }>;
      rowCount: number;
    }>;
    lastUpdated: Date;
  };
  responses: Array<{
    stage: "understanding" | "generation" | "execution" | "reasoning";
    output: unknown;
    timestamp: Date;
  }>;
  finalResult: {
    data: unknown[];
    explanation: string;
    insights: string[];
    executionTime: number;
    requiresVisualization: boolean;
  };
}
```

## Next Steps

1. **Run the system** with `npm run dev` or `npm run cli`
2. **Try example queries** from the list above
3. **Load your own data** into PostgreSQL
4. **Deploy to production** (see deployment guide below)
5. **Integrate with your app** via HTTP API

## Production Deployment

### Using Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --only=production

COPY backend/dist ./dist
COPY backend/.env.production .env

EXPOSE 3000

CMD ["node", "dist/server.js"]
```

### Using Vercel

```bash
# Push to GitHub
git push origin main

# Connect to Vercel
vercel link

# Deploy
vercel deploy
```

### Using Railway, Fly.io, or other platforms

Create an environment with:
- Node.js 18+
- PostgreSQL database
- Environment variables from `.env`
- Run: `npm run build && npm start`

## Support and Resources

- **Documentation**: See `backend/README.md`
- **API Reference**: See `GETTING_STARTED.md` (this file)
- **Examples**: `backend/examples/`
- **Issues**: Check error messages in console output

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│         User Query / API Request        │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│    QueryUnderstandingAgent              │
│  (Intent + Visualization Classification)│
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│     CodeGenerationAgent                 │
│  (Generate SQL or JavaScript)           │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│      ExecutionAgent                     │
│  (Sandboxed Safe Execution)             │
│  ├─ SQL Validator                       │
│  ├─ JavaScript Sandbox                  │
│  └─ PostgreSQL Query Runner             │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│      ReasoningAgent                     │
│  (Natural Language Explanation)         │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│    Final Response to User                │
│  (Data + Explanation + Insights)        │
└─────────────────────────────────────────┘
```

Happy analyzing! 🚀
