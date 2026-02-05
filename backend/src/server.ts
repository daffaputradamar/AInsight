import http from 'http';
import { createLLMClient } from './config/llm';
import { pgAdapter } from './adapters/postgres';
import { AgentOrchestrator } from './orchestration/AgentOrchestrator';

const PORT = parseInt(process.env.PORT || '3000');

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const urlParts = (req.url || '').split('?');
  const path = urlParts[0];

  try {
    if (path === '/api/query' && req.method === 'POST') {
      await handleQuery(req, res);
    } else if (path === '/api/schema' && req.method === 'GET') {
      await handleSchema(req, res);
    } else if (path === '/api/insights' && req.method === 'GET') {
      await handleInsights(req, res);
    } else if (path === '/health' && req.method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'ok' }));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  } catch (error) {
    console.error('Request error:', error);
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

async function handleQuery(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  let body = '';
  await new Promise<void>((resolve) => {
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      resolve();
    });
  });

  const { query } = JSON.parse(body);
  if (!query) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'Query required' }));
    return;
  }

  try {
    const llm = createLLMClient();
    const orchestrator = new AgentOrchestrator(llm);
    const result = await orchestrator.processQuery(query);

    res.writeHead(200);
    res.end(JSON.stringify(result, null, 2));
  } catch (error) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Query processing failed' }));
  }
}

async function handleSchema(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    const schema = await pgAdapter.getSchemaMetadata();
    res.writeHead(200);
    res.end(JSON.stringify(schema, null, 2));
  } catch (error) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Schema fetch failed' }));
  }
}

async function handleInsights(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    const llm = createLLMClient();
    const orchestrator = new AgentOrchestrator(llm);
    const insights = await orchestrator.getDataInsights();

    res.writeHead(200);
    res.end(JSON.stringify(insights, null, 2));
  } catch (error) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Insights generation failed' }));
  }
}

async function start(): Promise<void> {
  await pgAdapter.connect();

  const server = http.createServer(handleRequest);
  server.listen(PORT, () => {
    console.log(`ADK.js Agent System running on http://localhost:${PORT}`);
    console.log(`POST /api/query - Process a user query`);
    console.log(`GET /api/schema - Get database schema`);
    console.log(`GET /api/insights - Get data insights`);
    console.log(`GET /health - Health check`);
  });
}

start().catch(console.error);
