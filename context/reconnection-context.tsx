"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { reconnectWithPassword } from "@/lib/api";
import { toast } from "sonner";

export interface FailedRequest {
  name: string;
  fn: () => Promise<any>;
}

interface ReconnectionContextType {
  showReconnectDialog: boolean;
  setShowReconnectDialog: (show: boolean) => void;
  reconnectError: string | null;
  setReconnectError: (error: string | null) => void;
  failedRequest: FailedRequest | null;
  setFailedRequest: (request: FailedRequest | null) => void;
  onSuccessCallback: (() => void) | null;
  setOnSuccessCallback: (callback: (() => void) | null) => void;
  handleReconnectWithPassword: (password: string) => Promise<boolean>;
}

const ReconnectionContext = createContext<ReconnectionContextType | undefined>(
  undefined
);

export function ReconnectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showReconnectDialog, setShowReconnectDialog] = useState(false);
  const [reconnectError, setReconnectError] = useState<string | null>(null);
  const [failedRequest, setFailedRequest] = useState<FailedRequest | null>(null);
  const [onSuccessCallback, setOnSuccessCallback] = useState<(() => void) | null>(null);

  const handleReconnectWithPassword = useCallback(
    async (password: string): Promise<boolean> => {
      try {
        await reconnectWithPassword(password);
        setReconnectError(null);

        // Retry the failed request if it exists
        if (failedRequest) {
          try {
            console.log(`[Reconnection] Retrying failed request: ${failedRequest.name}`);
            await failedRequest.fn();
            toast.success(`${failedRequest.name} completed successfully`);
            setFailedRequest(null);
          } catch (retryErr) {
            const retryError =
              retryErr instanceof Error
                ? retryErr.message
                : "Retry failed";
            console.error(
              `[Reconnection] Failed to retry ${failedRequest.name}:`,
              retryErr
            );
            toast.error(`Failed to retry: ${retryError}`);
            // Don't close dialog - let user try again
            return false;
          }
        }

        // Call success callback if provided (e.g., to refresh schema)
        if (onSuccessCallback) {
          console.log("[Reconnection] Calling success callback to refresh explorer");
          onSuccessCallback();
        }

        setShowReconnectDialog(false);
        setOnSuccessCallback(null);
        return true;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Reconnection failed";
        setReconnectError(errorMsg);
        console.error("[Reconnection] Reconnect failed:", err);
        return false;
      }
    },
    [failedRequest, onSuccessCallback, toast]
  );

  return (
    <ReconnectionContext.Provider
      value={{
        showReconnectDialog,
        setShowReconnectDialog,
        reconnectError,
        setReconnectError,
        failedRequest,
        setFailedRequest,
        onSuccessCallback,
        setOnSuccessCallback,
        handleReconnectWithPassword,
      }}
    >
      {children}
    </ReconnectionContext.Provider>
  );
}

export function useReconnection() {
  const context = useContext(ReconnectionContext);
  if (!context) {
    throw new Error(
      "useReconnection must be used within ReconnectionProvider"
    );
  }
  return context;
}
