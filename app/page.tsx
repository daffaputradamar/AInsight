"use client";

import { useState, useCallback, useEffect } from "react";
import { Header } from "@/components/header";
import { SchemaViewer } from "@/components/schema/schema-viewer";
import { SuggestedQuestions } from "@/components/insights/suggested-questions";
import { ChatContainer } from "@/components/chat/chat-container";
import { QueryInput } from "@/components/chat/query-input";
import { SetupPage } from "@/components/setup-page";
import { processQueryStream, isDbConfiguredLocally, clearSessionData } from "@/lib/api";
import type { ChatMessage, OrchestrationState, ChatHistoryMessage } from "@/lib/types";
import { toast } from "sonner";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { PanelLeftClose, PanelLeft } from "lucide-react";

export default function HomePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [schemaRefreshTrigger, setSchemaRefreshTrigger] = useState(0);
  // Check sessionStorage immediately (client-side) to avoid flash
  const [dbConfigured, setDbConfigured] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);

  // Check DB configuration on mount (client-side only)
  useEffect(() => {
    setMounted(true);
    // Check sessionStorage first - this is instant and prevents flash
    const isConfigured = isDbConfiguredLocally();
    setDbConfigured(isConfigured);
  }, []);

  const handleSubmit = useCallback(async (query: string) => {
    // Build chat history from recent messages (last 6 messages = 3 exchanges)
    const chatHistory: ChatHistoryMessage[] = messages
      .slice(-6)
      .map(msg => ({
        role: msg.role,
        content: msg.role === 'user' 
          ? msg.content 
          : (msg.result?.finalResult?.explanation || msg.content || '')
      }));

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date(),
    };

    // Add placeholder assistant message
    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsLoading(true);

    try {
      const result = await processQueryStream(query, (chunk) => {
        // Handle streaming updates
        if (chunk.type === "stage" && chunk.message) {
          toast.info(chunk.message, { duration: 2000 });
        }
      }, chatHistory);

      // Update assistant message with result
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                isLoading: false,
                result: result as OrchestrationState,
                content: result.finalResult?.explanation || "Query processed successfully",
              }
            : msg
        )
      );
    } catch (error) {
      // Update assistant message with error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                isLoading: false,
                error: error instanceof Error ? error.message : "An error occurred",
              }
            : msg
        )
      );
      toast.error("Failed to process query");
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  const handleQuestionSelect = useCallback((question: string) => {
    if (!isLoading) {
      handleSubmit(question);
    }
  }, [isLoading, handleSubmit]);

  const handleSettingsChange = useCallback(() => {
    // Refresh schema when DB settings change
    setSchemaRefreshTrigger((prev) => prev + 1);
    // Recheck local DB configuration status
    setDbConfigured(isDbConfiguredLocally());
  }, []);

  const handleDbConfigured = useCallback(() => {
    setDbConfigured(true);
    setSchemaRefreshTrigger((prev) => prev + 1);
  }, []);

  const handleResetConversation = useCallback(() => {
    setMessages([]);
    toast.success("Conversation reset");
  }, []);

  const handleDisconnect = useCallback(() => {
    clearSessionData();
    setDbConfigured(false);
    setMessages([]);
    toast.success("Disconnected from database");
  }, []);

  // Don't render anything until mounted (prevents hydration mismatch)
  if (!mounted) {
    return null;
  }

  // Show setup page if DB is not configured
  if (!dbConfigured) {
    return <SetupPage onConfigured={handleDbConfigured} />;
  }

  return (
    <div className="flex flex-col h-screen">
      <Header 
        onSettingsChange={handleSettingsChange}
        onResetConversation={handleResetConversation}
        onDisconnect={handleDisconnect}
      />
      
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* Sidebar */}
          {!sidebarCollapsed && (
            <>
              <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
                <div className="flex flex-col h-full border-r">
                  <div className="flex items-center justify-between p-2 border-b">
                    <span className="text-sm font-medium px-2">Explorer</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setSidebarCollapsed(true)}
                    >
                      <PanelLeftClose className="h-4 w-4" />
                    </Button>
                  </div>
                  <ScrollArea className="flex-1">
                    <SchemaViewer refreshTrigger={schemaRefreshTrigger} />
                    <div className="border-t">
                      <SuggestedQuestions onQuestionSelect={handleQuestionSelect} />
                    </div>
                  </ScrollArea>
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}

          {/* Main Chat Area */}
          <ResizablePanel defaultSize={sidebarCollapsed ? 100 : 80}>
            <div className="flex flex-col h-full">
              {sidebarCollapsed && (
                <div className="absolute top-16 left-2 z-10">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setSidebarCollapsed(false)}
                  >
                    <PanelLeft className="h-4 w-4" />
                  </Button>
                </div>
              )}
              
              <ChatContainer messages={messages} />
              <QueryInput 
                onSubmit={handleSubmit} 
                disabled={isLoading} 
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
