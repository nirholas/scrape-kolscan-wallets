"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  desc?: string;
  external?: boolean;
  live?: boolean;
  beta?: boolean;
};

function NavDropdown({
  label,
  items,
  liveBadge,
}: {
  label: string;
  items: NavItem[];
  liveBadge?: boolean;
}) {
  const pathname = usePathname();
  const isActive = items.some((item) => !item.external && pathname === item.href);

  return (
    <div className="relative group">
      <button
        className={`px-2.5 py-1 rounded text-xs hover:text-white hover:bg-bg-hover transition-all duration-150 flex items-center gap-1.5 font-mono uppercase tracking-wider ${
          isActive ? "text-white" : "text-zinc-500"
        }`}
      >
        {label}
        {liveBadge && <span className="w-1.5 h-1.5 rounded-full bg-buy animate-pulse" />}
        <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="m19 9-7 7-7-7" />
        </svg>
      </button>
      <div className="absolute top-full left-0 pt-1 hidden group-hover:block z-50">
        <div className="bg-bg-card border border-border rounded shadow-elevated py-1 min-w-[210px]">
          {items.map((item) => {
            const itemActive = !item.external && pathname === item.href;
            const inner = (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">{item.label}</span>
                  {item.live && <span className="w-1.5 h-1.5 rounded-full bg-buy animate-pulse" />}
                  {item.external && (
                    <svg className="w-3 h-3 opacity-40 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                      <polyline points="15,3 21,3 21,9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  )}
                </div>
                {item.desc && <span className="block text-[11px] text-zinc-600 mt-0.5">{item.desc}</span>}
              </>
            );
            if (item.external) {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-3 py-2 text-xs text-zinc-500 hover:text-white hover:bg-bg-hover transition-colors"
                >
                  {inner}
                </a>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-3 py-2 text-xs hover:text-white hover:bg-bg-hover transition-colors ${
                  itemActive ? "text-white bg-bg-hover" : "text-zinc-500"
                }`}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function DesktopNavLinks() {
  const pathname = usePathname();

  const linkCls = (href: string) =>
    `px-2.5 py-1 rounded text-xs hover:text-white hover:bg-bg-hover transition-all duration-150 font-mono uppercase tracking-wider ${
      pathname === href ? "text-white" : "text-zinc-500"
    }`;

  return (
    <div className="hidden md:flex items-center gap-0">
      <NavDropdown
        label="KolScan"
        items={[
          { href: "/leaderboard", label: "Leaderboard", desc: "All KOLs ranked by profit" },
          { href: "/top-performers", label: "Top Win Rate", desc: "Best win rate KOLs" },
          { href: "/most-profitable", label: "Most Profitable", desc: "Highest profit KOLs" },
        ]}
      />
      <NavDropdown
        label="GMGN"
        items={[
          { href: "/gmgn-sol", label: "Solana Wallets", desc: "Smart money on Solana" },
          { href: "/bsc", label: "BSC Wallets", desc: "Smart money on BNB Chain" },
          { href: "/x-tracker", label: "X Tracker", desc: "10K+ crypto X accounts" },
        ]}
      />
      <NavDropdown
        label="Tools"
        liveBadge
        items={[
          { href: "/feed", label: "Feed", desc: "Live wallet activity", live: true },
          { href: "/monitor", label: "Monitor", desc: "GMGN-style live wallet monitor", live: true },
          { href: "/track", label: "Track", desc: "New tokens from tracked wallets" },
          { href: "/tracker", label: "Wallet Tracker", desc: "Your tracked wallet portfolio" },
          { href: "/all-solana", label: "All Solana", desc: "Combined deduplicated wallets" },
          { href: "/polymarket", label: "Polymarket", desc: "Prediction market pros", beta: true },
        ]}
      />
      <Link href="/docs" className={linkCls("/docs")}>
        Docs
      </Link>
      <Link href="/community" className={linkCls("/community")}>
        Community
      </Link>
      <Link href="/feedback" className={linkCls("/feedback")} title="Submit feedback or request wallet removal">
        Feedback
      </Link>
    </div>
  );
}
