import OpenAI from 'openai';
import { pgAdapter, SchemaMetadata } from '../adapters/postgres';
import { QueryUnderstandingAgent } from '../agents/QueryUnderstandingAgent';
import { CodeGenerationAgent } from '../agents/CodeGenerationAgent';
import { ExecutionAgent } from '../agents/ExecutionAgent';
import { ReasoningAgent } from '../agents/ReasoningAgent';
import { DataInsightAgent } from '../agents/DataInsightAgent';
import { AgentResponse } from '../agents/types';

export interface OrchestrationState {
  query: string;
  schemaMetadata: SchemaMetadata;
  responses: AgentResponse[];
  finalResult: unknown;
}

export class AgentOrchestrator {
  private queryAgent: QueryUnderstandingAgent;
  private codeAgent: CodeGenerationAgent;
  private executionAgent: ExecutionAgent;
  private reasoningAgent: ReasoningAgent;
  private dataInsightAgent: DataInsightAgent;

  constructor(llm: OpenAI) {
    this.queryAgent = new QueryUnderstandingAgent(llm);
    this.codeAgent = new CodeGenerationAgent(llm);
    this.executionAgent = new ExecutionAgent();
    this.reasoningAgent = new ReasoningAgent(llm);
    this.dataInsightAgent = new DataInsightAgent(llm);
  }

  async processQuery(userQuery: string): Promise<OrchestrationState> {
    const state: OrchestrationState = {
      query: userQuery,
      schemaMetadata: await pgAdapter.getSchemaMetadata(),
      responses: [],
      finalResult: null,
    };

    console.log('[Orchestrator] Starting agent loop for query:', userQuery);

    // Stage 1: Query Understanding
    console.log('[Orchestrator] Stage 1: Query Understanding');
    const understandingOutput = await this.queryAgent.classify(userQuery);
    state.responses.push({
      stage: 'understanding',
      output: understandingOutput,
      timestamp: new Date(),
    });

    // Stage 2: Code Generation
    console.log('[Orchestrator] Stage 2: Code Generation');
    const codeOutput = await this.codeAgent.generate(
      userQuery,
      state.schemaMetadata,
      understandingOutput.shouldVisualize,
    );
    state.responses.push({
      stage: 'generation',
      output: codeOutput,
      timestamp: new Date(),
    });

    // Stage 3: Execution
    console.log('[Orchestrator] Stage 3: Execution');
    const executionOutput = await this.executionAgent.execute(codeOutput.code, codeOutput.language);
    state.responses.push({
      stage: 'execution',
      output: executionOutput,
      timestamp: new Date(),
    });

    if (!executionOutput.success) {
      console.error('[Orchestrator] Execution failed:', executionOutput.error);
      return state;
    }

    // Stage 4: Reasoning
    console.log('[Orchestrator] Stage 4: Reasoning');
    const reasoningOutput = await this.reasoningAgent.reason(userQuery, executionOutput.data);
    state.responses.push({
      stage: 'reasoning',
      output: reasoningOutput,
      timestamp: new Date(),
    });

    state.finalResult = {
      data: executionOutput.data,
      explanation: reasoningOutput.explanation,
      insights: reasoningOutput.insights,
      executionTime: executionOutput.executionTime,
      requiresVisualization: codeOutput.requiresVisualization,
    };

    return state;
  }

  async getDataInsights(): Promise<AgentResponse> {
    const schemaMetadata = await pgAdapter.getSchemaMetadata();
    const insights = await this.dataInsightAgent.analyzeSchema(schemaMetadata);

    return {
      stage: 'insight',
      output: insights,
      timestamp: new Date(),
    };
  }
}
