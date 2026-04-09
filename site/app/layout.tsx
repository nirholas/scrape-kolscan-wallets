import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import MobileNav from "./components/MobileNav";
import DesktopNavLinks from "./components/DesktopNavLinks";

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


async function Nav() {
  let session: Awaited<ReturnType<typeof auth.api.getSession>> | null = null;
  try {
    session = await auth.api.getSession({ headers: await headers() });
  } catch {
    // DB not available — show unauthenticated nav
  }

  return (
    <nav className="sticky top-0 z-50 bg-bg-primary/95 backdrop-blur-xl border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-6 h-6 rounded bg-white flex items-center justify-center text-black font-bold text-xs">
              K
            </div>
            <span className="text-white font-semibold text-xs tracking-widest font-mono uppercase">
              KOL<span className="text-zinc-600">QUEST</span>
            </span>
          </Link>
          <DesktopNavLinks />
        </div>
        <div className="flex items-center gap-2">
          <MobileNav userLabel={session?.user ? `Account (${(session.user as Record<string, unknown>).username || session.user.name || "user"})` : undefined} />
          <Link
            href="/submit"
            className="hidden sm:inline-flex items-center gap-1.5 bg-bg-card hover:bg-bg-hover border border-border rounded px-2.5 py-1 text-[11px] text-zinc-500 hover:text-white transition-all duration-150 font-mono uppercase tracking-wider"
          >
            Submit
          </Link>
          <Link
            href="/auth"
            className="hidden md:inline-flex items-center gap-1.5 bg-white text-black hover:bg-zinc-200 rounded px-2.5 py-1 text-[11px] font-mono font-semibold uppercase tracking-wider transition-all duration-150"
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
    <footer className="border-t border-border">
      <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-[11px] font-mono font-semibold uppercase tracking-widest text-zinc-600 hover:text-white transition-colors">
            KOLQUEST
          </Link>
          <div className="flex items-center gap-4 text-[11px] text-zinc-700">
            <Link href="/leaderboard" className="hover:text-zinc-400 transition-colors">Leaderboard</Link>
            <Link href="/all-solana" className="hover:text-zinc-400 transition-colors">Solana</Link>
            <Link href="/bsc" className="hover:text-zinc-400 transition-colors">BSC</Link>
            <Link href="/docs" className="hover:text-zinc-400 transition-colors">Docs</Link>
            <a href="https://github.com/nirholas/scrape-kolscan-wallets" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">GitHub</a>
          </div>
        </div>
        <p className="text-[11px] text-zinc-800 font-mono">© {year} KolQuest</p>
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
        <div className="min-h-[calc(100vh-3rem)]">
          {children}
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
