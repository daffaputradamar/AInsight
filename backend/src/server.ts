import 'dotenv/config';
import http from 'http';
import { createLLMClient, AVAILABLE_MODELS, getLLMConfig } from './config/llm.js';
import { createAdapterForSession, hasSessionConfig, configureSession, getSessionConfig, DbConfig } from './adapters/postgres.js';
import { AgentOrchestrator } from './orchestration/AgentOrchestrator.js';

const PORT = parseInt(process.env.PORT || '3001');

/**
 * Extract session ID from request headers
 */
function getSessionId(req: http.IncomingMessage): string {
  const sessionId = req.headers['x-session-id'] as string;
  if (!sessionId) {
    // Generate a random session ID if not provided (fallback)
    return `anonymous-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  return sessionId;
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-AI-Model, X-Session-Id');

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
    } else if (path === '/api/config/db/status' && req.method === 'GET') {
      await handleDbStatus(req, res);
    } else if (path === '/api/config/db' && req.method === 'GET') {
      await handleGetDbConfig(req, res);
    } else if (path === '/api/config/db' && req.method === 'POST') {
      await handleSetDbConfig(req, res);
    } else if (path === '/api/config/models' && req.method === 'GET') {
      await handleGetModels(req, res);
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

  let query: string;
  let chatHistory: unknown[];
  
  try {
    const parsed = JSON.parse(body);
    query = parsed.query;
    chatHistory = parsed.chatHistory;
  } catch (error) {
    console.error('[Server] JSON parse error:', error instanceof Error ? error.message : 'Invalid JSON');
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'Invalid JSON in request body' }));
    return;
  }

  if (!query) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'Query required' }));
    return;
  }

  try {
    const sessionId = getSessionId(req);
    const dbAdapter = createAdapterForSession(sessionId);
    
    // Get model override from header
    const modelOverride = req.headers['x-ai-model'] as string | undefined;
    const llm = createLLMClient(modelOverride);
    console.log('[Server] Processing /api/query for session:', sessionId, 'hasConfig:', hasSessionConfig(sessionId));
    const orchestrator = new AgentOrchestrator(llm, { modelOverride, dbAdapter: dbAdapter ?? undefined });
    const result = await orchestrator.processQuery(query, chatHistory);

    res.writeHead(200);
    res.end(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('[Server] /api/query error:', error instanceof Error ? error.message : error);
    res.writeHead(500);
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Query processing failed' }));
  }
}

async function handleSchema(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    const sessionId = getSessionId(req);
    console.log(`[Server] GET /api/schema request for sessionId: ${sessionId}`);
    
    const dbAdapter = createAdapterForSession(sessionId);
    if (!dbAdapter) {
      console.warn(`[Server] GET /api/schema returning 400 - No config for session ${sessionId}`);
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Database not configured. Please configure the database connection first.' }));
      return;
    }
    
    const schema = await dbAdapter.getSchemaMetadata();
    console.log('[Server] GET /api/schema returning schema successfully');
    res.writeHead(200);
    res.end(JSON.stringify(schema, null, 2));
  } catch (error) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Schema fetch failed' }));
  }
}

async function handleInsights(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    const sessionId = getSessionId(req);
    console.log(`[Server] GET /api/insights request for sessionId: ${sessionId}`);
    
    const dbAdapter = createAdapterForSession(sessionId);
    if (!dbAdapter) {
      console.warn(`[Server] GET /api/insights returning 400 - No config for session ${sessionId}`);
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Database not configured. Please configure the database connection first.' }));
      return;
    }
    
    const modelOverride = req.headers['x-ai-model'] as string | undefined;
    const llm = createLLMClient(modelOverride);
    console.log('[Server] Creating orchestrator for /api/insights');
    const orchestrator = new AgentOrchestrator(llm, { modelOverride, dbAdapter });
    const insights = await orchestrator.getDataInsights();
    console.log('[Server] GET /api/insights returning insights successfully');

    res.writeHead(200);
    res.end(JSON.stringify(insights, null, 2));
  } catch (error) {
    console.error('[Server] /api/insights error:', error instanceof Error ? error.message : error);
    res.writeHead(500);
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Insights generation failed' }));
  }
}

async function handleDbStatus(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    const sessionId = getSessionId(req);
    const isConfigured = hasSessionConfig(sessionId);
    res.writeHead(200);
    res.end(JSON.stringify({ configured: isConfigured, sessionId }, null, 2));
  } catch (error) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to check DB status' }));
  }
}

async function handleGetDbConfig(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    const sessionId = getSessionId(req);
    const config = getSessionConfig(sessionId);
    if (!config) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Database not configured' }));
      return;
    }
    // Return config without password
    const safeConfig = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
    };
    res.writeHead(200);
    res.end(JSON.stringify(safeConfig, null, 2));
  } catch (error) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to get DB config' }));
  }
}

async function handleSetDbConfig(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  let body = '';
  await new Promise<void>((resolve) => {
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      resolve();
    });
  });

  try {
    const config = JSON.parse(body) as DbConfig;
    console.log(`[Server] POST /api/config/db received: host=${config.host}, db=${config.database}, user=${config.user}`);
    
    // Validate required fields
    if (!config.host || !config.database || !config.user) {
      console.error('[Server] POST /api/config/db validation failed: missing required fields');
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing required fields: host, database, user' }));
      return;
    }
    
    // Set defaults
    config.port = config.port || 5432;
    config.password = config.password || '';
    
    const sessionId = getSessionId(req);
    console.log(`[Server] POST /api/config/db for sessionId: ${sessionId}`);
    
    // Test connection and store config if successful
    await configureSession(sessionId, config);
    console.log(`[Server] Session configured successfully`);
    
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, message: 'Database configuration updated', sessionId }));
  } catch (error) {
    console.error('[Server] POST /api/config/db error:', error instanceof Error ? error.message : error);
    res.writeHead(500);
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to update DB config' }));
  }
}

async function handleGetModels(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    const currentConfig = getLLMConfig();
    res.writeHead(200);
    res.end(JSON.stringify({
      models: AVAILABLE_MODELS,
      current: currentConfig.model,
    }, null, 2));
  } catch (error) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to get models' }));
  }
}

async function start(): Promise<void> {
  // Do NOT auto-connect to database - wait for user configuration
  console.log('Backend starting without database connection...');
  console.log('User must configure database through the UI.');

  const server = http.createServer(handleRequest);
  server.listen(PORT, () => {
    console.log(`ADK.js Agent System running on http://localhost:${PORT}`);
    console.log(`POST /api/query - Process a user query`);
    console.log(`GET /api/schema - Get database schema`);
    console.log(`GET /api/insights - Get data insights`);
    console.log(`GET /api/config/db/status - Check database configuration status`);
    console.log(`GET /health - Health check`);
  });
}

start().catch(console.error);
