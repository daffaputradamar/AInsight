/**
 * Connection Storage Utility
 * Implements hybrid storage (localStorage primary, sessionStorage fallback)
 * Persists connection details (except password) for auto-reconnect
 */

import type { ConnectionInfo } from "./types";

const STORAGE_KEY = "ainsight_connection";

/**
 * Detects if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
  try {
    const test = "__test__";
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Gets the appropriate storage backend (localStorage > sessionStorage)
 */
function getStorage(): Storage {
  return isLocalStorageAvailable() ? localStorage : sessionStorage;
}

/**
 * Saves connection info (host, port, database, user) without password
 */
export function saveConnection(connectionInfo: ConnectionInfo): void {
  try {
    const storage = getStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify(connectionInfo));
    console.log("[ConnStorage] Connection saved successfully");
  } catch (error) {
    console.error("[ConnStorage] Failed to save connection:", error);
  }
}

/**
 * Retrieves saved connection info
 * Returns null if no connection is saved
 */
export function getConnection(): ConnectionInfo | null {
  try {
    const storage = getStorage();
    const stored = storage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const connection = JSON.parse(stored) as ConnectionInfo;
    return connection;
  } catch (error) {
    console.error("[ConnStorage] Failed to retrieve connection:", error);
    return null;
  }
}

/**
 * Checks if a connection is saved
 */
export function hasConnection(): boolean {
  return getConnection() !== null;
}

/**
 * Clears saved connection info
 */
export function clearConnection(): void {
  try {
    const storage = getStorage();
    storage.removeItem(STORAGE_KEY);
    console.log("[ConnStorage] Connection cleared");
  } catch (error) {
    console.error("[ConnStorage] Failed to clear connection:", error);
  }
}

/**
 * Gets connection info with sensible defaults (used for form pre-fill)
 */
export function getConnectionWithDefaults(): ConnectionInfo {
  const saved = getConnection();
  return (
    saved || {
      host: "localhost",
      port: 5432,
      database: "",
      user: "",
    }
  );
}
