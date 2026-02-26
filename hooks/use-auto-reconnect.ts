"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { getConnection } from "@/lib/connection-storage";
import { setDbConfig } from "@/lib/api";
import type { ReconnectStatus } from "@/lib/types";

interface UseAutoReconnectOptions {
  maxAttempts?: number;
  initialDelay?: number;
}

interface UseAutoReconnectReturn {
  status: ReconnectStatus;
  attemptCount: number;
  error: string | null;
  isConnecting: boolean;
  attemptManualReconnect: (password: string) => Promise<boolean>;
  resetError: () => void;
}

/**
 * Hook that handles automatic reconnection with exponential backoff
 * Attempts to reconnect using saved connection info when session is lost
 */
export function useAutoReconnect(
  options: UseAutoReconnectOptions = {}
): UseAutoReconnectReturn {
  const { maxAttempts = 5, initialDelay = 1000 } = options;

  const [status, setStatus] = useState<ReconnectStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);

  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasAttemptedRef = useRef(false);

  /**
   * Calculates exponential backoff delay: 1s, 2s, 4s, 8s, 16s...
   */
  const getBackoffDelay = (attempt: number): number => {
    return initialDelay * Math.pow(2, Math.min(attempt, 4)); // Cap at 16s
  };

  /**
   * Attempts to reconnect with a password
   */
  const attemptReconnect = useCallback(
    async (password: string): Promise<boolean> => {
      const connection = getConnection();
      if (!connection) {
        setError("No saved connection info found");
        setStatus("failed");
        return false;
      }

      try {
        setStatus("connecting");
        setError(null);

        const config = {
          ...connection,
          password,
        };

        await setDbConfig(config);

        setStatus("success");
        setAttemptCount(0);
        return true;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Reconnection failed";
        setError(errorMsg);
        setStatus("failed");
        return false;
      }
    },
    []
  );

  /**
   * Manually triggered reconnect attempt by user
   */
  const attemptManualReconnect = useCallback(
    async (password: string): Promise<boolean> => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      setAttemptCount(0);
      return attemptReconnect(password);
    },
    [attemptReconnect]
  );

  /**
   * Resets error state when user dismisses notification
   */
  const resetError = useCallback(() => {
    setError(null);
    setStatus("idle");
  }, []);

  /**
   * Auto-reconnect logic with exponential backoff
   * Runs on component mount to handle session recovery
   */
  useEffect(() => {
    // Only attempt once per app lifecycle to avoid loops
    if (hasAttemptedRef.current) return;

    const attemptAutoReconnect = async () => {
      const connection = getConnection();
      if (!connection) {
        // No saved connection, nothing to do
        return;
      }

      // Check if DB is already configured
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/config/db/status`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (response.ok) {
          // Already connected, no reconnect needed
          setStatus("success");
          return;
        }
      } catch (e) {
        // Connection check failed, will attempt to reconnect
      }

      hasAttemptedRef.current = true;
      let attempt = 0;

      const tryReconnect = async () => {
        attempt++;
        setAttemptCount(attempt);

        if (attempt > maxAttempts) {
          setStatus("failed");
          setError(
            `Automatic reconnection failed after ${maxAttempts} attempts. Please provide your password to reconnect.`
          );
          console.log("[AutoReconnect] Max attempts reached");
          return;
        }

        try {
          setStatus("connecting");
          console.log(
            `[AutoReconnect] Attempt ${attempt}/${maxAttempts} to reconnect to saved database`
          );

          // Try to reconnect with empty password (saved connections might not have password)
          // This will fail with proper error if password is required
          const config = {
            ...connection,
            password: "",
          };

          await setDbConfig(config);

          setStatus("success");
          setError(null);
          console.log("[AutoReconnect] Successfully reconnected");
          return;
        } catch (err) {
          const errorMsg =
            err instanceof Error ? err.message : "Connection failed";
          console.log(
            `[AutoReconnect] Attempt ${attempt} failed: ${errorMsg}`
          );

          if (attempt < maxAttempts) {
            const delay = getBackoffDelay(attempt);
            console.log(
              `[AutoReconnect] Next attempt in ${delay}ms`
            );
            reconnectTimeoutRef.current = setTimeout(
              tryReconnect,
              delay
            );
          } else {
            setStatus("failed");
            setError(
              "Automatic reconnection failed. Please provide your password to reconnect."
            );
          }
        }
      };

      tryReconnect();
    };

    // Small delay to let app initialize before attempting reconnect
    const initTimeout = setTimeout(attemptAutoReconnect, 500);

    return () => {
      clearTimeout(initTimeout);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [maxAttempts, getBackoffDelay]);

  return {
    status,
    attemptCount,
    error,
    isConnecting: status === "connecting",
    attemptManualReconnect,
    resetError,
  };
}
