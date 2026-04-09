"use client";

import { useState } from "react";
import { CodeTabs } from "./CodeBlock";

export interface EndpointParam {
  name: string;
  type: string;
  required?: boolean;
  description: string;
  default?: string;
}

export interface EndpointResponse {
  code: number;
  description: string;
  example?: string;
}

export interface EndpointDocProps {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  description: string;
  params?: EndpointParam[];
  headers?: EndpointParam[];
  bodyParams?: EndpointParam[];
  responses?: EndpointResponse[];
  examples?: {
    language: string;
    code: string;
    title?: string;
  }[];
  baseUrl?: string;
}

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
  POST: "bg-blue-500/10 text-blue-400 ring-blue-500/20",
  PUT: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
  DELETE: "bg-red-500/10 text-red-400 ring-red-500/20",
  PATCH: "bg-purple-500/10 text-purple-400 ring-purple-500/20",
};

export default function EndpointDoc({
  method,
  path,
  description,
  params,
  headers,
  bodyParams,
  responses,
  examples,
  baseUrl = "https://kol.quest",
}: EndpointDocProps) {
  const [expanded, setExpanded] = useState(false);
  const fullUrl = `${baseUrl}${path}`;

  // Generate default examples if none provided
  const defaultExamples = examples || [
    {
      language: "curl",
      code: `curl "${fullUrl}"${
        headers?.some((h) => h.name === "X-API-Key")
          ? ' \\\n  -H "X-API-Key: your-api-key"'
          : ""
      }`,
    },
    {
      language: "javascript",
      code: `const response = await fetch("${fullUrl}"${
        headers?.some((h) => h.name === "X-API-Key")
          ? `, {
  headers: { "X-API-Key": "your-api-key" }
}`
          : ""
      });

const data = await response.json();
console.log(data);`,
    },
    {
      language: "python",
      code: `import requests

response = requests.get("${fullUrl}"${
        headers?.some((h) => h.name === "X-API-Key")
          ? `,
    headers={"X-API-Key": "your-api-key"}`
          : ""
      })

data = response.json()
print(data)`,
    },
  ];

  return (
    <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-bg-hover/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold ring-1 ring-inset uppercase tracking-wider ${METHOD_COLORS[method]}`}
          >
            {method}
          </span>
          <code className="text-sm text-white font-mono truncate">{path}</code>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <span className="text-xs text-zinc-500 hidden sm:block max-w-[200px] truncate">
            {description}
          </span>
          <svg
            className={`w-4 h-4 text-zinc-500 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border p-4 sm:p-5 space-y-6">
          {/* Description */}
          <p className="text-zinc-400 text-sm">{description}</p>

          {/* Path/Query parameters */}
          {params && params.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                Parameters
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left border-b border-border">
                      <th className="pb-2 pr-4 text-zinc-500 font-medium">Name</th>
                      <th className="pb-2 pr-4 text-zinc-500 font-medium">Type</th>
                      <th className="pb-2 pr-4 text-zinc-500 font-medium">Required</th>
                      <th className="pb-2 pr-4 text-zinc-500 font-medium">Description</th>
                      <th className="pb-2 text-zinc-500 font-medium">Default</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {params.map((p) => (
                      <tr key={p.name}>
                        <td className="py-2 pr-4 text-buy font-mono">{p.name}</td>
                        <td className="py-2 pr-4 text-zinc-500 font-mono">{p.type}</td>
                        <td className="py-2 pr-4">
                          {p.required ? (
                            <span className="text-amber-400">Required</span>
                          ) : (
                            <span className="text-zinc-600">Optional</span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-zinc-400">{p.description}</td>
                        <td className="py-2 text-zinc-500 font-mono">{p.default || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Headers */}
          {headers && headers.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                Headers
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left border-b border-border">
                      <th className="pb-2 pr-4 text-zinc-500 font-medium">Name</th>
                      <th className="pb-2 pr-4 text-zinc-500 font-medium">Required</th>
                      <th className="pb-2 text-zinc-500 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {headers.map((h) => (
                      <tr key={h.name}>
                        <td className="py-2 pr-4 text-violet-400 font-mono">{h.name}</td>
                        <td className="py-2 pr-4">
                          {h.required ? (
                            <span className="text-amber-400">Required</span>
                          ) : (
                            <span className="text-zinc-600">Optional</span>
                          )}
                        </td>
                        <td className="py-2 text-zinc-400">{h.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Request body */}
          {bodyParams && bodyParams.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                Request Body
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left border-b border-border">
                      <th className="pb-2 pr-4 text-zinc-500 font-medium">Name</th>
                      <th className="pb-2 pr-4 text-zinc-500 font-medium">Type</th>
                      <th className="pb-2 pr-4 text-zinc-500 font-medium">Required</th>
                      <th className="pb-2 text-zinc-500 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {bodyParams.map((p) => (
                      <tr key={p.name}>
                        <td className="py-2 pr-4 text-orange-400 font-mono">{p.name}</td>
                        <td className="py-2 pr-4 text-zinc-500 font-mono">{p.type}</td>
                        <td className="py-2 pr-4">
                          {p.required ? (
                            <span className="text-amber-400">Required</span>
                          ) : (
                            <span className="text-zinc-600">Optional</span>
                          )}
                        </td>
                        <td className="py-2 text-zinc-400">{p.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Responses */}
          {responses && responses.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                Responses
              </h4>
              <div className="space-y-2">
                {responses.map((r) => (
                  <div key={r.code} className="flex items-start gap-3">
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold ${
                        r.code < 300
                          ? "bg-emerald-500/10 text-emerald-400"
                          : r.code < 500
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {r.code}
                    </span>
                    <span className="text-xs text-zinc-400">{r.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Code examples */}
          <div>
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Examples
            </h4>
            <CodeTabs examples={defaultExamples} />
          </div>
        </div>
      )}
    </div>
  );
}

// Simpler inline endpoint display (non-expandable)
export function EndpointBadge({
  method,
  path,
  desc,
}: {
  method: string;
  path: string;
  desc?: string;
}) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span
        className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold ring-1 ring-inset uppercase tracking-wider ${METHOD_COLORS[method] || METHOD_COLORS.GET}`}
      >
        {method}
      </span>
      <code className="text-xs text-white font-mono">{path}</code>
      {desc && <span className="text-xs text-zinc-500 hidden sm:inline">— {desc}</span>}
    </div>
  );
}
