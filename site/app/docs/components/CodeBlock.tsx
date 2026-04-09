"use client";

import { useState } from "react";

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
  showLineNumbers?: boolean;
}

const LANGUAGE_COLORS: Record<string, string> = {
  bash: "text-emerald-400",
  curl: "text-emerald-400",
  typescript: "text-blue-400",
  javascript: "text-yellow-400",
  python: "text-sky-400",
  json: "text-orange-400",
  yaml: "text-pink-400",
};

const LANGUAGE_LABELS: Record<string, string> = {
  bash: "Bash",
  curl: "cURL",
  typescript: "TypeScript",
  javascript: "JavaScript",
  python: "Python",
  json: "JSON",
  yaml: "YAML",
};

export default function CodeBlock({
  code,
  language = "bash",
  title,
  showLineNumbers = false,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement("textarea");
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const colorClass = LANGUAGE_COLORS[language] || "text-zinc-300";
  const label = LANGUAGE_LABELS[language] || language.toUpperCase();

  const lines = code.split("\n");

  return (
    <div className="relative group rounded-xl overflow-hidden border border-border bg-bg-secondary">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-bg-card border-b border-border">
        <div className="flex items-center gap-2">
          {title && <span className="text-xs text-zinc-400 font-medium">{title}</span>}
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-500/10 text-zinc-500 uppercase tracking-wider">
            {label}
          </span>
        </div>
        <button
          onClick={copyCode}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-zinc-500 hover:text-white hover:bg-bg-hover transition-colors"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code */}
      <div className="overflow-x-auto p-4">
        <pre className="text-xs leading-relaxed">
          <code className={colorClass}>
            {showLineNumbers ? (
              <table className="border-collapse">
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i}>
                      <td className="pr-4 text-zinc-600 select-none text-right tabular-nums">
                        {i + 1}
                      </td>
                      <td className="whitespace-pre">{line}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              code
            )}
          </code>
        </pre>
      </div>
    </div>
  );
}

// Multi-language code tabs
interface CodeTabsProps {
  examples: {
    language: string;
    code: string;
    title?: string;
  }[];
}

export function CodeTabs({ examples }: CodeTabsProps) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="rounded-xl overflow-hidden border border-border bg-bg-secondary">
      {/* Tab headers */}
      <div className="flex border-b border-border bg-bg-card">
        {examples.map((ex, i) => {
          const label = LANGUAGE_LABELS[ex.language] || ex.language.toUpperCase();
          return (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                i === activeTab
                  ? "text-accent border-accent bg-bg-secondary"
                  : "text-zinc-500 border-transparent hover:text-white"
              }`}
            >
              {ex.title || label}
            </button>
          );
        })}
      </div>

      {/* Active code block (inline instead of nested component to avoid header duplication) */}
      <CodeBlockInner
        code={examples[activeTab].code}
        language={examples[activeTab].language}
      />
    </div>
  );
}

// Inner code block without header (for tabs)
function CodeBlockInner({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const colorClass = LANGUAGE_COLORS[language] || "text-zinc-300";

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement("textarea");
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={copyCode}
        className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-zinc-500 hover:text-white hover:bg-bg-hover transition-colors"
      >
        {copied ? (
          <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>
      <div className="overflow-x-auto p-4">
        <pre className="text-xs leading-relaxed">
          <code className={colorClass}>{code}</code>
        </pre>
      </div>
    </div>
  );
}
