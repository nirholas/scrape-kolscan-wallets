"use client";

import { useState } from "react";

export default function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={async (e) => {
        e.preventDefault();
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // fallback for older browsers
          const el = document.createElement("textarea");
          el.value = text;
          document.body.appendChild(el);
          el.select();
          document.execCommand("copy");
          document.body.removeChild(el);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }
      }}
      title={copied ? "Copied!" : "Copy address"}
      className={className}
    >
      {copied ? "✓" : "⎘"}
    </button>
  );
}
