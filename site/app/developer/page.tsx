"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "@/lib/auth-client";
import Link from "next/link";

type ApiKey = {
  id: string;
  name: string | null;
  keyPrefix: string | null;
  tier: string;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

type UsageInfo = {
  id: string;
  name: string | null;
  keyPrefix: string | null;
  tier: string;
  status: "active" | "revoked" | "expired";
  limits: { requestsPerMinute: number; requestsPerDay: number };
  usage: { today: number; remaining: number; resetsAt: string };
  createdAt: string;
  lastUsedAt: string | null;
};

export default function DeveloperPage() {
  const { data: session, isPending } = useSession();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [usage, setUsage] = useState<UsageInfo[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyTier, setNewKeyTier] = useState<"free" | "pro">("free");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const loadKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/keys");
      if (res.ok) {
        const json = await res.json();
        setKeys(json.data || []);
      }
    } catch {}
  }, []);

  const loadUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/usage");
      if (res.ok) {
        const json = await res.json();
        setUsage(json.data || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (session?.user) {
      loadKeys();
      loadUsage();
    }
  }, [session?.user?.id, loadKeys, loadUsage]);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setCreatedKey(null);

    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName || undefined, tier: newKeyTier }),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error || "Failed to create key");
      setCreating(false);
      return;
    }

    setCreatedKey(json.data.key);
    setNewKeyName("");
    await loadKeys();
    await loadUsage();
    setCreating(false);
  }

  async function revokeKey(id: string) {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;

    const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
    if (res.ok) {
      await loadKeys();
      await loadUsage();
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    });
  }

  if (isPending) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 flex items-center justify-center">
        <div className="text-zinc-400">Loading…</div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Developer API</h1>
        <p className="text-zinc-400 mb-6">
          Sign in to generate API keys and access the proxy API.
        </p>
        <Link
          href="/auth/signin"
          className="inline-block px-5 py-2.5 rounded-lg bg-emerald-500 text-black font-semibold hover:bg-emerald-400 transition"
        >
          Sign In
        </Link>
      </div>
    );
  }

  const usageMap = Object.fromEntries(usage.map((u) => [u.id, u]));

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-white">Developer API</h1>
        <p className="text-zinc-400 mt-2">
          Use your API key to access KolQuest proxy endpoints at{" "}
          <code className="text-emerald-400 text-sm bg-zinc-800 px-1.5 py-0.5 rounded">
            /api/proxy/*
          </code>
          . Pass it via the{" "}
          <code className="text-emerald-400 text-sm bg-zinc-800 px-1.5 py-0.5 rounded">
            x-api-key
          </code>{" "}
          header.
        </p>
      </div>

      {/* Tier comparison */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(
          [
            {
              name: "Public",
              rpm: 10,
              daily: "100/day",
              key: false,
              color: "zinc",
            },
            {
              name: "Free",
              rpm: 60,
              daily: "10,000/day",
              key: true,
              color: "emerald",
            },
            {
              name: "Pro",
              rpm: 300,
              daily: "100,000/day",
              key: true,
              color: "violet",
            },
          ] as const
        ).map((tier) => (
          <div
            key={tier.name}
            className="rounded-xl border border-zinc-700 bg-zinc-900 p-5"
          >
            <div className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-1">
              {tier.name}
            </div>
            <div className="text-2xl font-bold text-white mb-2">
              {tier.rpm}{" "}
              <span className="text-sm font-normal text-zinc-400">req/min</span>
            </div>
            <div className="text-sm text-zinc-400">{tier.daily}</div>
            {!tier.key && (
              <div className="mt-2 text-xs text-zinc-500">No key required</div>
            )}
          </div>
        ))}
      </section>

      {/* Create key form */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">
          Create API Key
        </h2>
        <form
          onSubmit={createKey}
          className="flex flex-wrap gap-3 items-end rounded-xl border border-zinc-700 bg-zinc-900 p-5"
        >
          <div className="flex-1 min-w-48">
            <label className="block text-xs text-zinc-500 mb-1.5">
              Key name (optional)
            </label>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="e.g. My App"
              maxLength={64}
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 text-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-zinc-500"
            />
          </div>
          <div className="min-w-32">
            <label className="block text-xs text-zinc-500 mb-1.5">Tier</label>
            <select
              value={newKeyTier}
              onChange={(e) => setNewKeyTier(e.target.value as "free" | "pro")}
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 text-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="free">Free</option>
              <option value="pro">Pro</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={creating}
            className="px-5 py-2 rounded-lg bg-emerald-500 text-black font-semibold text-sm hover:bg-emerald-400 transition disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create Key"}
          </button>
        </form>
        {error && (
          <p className="mt-2 text-sm text-red-400">{error}</p>
        )}
      </section>

      {/* Newly created key – show once */}
      {createdKey && (
        <section className="rounded-xl border border-emerald-600 bg-emerald-950 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-semibold">
              API key created
            </span>
            <span className="text-xs text-emerald-600">
              — copy it now, it won&apos;t be shown again
            </span>
          </div>
          <div className="flex gap-2 items-center">
            <code className="flex-1 block bg-zinc-900 rounded-lg px-4 py-2.5 text-emerald-300 text-sm font-mono break-all">
              {createdKey}
            </code>
            <button
              onClick={() => copyToClipboard(createdKey)}
              className="shrink-0 px-3 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 transition"
            >
              {copiedKey ? "Copied!" : "Copy"}
            </button>
          </div>
          <button
            onClick={() => setCreatedKey(null)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition"
          >
            Dismiss
          </button>
        </section>
      )}

      {/* Existing keys */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">
          Your API Keys{" "}
          <span className="text-sm font-normal text-zinc-500">
            ({keys.length}/5)
          </span>
        </h2>
        {keys.length === 0 ? (
          <p className="text-zinc-500 text-sm">
            No keys yet. Create one above.
          </p>
        ) : (
          <div className="space-y-3">
            {keys.map((key) => {
              const u = usageMap[key.id];
              const revoked = !!key.revokedAt;
              return (
                <div
                  key={key.id}
                  className={`rounded-xl border p-5 ${
                    revoked
                      ? "border-zinc-800 bg-zinc-950 opacity-60"
                      : "border-zinc-700 bg-zinc-900"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-white">
                          {key.name || "Unnamed key"}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            revoked
                              ? "bg-zinc-800 text-zinc-500"
                              : key.tier === "pro"
                              ? "bg-violet-900 text-violet-300"
                              : "bg-emerald-900 text-emerald-300"
                          }`}
                        >
                          {revoked ? "Revoked" : key.tier}
                        </span>
                      </div>
                      <code className="text-sm text-zinc-400 font-mono">
                        {key.keyPrefix}
                        <span className="text-zinc-600">••••••••••••••••••••••••••••••••</span>
                      </code>
                    </div>
                    {!revoked && (
                      <button
                        onClick={() => revokeKey(key.id)}
                        className="text-xs text-red-400 hover:text-red-300 transition"
                      >
                        Revoke
                      </button>
                    )}
                  </div>

                  {u && !revoked && (
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Stat
                        label="Today's requests"
                        value={u.usage.today.toString()}
                      />
                      <Stat
                        label="Remaining today"
                        value={
                          u.usage.remaining === -1
                            ? "∞"
                            : u.usage.remaining.toString()
                        }
                      />
                      <Stat
                        label="Req/min limit"
                        value={u.limits.requestsPerMinute.toString()}
                      />
                      <Stat
                        label="Daily limit"
                        value={
                          u.limits.requestsPerDay === Infinity
                            ? "∞"
                            : u.limits.requestsPerDay.toLocaleString()
                        }
                      />
                    </div>
                  )}

                  <div className="mt-3 text-xs text-zinc-600">
                    Created {new Date(key.createdAt).toLocaleDateString()}
                    {key.lastUsedAt &&
                      ` · Last used ${new Date(
                        key.lastUsedAt
                      ).toLocaleDateString()}`}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Quick start */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Quick Start</h2>
        <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-5 space-y-4">
          <CodeBlock
            label="Wallet data (Solana)"
            code={`curl https://kol.quest/api/proxy/solana/wallet/{address} \\
  -H "x-api-key: YOUR_KEY"`}
          />
          <CodeBlock
            label="Token info (unified)"
            code={`curl https://kol.quest/api/proxy/unified/token/{address}?chain=solana \\
  -H "x-api-key: YOUR_KEY"`}
          />
          <CodeBlock
            label="Cross-chain trending"
            code={`curl "https://kol.quest/api/proxy/unified/trending?chains=solana,eth&limit=20" \\
  -H "x-api-key: YOUR_KEY"`}
          />
          <CodeBlock
            label="KOL leaderboard"
            code={`curl "https://kol.quest/api/proxy/unified/leaderboard?sortBy=pnl&limit=50" \\
  -H "x-api-key: YOUR_KEY"`}
          />
        </div>
      </section>

      {/* Docs link */}
      <section className="text-center">
        <Link
          href="/api/openapi.json"
          className="text-sm text-zinc-400 hover:text-white transition"
        >
          View full OpenAPI spec →
        </Link>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-800 rounded-lg px-3 py-2">
      <div className="text-xs text-zinc-500 mb-0.5">{label}</div>
      <div className="text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div>
      <div className="text-xs text-zinc-500 mb-1.5">{label}</div>
      <div className="relative group">
        <pre className="bg-zinc-950 rounded-lg px-4 py-3 text-sm text-zinc-300 font-mono overflow-x-auto whitespace-pre-wrap break-all">
          {code}
        </pre>
        <button
          onClick={copy}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
