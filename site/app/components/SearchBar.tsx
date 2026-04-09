"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface SearchResult {
  type: "wallet" | "token";
  address: string;
  label: string;
  sublabel?: string;
  chain: string;
  avatar?: string | null;
}

export default function SearchBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Cmd+K to open
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
        setResults([]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const search = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
          setSelected(0);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const timer = setTimeout(() => search(query), 200);
    return () => clearTimeout(timer);
  }, [query, search]);

  function navigate(r: SearchResult) {
    setOpen(false);
    setQuery("");
    setResults([]);
    if (r.type === "wallet") {
      const prefix = r.chain === "bsc" ? "/gmgn-wallet" : "/wallet";
      router.push(`${prefix}/${r.address}`);
    } else {
      router.push(`/token/${r.chain}/${r.address}`);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && results[selected]) {
      navigate(results[selected]);
    }
  }

  // Direct address detection
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (results[selected]) {
      navigate(results[selected]);
      return;
    }
    // Solana address (32-44 base58 chars)
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q)) {
      setOpen(false);
      setQuery("");
      router.push(`/wallet/${q}`);
      return;
    }
    // EVM address
    if (/^0x[a-fA-F0-9]{40}$/.test(q)) {
      setOpen(false);
      setQuery("");
      router.push(`/gmgn-wallet/${q}?chain=bsc`);
      return;
    }
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="hidden sm:inline-flex items-center gap-2 bg-bg-card hover:bg-bg-hover border border-border rounded px-2.5 py-1 text-[11px] text-zinc-600 hover:text-zinc-400 transition-all font-mono"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        Search...
        <kbd className="ml-2 text-[10px] text-zinc-700 border border-zinc-800 rounded px-1">⌘K</kbd>
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[20vh]"
          onClick={() => {
            setOpen(false);
            setQuery("");
            setResults([]);
          }}
        >
          <div
            className="w-full max-w-lg bg-bg-card border border-border rounded-xl shadow-elevated overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSubmit}>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <svg className="w-4 h-4 text-zinc-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Search wallets, tokens, or paste an address..."
                  className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-zinc-600"
                />
                {loading && (
                  <div className="w-4 h-4 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
                )}
                <kbd
                  className="text-[10px] text-zinc-700 border border-zinc-800 rounded px-1 cursor-pointer"
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                    setResults([]);
                  }}
                >
                  ESC
                </kbd>
              </div>
            </form>

            {results.length > 0 && (
              <div className="max-h-[300px] overflow-y-auto py-1">
                {results.map((r, i) => (
                  <button
                    key={`${r.type}-${r.address}`}
                    onClick={() => navigate(r)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      i === selected ? "bg-bg-hover" : "hover:bg-bg-hover"
                    }`}
                  >
                    {r.avatar ? (
                      <img src={r.avatar} alt="" className="w-7 h-7 rounded-full flex-shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-mono text-zinc-500 flex-shrink-0">
                        {r.type === "wallet" ? "W" : "T"}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">{r.label}</div>
                      {r.sublabel && (
                        <div className="text-[11px] text-zinc-600 truncate">{r.sublabel}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-500 uppercase">
                        {r.chain}
                      </span>
                      <span className="text-[10px] text-zinc-700">{r.type}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {query.length >= 2 && results.length === 0 && !loading && (
              <div className="px-4 py-6 text-center text-zinc-600 text-sm">
                No results found. Try pasting a full wallet address.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
