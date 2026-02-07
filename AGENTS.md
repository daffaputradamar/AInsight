# AGENTS.md - Coding Guidelines for AInsight

This file contains essential guidelines for agentic coding systems operating in the AInsight repository.

## Project Overview

**AInsight** is an AI-powered data analysis assistant with:
- **Frontend**: Next.js 16 (React 19) with TypeScript + Tailwind CSS + Radix UI
- **Backend**: Node.js (ES modules) with multi-agent orchestration system
- **Database**: PostgreSQL
- **Package Manager**: pnpm
- **Runtime**: tsx for TypeScript execution

## Build/Lint/Test Commands

### Frontend (Next.js)
```bash
pnpm dev              # Start development server (http://localhost:3000)
pnpm build            # Production build
pnpm lint             # Run ESLint on codebase
```

### Backend (Node.js/TypeScript)
```bash
cd backend
pnpm dev              # Start dev server with hot reload (tsx watch)
pnpm build            # Compile TypeScript to dist/
pnpm lint             # Run ESLint on src/
pnpm start            # Run compiled server
pnpm cli              # Run CLI tool
```

### Full Stack
```bash
pnpm dev:all          # Run frontend + backend concurrently
```

### Testing
⚠️ **Note**: No test framework currently configured. When adding tests, use:
- Frontend: Jest + React Testing Library
- Backend: Jest or Vitest

## Code Style Guidelines

### Imports & Exports
- Use ES6 module syntax: `import`/`export`
- Group imports: external → internal → types
- Use absolute paths with `@/` alias for frontend (e.g., `@/components/ui/button`)
- Use relative imports in backend
- Order: React/next imports → external libs → internal modules → types
- Always use named imports except for default exports
- Import types with `import type` keyword

**Example**:
```typescript
import { useState, useCallback } from 'react';
import { Button } from '@radix-ui/react-button';
import { processQuery } from '@/lib/api';
import type { ChatMessage } from '@/lib/types';
```

### Naming Conventions
- **Components**: PascalCase (e.g., `ChatContainer`, `QueryInput`)
- **Hooks**: camelCase with `use` prefix (e.g., `useMobile`, `useToast`)
- **Functions**: camelCase (e.g., `handleSubmit`, `classifyIntent`)
- **Variables/Constants**: camelCase (e.g., `isLoading`, `dbConfig`)
- **Types/Interfaces**: PascalCase (e.g., `ChatMessage`, `OrchestrationState`)
- **File names**: lowercase with hyphens for components (e.g., `chat-container.tsx`)

### Formatting & Types
- **TypeScript**: Strict mode enabled (`strict: true`)
- **Target**: ES6 with module: "esnext"
- **JSX**: React 17+ automatic JSX transform
- **Line length**: Keep to ~100 chars, no hard limit enforced
- **Semicolons**: Use semicolons consistently
- **Quotes**: Double quotes (`"`) for strings
- **Indentation**: 2 spaces (enforced by Tailwind/formatting conventions)
- **Type annotations**: Always annotate function parameters and return types
- **Zod schemas**: Used for runtime validation (frontend & backend)

**Example**:
```typescript
interface HeaderProps {
  onSettingsChange?: () => void;
  onDisconnect?: () => void;
}

export function Header({ onSettingsChange, onDisconnect }: HeaderProps) {
  // implementation
}
```

### Error Handling
- Use try/catch for async operations
- Log errors with context: `console.error('[ModuleName] Message:', error)`
- Provide user-friendly error messages via `toast.error()`
- Never silently fail; always notify or log
- Handle loading/error states explicitly in React components

**Example**:
```typescript
try {
  const result = await processQuery(query);
  setMessages(prev => [...prev, result]);
} catch (error) {
  console.error('[ChatContainer] Query failed:', error);
  toast.error(error instanceof Error ? error.message : 'Query failed');
}
```

### Frontend-Specific (React/Next.js)
- Use functional components with hooks
- Mark client components with `"use client"` directive
- Use `useCallback` to memoize event handlers (especially in lists)
- Implement proper loading/error states
- Avoid `any` type; use `unknown` if necessary
- Pass down minimal props; use context for global state
- Use Tailwind utility classes for styling (no inline styles)
- Radix UI components for accessible primitives

### Backend-Specific (Node.js)
- Use ES modules exclusively (type: "module" in package.json)
- Mark class methods with `private`/`protected` keywords
- Use Zod schemas for input validation
- Agents extend base `Agent` class from ADK framework
- Register tools via `registerTool()` method
- Log with context: `console.log('[AgentName] Message')`
- Use async/await, avoid callbacks

**Example**:
```typescript
export class QueryUnderstandingAgent extends Agent {
  constructor(context: AgentContext) {
    super({ ...context, config: { name: 'query-understanding' } });
  }

  protected registerTools(): void {
    this.registerTool({
      name: 'classify',
      description: 'Classify user query intent',
      inputSchema: ClassifyInputSchema,
      outputSchema: ClassifyOutputSchema,
      handler: this.classify.bind(this),
    });
  }

  private async classify(input: ClassifyInput): Promise<Output> {
    // implementation
  }
}
```

### Comments & Documentation
- Add JSDoc comments for public functions/exports
- Use inline comments sparingly; prefer clear code
- Document complex logic or non-obvious patterns
- Include parameter descriptions in JSDoc

## Architecture Notes

- **Frontend routing**: App Router (Next.js 16) with dynamic routes
- **State management**: React hooks + localStorage/sessionStorage for persistence
- **Agent system**: Sequential multi-agent pipeline (5 agents)
- **Database layer**: Node PostgreSQL driver (`pg` package)
- **Validation**: Zod schemas for type-safe data handling
- **UI Framework**: Shadcn/ui components built on Radix UI primitives

## Key Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| next | Web framework | 16.0.7 |
| react | UI library | 19 |
| typescript | Language | 5.7.3 |
| tailwindcss | CSS utility framework | 4.1.18 |
| @radix-ui/* | Accessible UI primitives | various |
| zod | Schema validation | 3.24.1 (frontend), 4.3.6 (backend) |
| openai | LLM API client | 4.71.0 |
| pg | PostgreSQL driver | 8.11.3 |
| tsx | TypeScript executor | 4.16.0 (dev) |

## Important Configuration Files

- `tsconfig.json`: Compiler options (strict mode, paths alias)
- `next.config.mjs`: Next.js config
- `package.json`: Scripts and dependencies
- `backend/package.json`: Backend-specific config

---

**Last Updated**: February 2026 | Target Audience: Agentic Coding Systems
