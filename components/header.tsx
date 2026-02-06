"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Database, Settings, Check, RotateCcw, LogOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  getDbConfig,
  setDbConfig,
  getAvailableModels,
  setSelectedModel,
  getSelectedModel,
  getStoredDbConfig,
} from "@/lib/api";
import type { DbConfig, ModelInfo } from "@/lib/types";

interface HeaderProps {
  onSettingsChange?: () => void;
  onResetConversation?: () => void;
  onDisconnect?: () => void;
}

export function Header({ onSettingsChange, onResetConversation, onDisconnect }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModelState] = useState<string>("");
  const [dbConfig, setDbConfigState] = useState<DbConfig>({
    host: "localhost",
    port: 5432,
    database: "",
    user: "",
    password: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      // Load available models
      const modelsResponse = await getAvailableModels();
      setModels(modelsResponse.models);
      
      // Get selected model from sessionStorage or use first available
      const storedModel = getSelectedModel();
      if (storedModel) {
        setSelectedModelState(storedModel);
      } else if (modelsResponse.models.length > 0) {
        setSelectedModelState(modelsResponse.models[0].id);
        setSelectedModel(modelsResponse.models[0].id);
      }

      // Load DB config from sessionStorage first, then from server
      const storedDbConfig = getStoredDbConfig();
      if (storedDbConfig) {
        setDbConfigState(storedDbConfig);
      } else {
        try {
          const serverConfig = await getDbConfig();
          setDbConfigState({
            ...serverConfig,
            password: "",
          });
        } catch {
          // Server might not be running yet, use defaults
        }
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  }

  function handleModelChange(modelId: string) {
    setSelectedModelState(modelId);
    setSelectedModel(modelId);
    toast.success(`Model changed to ${models.find(m => m.id === modelId)?.name || modelId}`);
  }

  async function handleSaveDbConfig() {
    if (!dbConfig.host || !dbConfig.database || !dbConfig.user) {
      toast.error("Please fill in host, database, and user fields");
      return;
    }

    setIsSaving(true);
    try {
      await setDbConfig(dbConfig);
      toast.success("Database configuration updated");
      setSettingsOpen(false);
      onSettingsChange?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update database config");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/60">
      <div className="flex h-14 items-center px-4">
        <div className="flex items-center gap-2 font-semibold">
          <Database className="h-5 w-5 text-primary" />
          <span className="text-lg">AInsight</span>
        </div>
        <span className="ml-2 text-xs text-muted-foreground">
          AI-Powered Data Analysis
        </span>

        <div className="ml-auto flex items-center gap-2">
          {/* Reset Conversation Button */}
          {onResetConversation && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetConversation}
              aria-label="Reset conversation"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          )}

          {/* Disconnect Button */}
          {onDisconnect && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDisconnect}
              aria-label="Disconnect database"
              className="text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Disconnect
            </Button>
          )}

          {/* Model Selector */}
          {mounted && models.length > 0 && (
            <Select value={selectedModel} onValueChange={handleModelChange}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Settings Dialog */}
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Settings">
                <Settings className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Database Settings</DialogTitle>
                <DialogDescription>
                  Configure your PostgreSQL database connection. Settings are stored per browser tab.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="host" className="text-right">
                    Host
                  </Label>
                  <Input
                    id="host"
                    value={dbConfig.host}
                    onChange={(e) => setDbConfigState({ ...dbConfig, host: e.target.value })}
                    className="col-span-3"
                    placeholder="localhost"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="port" className="text-right">
                    Port
                  </Label>
                  <Input
                    id="port"
                    type="number"
                    value={dbConfig.port}
                    onChange={(e) => setDbConfigState({ ...dbConfig, port: parseInt(e.target.value) || 5432 })}
                    className="col-span-3"
                    placeholder="5432"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="database" className="text-right">
                    Database
                  </Label>
                  <Input
                    id="database"
                    value={dbConfig.database}
                    onChange={(e) => setDbConfigState({ ...dbConfig, database: e.target.value })}
                    className="col-span-3"
                    placeholder="my_database"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="user" className="text-right">
                    User
                  </Label>
                  <Input
                    id="user"
                    value={dbConfig.user}
                    onChange={(e) => setDbConfigState({ ...dbConfig, user: e.target.value })}
                    className="col-span-3"
                    placeholder="postgres"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="password" className="text-right">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={dbConfig.password || ""}
                    onChange={(e) => setDbConfigState({ ...dbConfig, password: e.target.value })}
                    className="col-span-3"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleSaveDbConfig} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save & Connect"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Theme Toggle */}
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
