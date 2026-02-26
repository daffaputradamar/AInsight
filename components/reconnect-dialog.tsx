"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getConnection } from "@/lib/connection-storage";
import { useReconnection } from "@/context/reconnection-context";
import type { ConnectionInfo } from "@/lib/types";
import { toast } from "sonner";

/**
 * Dialog for re-entering password when auto-reconnect fails
 * Shows saved connection details and only asks for password
 */
export function ReconnectDialog() {
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const {
    showReconnectDialog,
    setShowReconnectDialog,
    reconnectError,
    handleReconnectWithPassword,
  } = useReconnection();

  const connection = getConnection() as ConnectionInfo | null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password.trim()) {
      toast.error("Please enter your password");
      return;
    }

    try {
      setIsLoading(true);
      const success = await handleReconnectWithPassword(password);
      if (success) {
        setPassword("");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setPassword("");
    setShowReconnectDialog(false);
  };

  if (!connection) {
    return null;
  }

  return (
    <Dialog open={showReconnectDialog} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Reconnect to Database</DialogTitle>
          <DialogDescription>
            Your session was disconnected. Enter your password to reconnect.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Display saved connection info (read-only) */}
          <div className="space-y-3 bg-muted p-3 rounded-lg">
            <div>
              <Label className="text-xs text-muted-foreground">Host</Label>
              <div className="text-sm font-mono">{connection.host}</div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Port</Label>
              <div className="text-sm font-mono">{connection.port}</div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Database</Label>
              <div className="text-sm font-mono">{connection.database}</div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">User</Label>
              <div className="text-sm font-mono">{connection.user}</div>
            </div>
          </div>

          {/* Error message if reconnect failed */}
          {reconnectError && (
            <Alert variant="destructive">
              <AlertDescription>{reconnectError}</AlertDescription>
            </Alert>
          )}

          {/* Password input */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your PostgreSQL password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Connecting..." : "Reconnect"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
