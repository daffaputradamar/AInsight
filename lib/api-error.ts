/**
 * API Error Handler
 * Detects database configuration errors and triggers reconnection flow
 */

export class DatabaseNotConfiguredError extends Error {
  constructor(message: string = "Database not configured") {
    super(message);
    this.name = "DatabaseNotConfiguredError";
  }
}

/**
 * Checks if a response indicates database is not configured
 */
export function isDatabaseNotConfigured(
  error: unknown
): error is DatabaseNotConfiguredError {
  if (error instanceof DatabaseNotConfiguredError) return true;

  if (error instanceof Error) {
    return (
      error.message.includes("Database not configured") ||
      error.message.includes("not configured")
    );
  }

  return false;
}

/**
 * Parses error response and throws appropriate error types
 */
export async function parseErrorResponse(response: Response): Promise<never> {
  const error = await response.json().catch(() => ({ error: "Unknown error" }));
  const errorMessage = error.error || `HTTP ${response.status}`;

  // Check if this is a database configuration error
  if (response.status === 400 && errorMessage.includes("not configured")) {
    throw new DatabaseNotConfiguredError(errorMessage);
  }

  throw new Error(errorMessage);
}
