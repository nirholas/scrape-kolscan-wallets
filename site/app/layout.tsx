import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "KolQuest — Solana KOL Wallet Intelligence",
  description:
    "472 Solana KOL wallets scraped from kolscan.io — leaderboards, analytics, and GMGN import",
};

function Nav() {
  return (
    <nav className="sticky top-0 z-50 bg-bg-primary/90 backdrop-blur-xl border-b border-border">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-buy to-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-glow">
              K
            </div>
            <span className="text-white font-semibold text-[15px] tracking-tight">
              Kol<span className="text-buy">Quest</span>
            </span>
          </Link>
          <div className="hidden sm:flex items-center gap-1">
            <Link
              href="/leaderboard"
              className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-bg-hover transition-all duration-200"
            >
              Leaderboard
            </Link>
            <Link
              href="/top-performers"
              className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-bg-hover transition-all duration-200"
            >
              Top Win Rate
            </Link>
            <Link
              href="/most-profitable"
              className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-bg-hover transition-all duration-200"
            >
              Most Profitable
            </Link>
            <Link
              href="/writeup"
              className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-bg-hover transition-all duration-200"
            >
              Writeup
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://gmgn.ai/r/nichxbt"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg px-3 py-1.5 text-xs text-amber-400 hover:text-amber-300 transition-all duration-200 font-medium"
          >
            GMGN
          </a>
          <a
            href="https://trade.padre.gg/rk/nich"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-lg px-3 py-1.5 text-xs text-purple-400 hover:text-purple-300 transition-all duration-200 font-medium"
          >
            Padre
          </a>
          <a
            href="https://github.com/nirholas/scrape-kolscan-wallets"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-bg-card hover:bg-bg-hover border border-border rounded-lg px-3 py-1.5 text-sm text-zinc-300 hover:text-white transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            GitHub
          </a>
        </div>
      </div>
    </nav>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <Nav />
        <div className="min-h-[calc(100vh-4rem)]">
          {children}
        </div>
      </body>
    </html>
  );
}
