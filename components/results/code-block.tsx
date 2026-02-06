"use client";

import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface CodeBlockProps {
  code: string;
  language: "sql" | "javascript";
  title?: string;
}

export function CodeBlock({ code, language, title }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Syntax highlighting colors
  const getHighlightedCode = () => {
    if (language === "sql") {
      return highlightSQL(code);
    } else {
      return highlightJavaScript(code);
    }
  };

  return (
    <div className="space-y-2">
      {title && (
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </p>
      )}
      <div className="relative rounded-lg border bg-muted/30 overflow-hidden">
        <div className="absolute right-2 top-2 z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 w-7 p-0"
            title={copied ? "Copied!" : "Copy code"}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        <pre className="overflow-x-auto p-4 pr-12 text-xs font-mono">
          <code className="text-sm" dangerouslySetInnerHTML={{ __html: getHighlightedCode() }} />
        </pre>
      </div>
    </div>
  );
}

function highlightSQL(code: string): string {
  const keywords =
    /\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|BY|ORDER|HAVING|LIMIT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TABLE|DATABASE|INDEX|VIEW|TRIGGER|FUNCTION|PROCEDURE|AS|AND|OR|NOT|IN|EXISTS|BETWEEN|LIKE|IS|NULL|DISTINCT|UNION|INTERSECT|EXCEPT|CASE|WHEN|THEN|ELSE|END|WITH|RECURSIVE|CTE|ALL|ANY|SOME)\b/gi;
  const strings = /('(?:''|[^'])*')/g;
  const numbers = /\b(\d+)\b/g;
  const functions =
    /\b(COUNT|SUM|AVG|MAX|MIN|UPPER|LOWER|SUBSTRING|CONCAT|COALESCE|CAST|ROW_NUMBER|RANK|DENSE_RANK)\b/gi;
  const comments = /(--[^\n]*)/g;

  let html = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  html = html.replace(comments, '<span class="text-green-600">$1</span>');
  html = html.replace(strings, '<span class="text-amber-600">$1</span>');
  html = html.replace(numbers, '<span class="text-blue-600">$1</span>');
  html = html.replace(functions, '<span class="text-purple-600 font-semibold">$1</span>');
  html = html.replace(keywords, '<span class="text-blue-700 dark:text-blue-400 font-semibold">$1</span>');

  return html;
}

function highlightJavaScript(code: string): string {
  const keywords =
    /\b(const|let|var|function|async|await|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|new|class|extends|import|export|from|default|as|static|this|super|typeof|instanceof|in|of|void|delete|yield|from|yield)\b/g;
  const strings = /('(?:\\'|[^'])*'|"(?:\\"|[^"])*"|`(?:\\`|[^`])*`)/g;
  const numbers = /\b(\d+)\b/g;
  const functions = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g;
  const comments = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g;
  const booleans = /\b(true|false|null|undefined)\b/g;

  let html = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  html = html.replace(comments, '<span class="text-green-600">$1</span>');
  html = html.replace(strings, '<span class="text-amber-600">$1</span>');
  html = html.replace(booleans, '<span class="text-red-600 font-semibold">$1</span>');
  html = html.replace(numbers, '<span class="text-blue-600">$1</span>');
  html = html.replace(functions, '<span class="text-orange-600">$1</span>');
  html = html.replace(keywords, '<span class="text-blue-700 dark:text-blue-400 font-semibold">$1</span>');

  return html;
}
