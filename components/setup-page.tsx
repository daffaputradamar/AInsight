"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Sparkles, BarChart3, MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setDbConfig } from "@/lib/api";
import type { DbConfig } from "@/lib/types";

interface SetupPageProps {
  onConfigured: () => void;
}

export function SetupPage({ onConfigured }: SetupPageProps) {
  const [dbConfig, setDbConfigState] = useState<DbConfig>({
    host: "localhost",
    port: 5432,
    database: "",
    user: "",
    password: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!dbConfig.host || !dbConfig.database || !dbConfig.user) {
      toast.error("Please fill in host, database, and user fields");
      return;
    }

    setIsSaving(true);
    try {
      await setDbConfig(dbConfig);
      toast.success("Connected successfully! You can now start querying.");
      onConfigured();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to connect to database"
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-8 md:py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Database className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold">AInsight</h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            AI-Powered Database Analysis Assistant
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Features Section */}
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold mb-6">What can AInsight do?</h2>
            
            <FeatureCard
              icon={<MessageSquare className="h-5 w-5" />}
              title="Natural Language Queries"
              description="Ask questions about your data in plain English. No SQL knowledge required."
            />
            
            <FeatureCard
              icon={<BarChart3 className="h-5 w-5" />}
              title="Smart Visualizations"
              description="Automatically generates charts and graphs to help you understand trends and patterns."
            />
            
            <FeatureCard
              icon={<Sparkles className="h-5 w-5" />}
              title="AI-Powered Insights"
              description="Get intelligent explanations and key insights from your query results."
            />

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                <strong>Privacy First:</strong> Your database credentials are stored only in your browser session and are never saved on our servers.
              </p>
            </div>
          </div>

          {/* Connection Form Section */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Connect Your Database
              </CardTitle>
              <CardDescription>
                Enter your PostgreSQL connection details to get started.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="host">
                      Host <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="host"
                      value={dbConfig.host}
                      onChange={(e) =>
                        setDbConfigState({ ...dbConfig, host: e.target.value })
                      }
                      placeholder="localhost"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="port">Port</Label>
                    <Input
                      id="port"
                      type="number"
                      value={dbConfig.port}
                      onChange={(e) =>
                        setDbConfigState({
                          ...dbConfig,
                          port: parseInt(e.target.value) || 5432,
                        })
                      }
                      placeholder="5432"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="database">
                    Database <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="database"
                    value={dbConfig.database}
                    onChange={(e) =>
                      setDbConfigState({ ...dbConfig, database: e.target.value })
                    }
                    placeholder="my_database"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user">
                    User <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="user"
                    value={dbConfig.user}
                    onChange={(e) =>
                      setDbConfigState({ ...dbConfig, user: e.target.value })
                    }
                    placeholder="postgres"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={dbConfig.password || ""}
                    onChange={(e) =>
                      setDbConfigState({ ...dbConfig, password: e.target.value })
                    }
                    placeholder="••••••••"
                  />
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Database className="mr-2 h-4 w-4" />
                      Connect & Start
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-sm text-muted-foreground">
          <p>Need help? Try asking &quot;What can you do?&quot; after connecting.</p>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4 items-start">
      <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="font-medium mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
