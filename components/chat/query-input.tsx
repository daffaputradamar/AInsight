"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";

interface QueryInputProps {
  onSubmit: (query: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function QueryInput({
  onSubmit,
  disabled = false,
  placeholder = "Ask a question about your data...",
}: QueryInputProps) {
  const [query, setQuery] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [query]);

  const handleSubmit = () => {
    const trimmedQuery = query.trim();
    if (trimmedQuery && !disabled) {
      onSubmit(trimmedQuery);
      setQuery("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex gap-2 items-end p-4 border-t bg-background">
      <Textarea
        ref={textareaRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="min-h-[44px] max-h-[200px] resize-none"
        rows={1}
      />
      <Button
        onClick={handleSubmit}
        disabled={disabled || !query.trim()}
        size="icon"
        className="h-11 w-11 shrink-0"
      >
        {disabled ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Send className="h-5 w-5" />
        )}
      </Button>
    </div>
  );
}

// Allow setting query externally (for suggested questions)
export function useQueryInput() {
  const [externalQuery, setExternalQuery] = useState<string | null>(null);
  
  return {
    externalQuery,
    setExternalQuery,
    clearExternalQuery: () => setExternalQuery(null),
  };
}
