"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { AvatarFallback } from "@/app/components/FallbackImg";
import { truncateAddr, formatProfit, timeAgo } from "@/lib/format";
import type { UnifiedWallet } from "@/lib/types";

interface WatchlistEntry {
  walletAddress: string;
  chain: string;
  label: string | null;
  groupName: string | null;
  createdAt: string;
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <span className="text-zinc-700 ml-1 text-[10px]">↕</span>;
  return <span className="text-buy ml-1 text-[10px]">{dir === "desc" ? "↓" : "↑"}</span>;
}

type SortField = "label" | "winrate" | "profit" | "tracked" | "lastActive";
type SortDir = "asc" | "desc";

export default function TrackerClient({
  allWallets,
}: {
  allWallets: UnifiedWallet[];
}) {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("tracked");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [activeGroup, setActiveGroup] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  // Add wallet form state
  const [addAddress, setAddAddress] = useState("");
  const [addChain, setAddChain] = useState<"sol" | "bsc">("sol");
  const [addLabel, setAddLabel] = useState("");
  const [addGroup, setAddGroup] = useState("");

  // Build a lookup map for enriching watchlist with data
  const walletMap = useMemo(() => {
    const m = new Map<string, UnifiedWallet>();
    for (const w of allWallets) m.set(w.wallet_address, w);
    return m;
  }, [allWallets]);

  const fetchWatchlist = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist");
      if (res.status === 401) {
        setError("sign_in");
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to load watchlist");
      const data = await res.json();
      setEntries(data.watchlist);
      setError(null);
    } catch {
      setError("Failed to load your tracker");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  const groups = useMemo(() => {
    const g = new Set<string>();
    for (const e of entries) {
      if (e.groupName) g.add(e.groupName);
    }
    return Array.from(g).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    let items = entries;

    if (activeGroup !== "all") {
      items = items.filter((e) =>
        activeGroup === "default" ? !e.groupName : e.groupName === activeGroup,
      );
    }

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (e) =>
          e.walletAddress.toLowerCase().includes(q) ||
          (e.label && e.label.toLowerCase().includes(q)),
      );
    }

    // Sort
    items = [...items].sort((a, b) => {
      const wA = walletMap.get(a.walletAddress);
      const wB = walletMap.get(b.walletAddress);
      let cmp = 0;
      switch (sortField) {
        case "label":
          cmp = (a.label || a.walletAddress).localeCompare(b.label || b.walletAddress);
          break;
        case "winrate":
          cmp = ((wA?.winrate_7d || 0) - (wB?.winrate_7d || 0));
          break;
        case "profit":
          cmp = ((wA?.profit_7d || 0) - (wB?.profit_7d || 0));
          break;
        case "tracked":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "lastActive":
          // Use profit_1d as activity proxy
          cmp = ((wA?.profit_1d || 0) - (wB?.profit_1d || 0));
          break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return items;
  }, [entries, activeGroup, search, sortField, sortDir, walletMap]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const addWallet = async () => {
    if (!addAddress.trim()) return;
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: addAddress.trim(),
          chain: addChain,
          label: addLabel.trim() || null,
          groupName: addGroup.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || "Failed to add wallet");
        return;
      }
      setAddAddress("");
      setAddLabel("");
      setAddGroup("");
      setShowAddModal(false);
      fetchWatchlist();
    } catch {
      alert("Network error");
    }
  };

  const removeWallet = async (addr: string) => {
    try {
      await fetch("/api/watchlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: addr }),
      });
      fetchWatchlist();
    } catch {
      /* ignore */
    }
  };

  const moveToGroup = async (addr: string, groupName: string | null) => {
    try {
      await fetch("/api/watchlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: addr, groupName }),
      });
      fetchWatchlist();
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-zinc-500 animate-pulse">Loading tracker...</div>
      </div>
    );
  }

  if (error === "sign_in") {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-bg-card border border-border mx-auto mb-6 flex items-center justify-center">
          <svg className="w-8 h-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128H5.228A2 2 0 013 17.164V15.5a6 6 0 0112 0v1.664a2 2 0 01-2.228 1.964zM12 10a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Sign in to track wallets</h2>
        <p className="text-zinc-500 mb-6">Create an account to build your personal wallet tracker with groups, labels, and performance stats.</p>
        <Link
          href="/auth"
          className="inline-flex items-center gap-2 bg-white text-black hover:bg-zinc-200 rounded-lg px-5 py-2.5 text-sm font-medium transition-all"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="text-sell">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Wallet Tracker</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {entries.length} wallet{entries.length !== 1 ? "s" : ""} tracked
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-white text-black hover:bg-zinc-200 rounded-lg px-4 py-2 text-sm font-medium transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M12 4v16m8-8H4" />
            </svg>
            Add Wallet
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar — groups */}
        <div className="hidden lg:block w-52 shrink-0">
          <div className="bg-bg-card border border-border rounded-xl p-3 sticky top-20">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-2 mb-2">Groups</h3>
            <button
              onClick={() => setActiveGroup("all")}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                activeGroup === "all"
                  ? "bg-bg-hover text-white font-medium"
                  : "text-zinc-400 hover:text-white hover:bg-bg-hover"
              }`}
            >
              <span className="flex items-center justify-between">
                All
                <span className="text-xs text-zinc-600">{entries.length}</span>
              </span>
            </button>
            <button
              onClick={() => setActiveGroup("default")}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                activeGroup === "default"
                  ? "bg-bg-hover text-white font-medium"
                  : "text-zinc-400 hover:text-white hover:bg-bg-hover"
              }`}
            >
              <span className="flex items-center justify-between">
                Default
                <span className="text-xs text-zinc-600">{entries.filter((e) => !e.groupName).length}</span>
              </span>
            </button>
            {groups.map((g) => (
              <button
                key={g}
                onClick={() => setActiveGroup(g)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeGroup === g
                    ? "bg-bg-hover text-white font-medium"
                    : "text-zinc-400 hover:text-white hover:bg-bg-hover"
                }`}
              >
                <span className="flex items-center justify-between">
                  {g}
                  <span className="text-xs text-zinc-600">{entries.filter((e) => e.groupName === g).length}</span>
                </span>
              </button>
            ))}
            <button
              onClick={() => setShowGroupModal(true)}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-zinc-600 hover:text-zinc-400 hover:bg-bg-hover transition-colors mt-1 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M12 4v16m8-8H4" />
              </svg>
              New Group
            </button>
          </div>
        </div>

        {/* Main table area */}
        <div className="flex-1 min-w-0">
          {/* Mobile group selector */}
          <div className="lg:hidden mb-4 flex gap-2 overflow-x-auto pb-2">
            {["all", "default", ...groups].map((g) => (
              <button
                key={g}
                onClick={() => setActiveGroup(g)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  activeGroup === g
                    ? "bg-bg-hover text-white border-border-light"
                    : "text-zinc-500 border-border hover:border-border-light"
                }`}
              >
                {g === "all" ? "All" : g === "default" ? "Default" : g}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="m21 21-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by name or address"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-bg-card border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-border-light transition-colors"
              />
            </div>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="bg-bg-card border border-border rounded-xl p-12 text-center">
              {entries.length === 0 ? (
                <>
                  <div className="w-12 h-12 rounded-xl bg-bg-hover mx-auto mb-4 flex items-center justify-center">
                    <svg className="w-6 h-6 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <p className="text-zinc-400 font-medium mb-1">No wallets tracked yet</p>
                  <p className="text-sm text-zinc-600 mb-4">
                    Add wallets from leaderboards or paste an address to start tracking.
                  </p>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center gap-1.5 bg-white text-black hover:bg-zinc-200 rounded-lg px-4 py-2 text-sm font-medium transition-all"
                  >
                    Add Your First Wallet
                  </button>
                </>
              ) : (
                <p className="text-zinc-500">No wallets match your search.</p>
              )}
            </div>
          ) : (
            <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-zinc-500">
                      <th className="text-left px-4 py-3 font-medium">
                        <button onClick={() => toggleSort("tracked")} className="flex items-center hover:text-zinc-300 transition-colors">
                          Tracked <SortIcon active={sortField === "tracked"} dir={sortDir} />
                        </button>
                      </th>
                      <th className="text-left px-4 py-3 font-medium">
                        <button onClick={() => toggleSort("label")} className="flex items-center hover:text-zinc-300 transition-colors">
                          Wallet <SortIcon active={sortField === "label"} dir={sortDir} />
                        </button>
                      </th>
                      <th className="text-right px-4 py-3 font-medium">
                        <button onClick={() => toggleSort("profit")} className="flex items-center justify-end hover:text-zinc-300 transition-colors">
                          Profit 7D <SortIcon active={sortField === "profit"} dir={sortDir} />
                        </button>
                      </th>
                      <th className="text-right px-4 py-3 font-medium">
                        <button onClick={() => toggleSort("winrate")} className="flex items-center justify-end hover:text-zinc-300 transition-colors">
                          Win Rate <SortIcon active={sortField === "winrate"} dir={sortDir} />
                        </button>
                      </th>
                      <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Buys / Sells</th>
                      <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Chain</th>
                      <th className="text-right px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((entry) => {
                      const wallet = walletMap.get(entry.walletAddress);
                      return (
                        <tr
                          key={entry.walletAddress}
                          className="border-b border-border/50 hover:bg-bg-hover/50 transition-colors"
                        >
                          {/* Tracked since */}
                          <td className="px-4 py-3 text-zinc-600 text-xs">
                            {timeAgo(entry.createdAt)}
                          </td>

                          {/* Wallet */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <AvatarFallback
                                src={wallet?.avatar}
                                seed={entry.walletAddress}
                                label={entry.walletAddress.slice(0, 2)}
                                size="w-7 h-7"
                                textSize="text-xs"
                                className="font-mono"
                              />
                              <div>
                                <Link
                                    href={`/wallet/${entry.walletAddress}`}
                                  className="text-white hover:text-accent transition-colors font-medium"
                                >
                                  {entry.label || wallet?.name || truncateAddr(entry.walletAddress)}
                                </Link>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[11px] text-zinc-600 font-mono">
                                    {truncateAddr(entry.walletAddress)}
                                  </span>
                                  {wallet?.tags?.slice(0, 2).map((t) => (
                                    <span
                                      key={t}
                                      className="text-[10px] px-1.5 py-0.5 rounded bg-bg-hover text-zinc-500 border border-border"
                                    >
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Profit 7D */}
                          <td className="px-4 py-3 text-right">
                            {wallet ? (
                              <span
                                className={`font-mono text-sm ${
                                  wallet.profit_7d >= 0
                                    ? "text-buy"
                                    : "text-sell"
                                }`}
                              >
                                {formatProfit(wallet.profit_7d)}
                              </span>
                            ) : (
                              <span className="text-zinc-600">—</span>
                            )}
                          </td>

                          {/* Win Rate */}
                          <td className="px-4 py-3 text-right">
                            {wallet ? (
                              <span className="font-mono text-sm text-zinc-300">
                                {(wallet.winrate_7d * 100).toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-zinc-600">—</span>
                            )}
                          </td>

                          {/* Buys / Sells */}
                          <td className="px-4 py-3 text-right hidden sm:table-cell">
                            {wallet ? (
                              <span className="text-xs text-zinc-400">
                                <span className="text-buy">{wallet.buys_7d}</span>
                                {" / "}
                                <span className="text-sell">{wallet.sells_7d}</span>
                              </span>
                            ) : (
                              <span className="text-zinc-600">—</span>
                            )}
                          </td>

                          {/* Chain */}
                          <td className="px-4 py-3 text-right hidden md:table-cell">
                            <span className="text-xs px-2 py-0.5 rounded bg-bg-hover border border-border text-zinc-400 uppercase">
                              {entry.chain}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {/* Copy address */}
                              <button
                                onClick={() => navigator.clipboard.writeText(entry.walletAddress)}
                                className="p-1.5 rounded-lg text-zinc-600 hover:text-white hover:bg-bg-hover transition-colors"
                                title="Copy address"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                              {/* Move to group */}
                              {groups.length > 0 && (
                                <div className="relative group/move">
                                  <button
                                    className="p-1.5 rounded-lg text-zinc-600 hover:text-white hover:bg-bg-hover transition-colors"
                                    title="Move to group"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                    </svg>
                                  </button>
                                  <div className="absolute right-0 top-full pt-1 hidden group-hover/move:block z-50">
                                    <div className="bg-bg-card border border-border rounded-lg shadow-elevated py-1 min-w-[140px]">
                                      <button
                                        onClick={() => moveToGroup(entry.walletAddress, null)}
                                        className="block w-full text-left px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-bg-hover"
                                      >
                                        Default
                                      </button>
                                      {groups.map((g) => (
                                        <button
                                          key={g}
                                          onClick={() => moveToGroup(entry.walletAddress, g)}
                                          className="block w-full text-left px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-bg-hover"
                                        >
                                          {g}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                              {/* Remove */}
                              <button
                                onClick={() => removeWallet(entry.walletAddress)}
                                className="p-1.5 rounded-lg text-zinc-600 hover:text-sell hover:bg-sell/10 transition-colors"
                                title="Remove from tracker"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Wallet Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-elevated">
            <h3 className="text-lg font-semibold text-white mb-4">Add Wallet</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Wallet Address *</label>
                <input
                  type="text"
                  value={addAddress}
                  onChange={(e) => setAddAddress(e.target.value)}
                  placeholder="Paste wallet address..."
                  className="w-full bg-bg-hover border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-border-light"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Chain *</label>
                <div className="flex gap-2">
                  {(["sol", "bsc"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setAddChain(c)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        addChain === c
                          ? "bg-white text-black border-white"
                          : "bg-bg-hover text-zinc-400 border-border hover:border-border-light"
                      }`}
                    >
                      {c.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Label</label>
                <input
                  type="text"
                  value={addLabel}
                  onChange={(e) => setAddLabel(e.target.value)}
                  placeholder="e.g. Orange, dani1k..."
                  maxLength={120}
                  className="w-full bg-bg-hover border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-border-light"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Group</label>
                <input
                  type="text"
                  value={addGroup}
                  onChange={(e) => setAddGroup(e.target.value)}
                  placeholder="e.g. axiom, high-freq..."
                  maxLength={60}
                  list="group-list"
                  className="w-full bg-bg-hover border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-border-light"
                />
                <datalist id="group-list">
                  {groups.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addWallet}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-black hover:bg-zinc-200 transition-colors"
              >
                Add Wallet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowGroupModal(false)} />
          <div className="relative bg-bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-elevated">
            <h3 className="text-lg font-semibold text-white mb-4">Create Group</h3>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Group Name</label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="e.g. axiom, snipers..."
                maxLength={60}
                className="w-full bg-bg-hover border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-border-light"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newGroupName.trim()) {
                    setActiveGroup(newGroupName.trim());
                    setNewGroupName("");
                    setShowGroupModal(false);
                  }
                }}
              />
              <p className="text-[11px] text-zinc-600 mt-2">
                Groups are created automatically when you assign a wallet to one. Type a name and add wallets to it.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setShowGroupModal(false)}
                className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newGroupName.trim()) {
                    setActiveGroup(newGroupName.trim());
                    setNewGroupName("");
                    setShowGroupModal(false);
                  }
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-black hover:bg-zinc-200 transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
