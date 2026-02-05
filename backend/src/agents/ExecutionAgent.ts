import { pgAdapter } from '../adapters/postgres';
import { ExecutionResult } from './types';

export class ExecutionAgent {
  async execute(code: string, language: 'sql' | 'javascript'): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      if (language === 'sql') {
        return await this.executeSQLCode(code, startTime);
      } else {
        return await this.executeJavaScriptCode(code, startTime);
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
      };
    }
  }

  private async executeSQLCode(code: string, startTime: number): Promise<ExecutionResult> {
    // Validate SQL
    const forbiddenPatterns = [
      /DROP\s+TABLE/i,
      /DELETE\s+FROM/i,
      /TRUNCATE/i,
      /ALTER\s+TABLE/i,
      /CREATE\s+TABLE/i,
    ];

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(code)) {
        throw new Error('Dangerous SQL operation detected. Read-only queries only.');
      }
    }

    const data = await pgAdapter.executeQuery(code);
    const executionTime = Date.now() - startTime;

    return {
      success: true,
      data,
      executionTime,
    };
  }

  private async executeJavaScriptCode(code: string, startTime: number): Promise<ExecutionResult> {
    // Create a sandbox context
    const sandbox = {
      require: () => {
        throw new Error('require() is not available in sandbox');
      },
      process: undefined,
      fs: undefined,
      fetch: undefined,
      XMLHttpRequest: undefined,
    };

    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('data', `"use strict"; ${code}`);
      const result = fn({});

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: Array.isArray(result) ? result : [result],
        executionTime,
      };
    } catch (error) {
      throw new Error(`JavaScript execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
