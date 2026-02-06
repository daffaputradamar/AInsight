#!/usr/bin/env node
import 'dotenv/config';

import readline from 'readline';
import { createLLMClient } from './config/llm.js';
import { PostgreSQLAdapter, DbConfig } from './adapters/postgres.js';
import { AgentOrchestrator } from './orchestration/AgentOrchestrator.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Create adapter from environment variables for CLI
function createCliAdapter(): PostgreSQLAdapter {
  const config: DbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  };
  return new PostgreSQLAdapter(config);
}

async function main(): Promise<void> {
  console.log('=== ADK.js Agent System CLI ===');
  console.log('Connecting to database...');

  try {
    const dbAdapter = createCliAdapter();
    await dbAdapter.testConnection();
    console.log('Connected to PostgreSQL\n');

    const llm = createLLMClient();
    const orchestrator = new AgentOrchestrator(llm, { dbAdapter });

    // Get initial insights
    console.log('Fetching dataset insights...\n');
    const insightsResponse = await orchestrator.getDataInsights();
    const insights = insightsResponse.output as { datasetDescription: string; suggestedQuestions: string[] };
    console.log('Dataset:', insights.datasetDescription);
    console.log('\nSuggested Questions:');
    insights.suggestedQuestions.forEach((q, i) => {
      console.log(`  ${i + 1}. ${q}`);
    });

    console.log('\nType your query (or "exit" to quit):\n');

    const askQuestion = (): void => {
      rl.question('Query: ', async (query) => {
        if (query.toLowerCase() === 'exit') {
          console.log('Goodbye!');
          rl.close();
          return;
        }

        if (!query.trim()) {
          askQuestion();
          return;
        }

        try {
          console.log('\nProcessing query...\n');
          const result = await orchestrator.processQuery(query);

          console.log('=== Agent Loop Results ===\n');

          // Stage 1
          const understanding = result.responses[0]?.output as { shouldVisualize: boolean; intent: string };
          console.log('1. Query Understanding:');
          console.log(`   Intent: ${understanding?.intent}`);
          console.log(`   Visualize: ${understanding?.shouldVisualize}\n`);

          // Stage 2
          const codeGen = result.responses[1]?.output as { code: string; language: string };
          console.log('2. Code Generation:');
          console.log(`   Language: ${codeGen?.language}`);
          console.log(`   Code:\n${codeGen?.code}\n`);

          // Stage 3
          const execution = result.responses[2]?.output as { success: boolean; data: unknown[]; executionTime: number };
          console.log('3. Execution:');
          console.log(`   Success: ${execution?.success}`);
          console.log(`   Time: ${execution?.executionTime}ms`);
          if (execution?.data) {
            console.log(`   Rows: ${execution.data.length}`);
            if (execution.data.length > 0) {
              console.log(`   Sample: ${JSON.stringify(execution.data[0])}\n`);
            }
          }

          // Stage 4
          const reasoning = result.responses[3]?.output as { explanation: string; insights: string[] };
          console.log('4. Reasoning:');
          console.log(`   ${reasoning?.explanation}\n`);

          // Final result
          if (result.finalResult) {
            console.log('=== Final Result ===');
            console.log(
              JSON.stringify(
                {
                  dataRows: (result.finalResult as { data: unknown[] }).data?.length || 0,
                  explanation: (result.finalResult as { explanation: string }).explanation,
                  executionTime: (result.finalResult as { executionTime: number }).executionTime,
                },
                null,
                2,
              ),
            );
          }

          console.log('\n---\n');
        } catch (error) {
          console.error('Error:', error instanceof Error ? error.message : error);
          console.log('');
        }

        askQuestion();
      });
    };

    askQuestion();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
