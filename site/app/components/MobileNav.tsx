"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_SECTIONS = [
  {
    heading: "KolScan",
    items: [
      { href: "/leaderboard", label: "Leaderboard", desc: "All KOLs ranked by profit" },
      { href: "/top-performers", label: "Top Win Rate", desc: "Best win rate KOLs" },
      { href: "/most-profitable", label: "Most Profitable", desc: "Highest profit KOLs" },
    ],
  },
  {
    heading: "GMGN",
    items: [
      { href: "/gmgn-sol", label: "Solana Wallets", desc: "Smart money on Solana" },
      { href: "/bsc", label: "BSC Wallets", desc: "Smart money on BNB Chain" },
    ],
  },
  {
    heading: null,
    items: [
      { href: "/all-solana", label: "All Solana", desc: "Combined deduplicated wallets" },
      { href: "/feed", label: "Feed", desc: "Live wallet activity" },
      { href: "/docs", label: "Docs", desc: "API & data documentation" },
      { href: "/community", label: "Community", desc: "" },
      { href: "/submit", label: "Submit Wallet", desc: "Add a wallet to track" },
    ],
  },
];

const EXTERNAL_LINKS = [
  { href: "https://gmgn.ai/r/nichxbt", label: "GMGN" },
  { href: "https://trade.padre.gg/rk/nich", label: "Padre" },
  { href: "https://github.com/nirholas/scrape-kolscan-wallets", label: "GitHub" },
];

type Props = { userLabel?: string };

export default function MobileNav({ userLabel }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Hamburger — only visible below md */}
      <button
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border text-zinc-400 hover:text-white hover:bg-bg-hover transition-all"
      >
        {open ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden transition-opacity duration-200 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`fixed top-16 left-0 right-0 z-50 md:hidden bg-bg-primary border-b border-border shadow-elevated transition-all duration-200 ${
          open ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"
        }`}
      >
        <nav className="max-h-[calc(100vh-4rem)] overflow-y-auto px-4 py-5 space-y-5">
          {NAV_SECTIONS.map((section, si) => (
            <div key={si}>
              {section.heading && (
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-1.5 px-2">
                  {section.heading}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between px-3 py-3 rounded-xl transition-colors ${
                      pathname === item.href
                        ? "bg-bg-card text-white"
                        : "text-zinc-400 hover:text-white hover:bg-bg-hover"
                    }`}
                  >
                    <span className="text-sm font-medium">{item.label}</span>
                    {item.desc && (
                      <span className="text-[11px] text-zinc-600 text-right max-w-[140px] leading-tight">
                        {item.desc}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}

          {/* Divider + external links row */}
          <div className="border-t border-border pt-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {EXTERNAL_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-500 hover:text-white text-sm transition-colors"
                >
                  {l.label}
                </a>
              ))}
            </div>
            <Link
              href="/auth"
              className="inline-flex items-center gap-1.5 bg-white text-black hover:bg-zinc-200 rounded-lg px-3 py-1.5 text-sm font-medium transition-all"
            >
              {userLabel ?? "Sign in"}
            </Link>
          </div>
        </nav>
      </div>
    </>
  );
}
