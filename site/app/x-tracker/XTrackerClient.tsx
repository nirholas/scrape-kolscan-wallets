"use client";

import { useState, useMemo } from "react";
import type { XTrackerAccount } from "@/lib/types";

type SortField = "handle" | "subscribers" | "followers" | "tag";
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="text-zinc-700 ml-1 text-[10px]">↕</span>;
  return <span className="text-buy ml-1 text-[10px]">{dir === "desc" ? "↓" : "↑"}</span>;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

const TAG_COLORS: Record<string, string> = {
  "Binance Square": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Founders: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Politics: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Companies: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  Exchanges: "bg-buy/20 text-buy border-buy/30",
  KOL: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  Influencer: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Trader: "bg-sell/20 text-sell border-sell/30",
  NFT: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  DeFi: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  Gaming: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  Media: "bg-sky-500/20 text-sky-400 border-sky-500/30",
  VC: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  Developer: "bg-lime-500/20 text-lime-400 border-lime-500/30",
  Analyst: "bg-teal-500/20 text-teal-400 border-teal-500/30",
};

function TagBadge({ tag }: { tag: string }) {
  const colors = TAG_COLORS[tag] || "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${colors}`}>
      {tag}
    </span>
  );
}

export default function XTrackerClient({ accounts }: { accounts: XTrackerAccount[] }) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("followers");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [activeTag, setActiveTag] = useState<string>("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // Get unique tags
  const tags = useMemo(() => {
    const t = new Set<string>();
    for (const acc of accounts) {
      if (acc.tag) t.add(acc.tag);
    }
    return Array.from(t).sort();
  }, [accounts]);

  // Filter + sort
  const filtered = useMemo(() => {
    let items = accounts;

    if (activeTag !== "all") {
      items = items.filter((a) => a.tag === activeTag);
    }

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (a) =>
          a.handle.toLowerCase().includes(q) ||
          (a.name && a.name.toLowerCase().includes(q)) ||
          (a.bio && a.bio.toLowerCase().includes(q)) ||
          (a.tag && a.tag.toLowerCase().includes(q)),
      );
    }

    items = [...items].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "handle":
          cmp = a.handle.localeCompare(b.handle);
          break;
        case "subscribers":
          cmp = (a.subscribers || 0) - (b.subscribers || 0);
          break;
        case "followers":
          cmp = (a.followers || 0) - (b.followers || 0);
          break;
        case "tag":
          cmp = (a.tag || "").localeCompare(b.tag || "");
          break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return items;
  }, [accounts, activeTag, search, sortField, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
    setPage(0);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
          𝕏 Tracker
        </h1>
        <p className="text-sm text-zinc-500">
          {accounts.length.toLocaleString()} crypto X accounts tracked.
          Search, filter by category, and find alpha sources.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="m21 21-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search handle, name, or bio..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="w-full pl-10 pr-4 py-2 bg-bg-card border border-border rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-accent/50 transition-all"
          />
        </div>

        {/* Results count */}
        <div className="flex items-center px-3 py-2 bg-bg-card border border-border rounded-xl text-xs text-zinc-500">
          {filtered.length.toLocaleString()} accounts
        </div>
      </div>

      {/* Tag filters */}
      <div className="flex flex-wrap gap-1.5 mb-6 pb-4 border-b border-border">
        <button
          onClick={() => {
            setActiveTag("all");
            setPage(0);
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            activeTag === "all"
              ? "bg-buy text-black shadow-glow"
              : "bg-bg-card text-zinc-400 hover:text-white border border-border"
          }`}
        >
          All
        </button>
        {tags.map((tag) => (
          <button
            key={tag}
            onClick={() => {
              setActiveTag(tag);
              setPage(0);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTag === tag
                ? "bg-buy text-black shadow-glow"
                : "bg-bg-card text-zinc-400 hover:text-white border border-border"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-bg-card rounded-2xl border border-border shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-zinc-500 text-xs">
                <th className="text-left px-4 py-3 font-medium w-12">#</th>
                <th
                  className="text-left px-4 py-3 font-medium cursor-pointer select-none hover:text-white transition-colors"
                  onClick={() => toggleSort("handle")}
                >
                  Handle
                  <SortIcon active={sortField === "handle"} dir={sortDir} />
                </th>
                <th
                  className="text-right px-4 py-3 font-medium cursor-pointer select-none hover:text-white transition-colors"
                  onClick={() => toggleSort("subscribers")}
                >
                  Subscribers
                  <SortIcon active={sortField === "subscribers"} dir={sortDir} />
                </th>
                <th
                  className="text-right px-4 py-3 font-medium cursor-pointer select-none hover:text-white transition-colors"
                  onClick={() => toggleSort("followers")}
                >
                  Followers
                  <SortIcon active={sortField === "followers"} dir={sortDir} />
                </th>
                <th
                  className="text-left px-4 py-3 font-medium cursor-pointer select-none hover:text-white transition-colors"
                  onClick={() => toggleSort("tag")}
                >
                  Tag
                  <SortIcon active={sortField === "tag"} dir={sortDir} />
                </th>
                <th className="text-center px-4 py-3 font-medium w-20">Links</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-zinc-600">
                    {accounts.length === 0
                      ? "No X tracker data yet. Run the scraper first."
                      : "No accounts match your search."}
                  </td>
                </tr>
              ) : (
                paginated.map((acc, i) => (
                  <tr
                    key={acc.handle}
                    className="border-b border-border/50 hover:bg-bg-hover transition-colors"
                  >
                    {/* Rank */}
                    <td className="px-4 py-3 text-zinc-600 text-xs">
                      {page * PAGE_SIZE + i + 1}
                    </td>

                    {/* Handle + Avatar + Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {acc.avatar ? (
                          <img
                            src={acc.avatar}
                            alt={acc.handle}
                            className="w-8 h-8 rounded-full border border-border flex-shrink-0"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-bg-hover border border-border flex items-center justify-center text-zinc-600 text-xs flex-shrink-0">
                            {acc.handle[0]?.toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-white font-medium truncate">
                              {acc.name || acc.handle}
                            </span>
                            {acc.verified && (
                              <svg className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                          </div>
                          <span className="text-zinc-500 text-xs">@{acc.handle}</span>
                          {acc.bio && (
                            <p className="text-zinc-600 text-[11px] mt-0.5 line-clamp-1 max-w-md">
                              {acc.bio}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Subscribers */}
                    <td className="px-4 py-3 text-right text-zinc-300 tabular-nums">
                      {acc.subscribers > 0 ? formatNumber(acc.subscribers) : "—"}
                    </td>

                    {/* Followers */}
                    <td className="px-4 py-3 text-right text-zinc-300 tabular-nums">
                      {acc.followers > 0 ? formatNumber(acc.followers) : "—"}
                    </td>

                    {/* Tag */}
                    <td className="px-4 py-3">
                      {acc.tag ? <TagBadge tag={acc.tag} /> : <span className="text-zinc-700">—</span>}
                    </td>

                    {/* Links */}
                    <td className="px-4 py-3 text-center">
                      <a
                        href={`https://x.com/${acc.handle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg hover:bg-bg-hover transition-colors text-zinc-500 hover:text-white"
                        title={`@${acc.handle} on X`}
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-zinc-600">
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 rounded-lg text-xs bg-bg-hover text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Prev
              </button>
              {/* Page number buttons — show up to 5 around current */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p: number;
                if (totalPages <= 5) {
                  p = i;
                } else if (page < 3) {
                  p = i;
                } else if (page > totalPages - 4) {
                  p = totalPages - 5 + i;
                } else {
                  p = page - 2 + i;
                }
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                      p === page
                        ? "bg-buy text-black font-medium"
                        : "bg-bg-hover text-zinc-400 hover:text-white"
                    }`}
                  >
                    {p + 1}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page === totalPages - 1}
                className="px-3 py-1.5 rounded-lg text-xs bg-bg-hover text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-6 text-xs text-zinc-600 text-center">
        Data sourced from GMGN X Tracker and enriched with X profile data.
        Run <code className="bg-bg-card px-1.5 py-0.5 rounded text-zinc-500">npm run scrape:x-tracker</code> to update.
      </div>
    </div>
  );
}
