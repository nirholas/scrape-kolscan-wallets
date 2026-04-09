import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import MobileNav from "./components/MobileNav";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://kol.quest"),
  title: {
    default: "KolQuest — Smart Wallet Intelligence",
    template: "%s | KolQuest",
  },
  description:
    "Track the smartest crypto wallets — KolScan KOLs, GMGN smart money, Solana & BSC. Leaderboards, analytics, and copy-trade tools.",
  keywords: [
    "crypto wallet tracker",
    "smart money",
    "KOL wallets",
    "Solana wallets",
    "BSC wallets",
    "GMGN",
    "KolScan",
    "copy trade",
    "wallet analytics",
    "crypto leaderboard",
    "degen wallets",
    "sniper wallets",
  ],
  robots: { index: true, follow: true },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "KolQuest",
    title: "KolQuest — Smart Wallet Intelligence",
    description:
      "Track the smartest crypto wallets. KolScan KOLs, GMGN smart money, Solana & BSC leaderboards.",
    images: [{ url: "/api/og", width: 1200, height: 630, alt: "KolQuest" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "KolQuest — Smart Wallet Intelligence",
    description:
      "Track the smartest crypto wallets. KolScan KOLs, GMGN smart money, Solana & BSC leaderboards.",
    images: ["/api/og"],
  },
};

function NavDropdown({ label, items }: { label: string; items: { href: string; label: string; desc?: string }[] }) {
  return (
    <div className="relative group">
      <button className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-bg-hover transition-all duration-200 flex items-center gap-1">
        {label}
        <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="m19 9-7 7-7-7"/></svg>
      </button>
      <div className="absolute top-full left-0 pt-1 hidden group-hover:block z-50">
        <div className="bg-bg-card border border-border rounded-xl shadow-elevated py-1 min-w-[200px]">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-4 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-bg-hover transition-colors"
            >
              <span className="font-medium">{item.label}</span>
              {item.desc && <span className="block text-[11px] text-zinc-600 mt-0.5">{item.desc}</span>}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

async function Nav() {
  let session: Awaited<ReturnType<typeof auth.api.getSession>> | null = null;
  try {
    session = await auth.api.getSession({ headers: await headers() });
  } catch {
    // DB not available — show unauthenticated nav
  }

  return (
    <nav className="sticky top-0 z-50 bg-bg-primary/90 backdrop-blur-xl border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-black font-bold text-sm">
              K
            </div>
            <span className="text-white font-semibold text-[15px] tracking-tight">
              Kol<span className="text-accent">Quest</span>
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-0.5">
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
              ]}
            />
            <Link
              href="/track"
              className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-bg-hover transition-all duration-200 flex items-center gap-1.5"
            >
              Track
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            </Link>
            <Link
              href="/all-solana"
              className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-bg-hover transition-all duration-200"
            >
              All Solana
            </Link>
            <Link
              href="/monitor"
              className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-bg-hover transition-all duration-200 flex items-center gap-1.5"
            >
              Monitor
              <span className="w-1.5 h-1.5 rounded-full bg-buy animate-pulse" />
            </Link>
            <Link
              href="/tracker"
              className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-bg-hover transition-all duration-200"
            >
              Tracker
            </Link>
            <Link
              href="/feed"
              className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-bg-hover transition-all duration-200 flex items-center gap-1.5"
            >
              Feed
              <span className="w-1.5 h-1.5 rounded-full bg-buy animate-pulse" />
            </Link>
            <Link
              href="/docs"
              className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-bg-hover transition-all duration-200"
            >
              Docs
            </Link>
            <Link
              href="/community"
              className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-bg-hover transition-all duration-200"
            >
              Community
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MobileNav userLabel={session?.user ? `Account (${(session.user as Record<string, unknown>).username || session.user.name || "user"})` : undefined} />
          <Link
            href="/submit"
            className="hidden sm:inline-flex items-center gap-1.5 bg-bg-card hover:bg-bg-hover border border-border rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-all duration-200 font-medium"
          >
            Submit Wallet
          </Link>
          <a
            href="https://gmgn.ai/r/nichxbt"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 bg-bg-card hover:bg-bg-hover border border-border rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-all duration-200 font-medium"
          >
            GMGN
          </a>
          <a
            href="https://trade.padre.gg/rk/nich"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 bg-bg-card hover:bg-bg-hover border border-border rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-all duration-200 font-medium"
          >
            Padre
          </a>
          <a
            href="https://github.com/nirholas/scrape-kolscan-wallets"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:inline-flex items-center gap-1.5 bg-bg-card hover:bg-bg-hover border border-border rounded-lg px-3 py-1.5 text-sm text-zinc-300 hover:text-white transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
          </a>
          <Link
            href="/auth"
            className="hidden md:inline-flex items-center gap-1.5 bg-white text-black hover:bg-zinc-200 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200"
          >
            {session?.user ? `Account (${(session.user as Record<string, unknown>).username || session.user.name || "user"})` : "Sign in"}
          </Link>
        </div>
      </div>
    </nav>
  );
}

function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-bg-primary/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-10">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2 group mb-4">
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-black font-bold text-sm">
                K
              </div>
              <span className="text-white font-semibold text-[15px] tracking-tight">
                Kol<span className="text-accent">Quest</span>
              </span>
            </Link>
            <p className="text-sm text-zinc-500 leading-relaxed max-w-sm">
              Smart wallet intelligence for Solana and BSC. Discover high-signal wallets,
              compare performance, and monitor trends across top traders.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Platform</h3>
            <ul className="space-y-2 text-sm text-zinc-500">
              <li><Link href="/leaderboard" className="hover:text-white transition-colors">Leaderboard</Link></li>
              <li><Link href="/all-solana" className="hover:text-white transition-colors">All Solana</Link></li>
              <li><Link href="/bsc" className="hover:text-white transition-colors">BSC Wallets</Link></li>
              <li><Link href="/tracker" className="hover:text-white transition-colors">Wallet Tracker</Link></li>
              <li><Link href="/submit" className="hover:text-white transition-colors">Submit Wallet</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Resources</h3>
            <ul className="space-y-2 text-sm text-zinc-500">
              <li><Link href="/docs" className="hover:text-white transition-colors">Docs</Link></li>
              <li><Link href="/community" className="hover:text-white transition-colors">Community</Link></li>
              <li>
                <a href="https://github.com/nirholas/scrape-kolscan-wallets" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                  GitHub
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Data Sources</h3>
            <ul className="space-y-2 text-sm text-zinc-500">
              <li>
                <a href="https://gmgn.ai/r/nichxbt" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                  GMGN
                </a>
              </li>
              <li>
                <a href="https://trade.padre.gg/rk/nich" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                  Padre
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-5 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs text-zinc-600">© {year} KolQuest. All rights reserved.</p>
          <p className="text-xs text-zinc-600">Built for transparent, data-driven crypto research.</p>
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="theme-color" content="#0a0a0b" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-icon.svg" />
      </head>
      <body>
        <Nav />
        <div className="min-h-[calc(100vh-4rem)]">
          {children}
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
