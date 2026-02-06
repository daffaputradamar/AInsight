"use client";

import { useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "./chat-message";
import type { ChatMessage as ChatMessageType } from "@/lib/types";
import { MessageSquare } from "lucide-react";

interface ChatContainerProps {
  messages: ChatMessageType[];
}

export function ChatContainer({ messages }: ChatContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  if (messages.length === 0) {
    return <EmptyState />;
  }

  return (
    <ScrollArea className="flex-1 [&_[data-radix-scroll-area-viewport]>div]:block! px-4">
      <div className="flex flex-col gap-2 py-4">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
      </div>
      <div ref={scrollRef} />
    </ScrollArea>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center space-y-4 max-w-md">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <MessageSquare className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Welcome to AInsight</h2>
        <p className="text-muted-foreground text-sm">
          Ask questions about your data in natural language. I can help you
          analyze trends, generate reports, and create visualizations.
        </p>
        <div className="pt-4 space-y-2">
          <p className="text-xs text-muted-foreground">Try asking:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {[
              "Show me the top 10 customers by revenue",
              "What are the sales trends this month?",
              "Count records by category",
            ].map((example, idx) => (
              <span
                key={idx}
                className="text-xs bg-muted px-3 py-1.5 rounded-full"
              >
                &quot;{example}&quot;
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
