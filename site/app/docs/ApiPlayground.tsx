"use client";

import { useState } from "react";

const ENDPOINTS = [
  { label: "Leaderboard", path: "/api/leaderboard", params: "?timeframe=1&limit=5" },
  { label: "Top KOLs", path: "/api/top", params: "?timeframe=1&sort=profit&limit=5" },
  { label: "Stats", path: "/api/stats", params: "" },
  { label: "Wallets List", path: "/api/wallets", params: "" },
  { label: "GMGN Solana", path: "/api/gmgn/sol", params: "?limit=5" },
  { label: "GMGN BSC", path: "/api/gmgn/bsc", params: "?limit=5" },
  { label: "GMGN Categories", path: "/api/gmgn/categories", params: "?chain=sol" },
  { label: "GMGN Stats", path: "/api/gmgn/stats", params: "" },
  { label: "Export GMGN", path: "/api/export/gmgn", params: "" },
  { label: "Health", path: "/health", params: "" },
];

const DEFAULT_BASE = "http://kol.quest";

export default function ApiPlayground() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE);
  const [selected, setSelected] = useState(0);
  const [customParams, setCustomParams] = useState(ENDPOINTS[0].params);
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

  const endpoint = ENDPOINTS[selected];
  const fullUrl = `${baseUrl}${endpoint.path}${customParams}`;

  async function sendRequest() {
    setLoading(true);
    setError(null);
    setResponse(null);
    setStatus(null);
    setElapsed(null);

    const start = performance.now();
    try {
      const res = await fetch(fullUrl);
      const ms = Math.round(performance.now() - start);
      setElapsed(ms);
      setStatus(res.status);
      const text = await res.text();
      try {
        setResponse(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setResponse(text);
      }
    } catch (err: any) {
      setElapsed(Math.round(performance.now() - start));
      setError(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  function selectEndpoint(i: number) {
    setSelected(i);
    setCustomParams(ENDPOINTS[i].params);
    setResponse(null);
    setError(null);
    setStatus(null);
    setElapsed(null);
  }

  return (
    <div className="space-y-4">
      {/* Base URL */}
      <div>
        <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Base URL</label>
        <input
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* Endpoint picker */}
      <div>
        <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Endpoint</label>
        <div className="flex flex-wrap gap-1.5">
          {ENDPOINTS.map((ep, i) => (
            <button
              key={ep.path}
              onClick={() => selectEndpoint(i)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                i === selected
                  ? "bg-accent/15 text-accent ring-1 ring-inset ring-accent/30"
                  : "bg-bg-card border border-border text-zinc-400 hover:text-white hover:border-zinc-600"
              }`}
            >
              {ep.label}
            </button>
          ))}
        </div>
      </div>

      {/* Query params */}
      <div>
        <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Query Params</label>
        <input
          type="text"
          value={customParams}
          onChange={(e) => setCustomParams(e.target.value)}
          placeholder="?timeframe=1&limit=10"
          className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* URL preview + send */}
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-zinc-400 font-mono truncate">
          <span className="text-emerald-400">GET</span>{" "}
          {fullUrl}
        </div>
        <button
          onClick={sendRequest}
          disabled={loading}
          className="shrink-0 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/80 disabled:opacity-50 transition-colors"
        >
          {loading ? "..." : "Send"}
        </button>
      </div>

      {/* Response */}
      {(response || error) && (
        <div className="relative">
          <div className="flex items-center gap-3 mb-2 text-xs">
            {status !== null && (
              <span className={`px-2 py-0.5 rounded font-bold ${status < 300 ? "bg-emerald-500/10 text-emerald-400" : status < 500 ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"}`}>
                {status}
              </span>
            )}
            {elapsed !== null && (
              <span className="text-zinc-500">{elapsed}ms</span>
            )}
          </div>
          <pre className="bg-bg-secondary border border-border rounded-xl p-4 text-xs overflow-x-auto max-h-[400px] overflow-y-auto">
            <code className={error ? "text-red-400" : "text-emerald-400"}>
              {error || response}
            </code>
          </pre>
        </div>
      )}
    </div>
  );
}
