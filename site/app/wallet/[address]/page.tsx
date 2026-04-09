import Link from "next/link";
import CopyButton from "@/app/components/CopyButton";
import ProfileActions from "@/app/components/ProfileActions";
import { getWalletDetail } from "@/lib/wallet-detail";

export const dynamic = "force-dynamic";

function truncate(addr: string) {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatUsd(v: number) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

function pct(v: number, total: number) {
  if (!total) return "0.0%";
  return `${((v / total) * 100).toFixed(1)}%`;
}

function getExplorerLinks(address: string, chain: string) {
  if (chain === "sol") {
    return [
      { label: "Solscan", href: `https://solscan.io/account/${address}` },
      { label: "Birdeye", href: `https://birdeye.so/profile/${address}?chain=solana` },
      { label: "GMGN", href: `https://gmgn.ai/sol/address/${address}?ref=nichxbt` },
      { label: "KolScan", href: `https://kolscan.io/${address}` },
    ];
  }
  return [
    { label: "BscScan", href: `https://bscscan.com/address/${address}` },
    { label: "Etherscan", href: `https://etherscan.io/address/${address}` },
    { label: "Arbiscan", href: `https://arbiscan.io/address/${address}` },
    { label: "BaseScan", href: `https://basescan.org/address/${address}` },
    { label: "GMGN BSC", href: `https://gmgn.ai/bsc/address/${address}?ref=nichxbt` },
  ];
}

export async function generateMetadata({ params }: { params: { address: string } }) {
  const detail = await getWalletDetail(params.address);
  const name = detail.wallet?.name || truncate(detail.address);
  const title = `${name} Wallet`;
  const description = `Wallet profile for ${name}. Unified Solana and EVM wallet details, performance, and recent activity.`;
  return {
    title,
    description,
    openGraph: { title: `${title} | KolQuest`, description },
  };
}

export default async function WalletPage({ params }: { params: { address: string } }) {
  const detail = await getWalletDetail(params.address);

  if (!detail.isValidAddress && !detail.hasTrackedData) {
    return (
      <main className="max-w-4xl mx-auto px-6 py-20 text-center animate-fade-in">
        <h1 className="text-2xl font-bold text-white mb-2">Wallet Not Found</h1>
        <p className="text-zinc-500">Enter a valid Solana or EVM wallet address.</p>
      </main>
    );
  }

  const address = detail.address;
  const wallet = detail.wallet;
  const name = wallet?.name || `Wallet ${truncate(address)}`;
  const chain = detail.chain === "unknown" ? "evm" : detail.chain;
  const links = getExplorerLinks(address, chain);
  const winRate = pct(detail.tradeStats.totalBuys, detail.tradeStats.totalTrades);

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4 gap-3">
        <Link href="/" className="inline-flex items-center gap-1 text-zinc-500 hover:text-white text-xs transition-colors">
          ← Leaderboard
        </Link>
        <ProfileActions
          profile={{
            wallet_address: address,
            name,
            chain: chain === "sol" ? "sol" : "bsc",
            twitter: wallet?.twitter || undefined,
            profit: detail.tradeStats.totalRealizedProfit,
            wins: detail.tradeStats.totalBuys,
            losses: detail.tradeStats.totalSells,
          }}
          shareTitle={`${name} wallet on KolQuest`}
        />
      </div>

      <div className="bg-bg-card border border-border rounded-xl p-4 mb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-white truncate">{name}</h1>
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
                {chain}
              </span>
              {wallet?.source && (
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-buy/10 border border-buy/20 text-buy">
                  {wallet.source}
                </span>
              )}
              {!detail.hasTrackedData && (
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
                  Untracked
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="font-mono">{truncate(address)}</span>
              <CopyButton text={address} className="text-zinc-600 hover:text-white transition-colors text-xs leading-none" />
            </div>

            {detail.xProfile?.bio && (
              <p className="text-zinc-500 text-sm mt-2 max-w-2xl">{detail.xProfile.bio}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-bg-secondary border border-border rounded px-2 py-1 text-[11px] font-mono text-zinc-500 hover:text-white hover:border-zinc-600 transition-all"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <div className="bg-bg-card border border-border rounded p-3">
          <div className="text-zinc-600 text-[11px] uppercase tracking-wider mb-1">Trades</div>
          <div className="text-white text-2xl font-bold tabular-nums">{detail.tradeStats.totalTrades.toLocaleString()}</div>
        </div>
        <div className="bg-bg-card border border-border rounded p-3">
          <div className="text-zinc-600 text-[11px] uppercase tracking-wider mb-1">Buy/Sell</div>
          <div className="text-white text-2xl font-bold tabular-nums">
            <span className="text-buy">{detail.tradeStats.totalBuys}</span>
            <span className="text-zinc-600">/</span>
            <span className="text-sell">{detail.tradeStats.totalSells}</span>
          </div>
        </div>
        <div className="bg-bg-card border border-border rounded p-3">
          <div className="text-zinc-600 text-[11px] uppercase tracking-wider mb-1">Win Rate</div>
          <div className="text-white text-2xl font-bold tabular-nums">{winRate}</div>
        </div>
        <div className="bg-bg-card border border-border rounded p-3">
          <div className="text-zinc-600 text-[11px] uppercase tracking-wider mb-1">Volume</div>
          <div className="text-white text-2xl font-bold tabular-nums">
            {formatUsd(detail.tradeStats.totalBuyUsd + detail.tradeStats.totalSellUsd)}
          </div>
        </div>
        <div className="bg-bg-card border border-border rounded p-3">
          <div className="text-zinc-600 text-[11px] uppercase tracking-wider mb-1">Realized PnL</div>
          <div className={`text-2xl font-bold tabular-nums ${detail.tradeStats.totalRealizedProfit >= 0 ? "text-buy" : "text-sell"}`}>
            {detail.tradeStats.totalRealizedProfit >= 0 ? "+" : ""}
            {formatUsd(detail.tradeStats.totalRealizedProfit)}
          </div>
        </div>
      </div>

      {detail.community && (
        <div className="bg-bg-card border border-border rounded-xl p-4 mb-4">
          <div className="text-zinc-500 text-[11px] uppercase tracking-wider mb-2">Community Context</div>
          <div className="text-white font-semibold text-sm">{detail.community.label}</div>
          {detail.community.notes && <p className="text-zinc-500 text-sm mt-1">{detail.community.notes}</p>}
          <div className="text-xs text-zinc-600 mt-2">
            Status: <span className="text-zinc-400">{detail.community.status}</span> · Vouches: <span className="text-zinc-400">{detail.community.vouches}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-bg-card border border-border rounded-xl p-4">
          <div className="text-zinc-500 text-[11px] uppercase tracking-wider mb-3">Top Tokens</div>
          {detail.topTokens.length === 0 ? (
            <p className="text-zinc-600 text-sm">No token data yet for this wallet.</p>
          ) : (
            <div className="space-y-2">
              {detail.topTokens.map((t) => (
                <div key={`${t.chain}:${t.tokenAddress}`} className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="text-white truncate">{t.tokenSymbol || t.tokenName || truncate(t.tokenAddress)}</div>
                    <div className="text-zinc-600 text-xs uppercase">{t.chain}</div>
                  </div>
                  <div className="text-right ml-2">
                    <div className="text-zinc-300 tabular-nums">{formatUsd(t.totalVolume)}</div>
                    <div className={`text-xs tabular-nums ${t.realizedProfit >= 0 ? "text-buy" : "text-sell"}`}>
                      {t.realizedProfit >= 0 ? "+" : ""}{formatUsd(t.realizedProfit)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-bg-card border border-border rounded-xl p-4">
          <div className="text-zinc-500 text-[11px] uppercase tracking-wider mb-3">Recent Trades</div>
          {detail.recentTrades.length === 0 ? (
            <p className="text-zinc-600 text-sm">No recent trades found in our database for this wallet.</p>
          ) : (
            <div className="space-y-2">
              {detail.recentTrades.slice(0, 10).map((t) => (
                <div key={t.id} className="flex items-center justify-between text-xs border-b border-border/50 pb-2 last:border-0 last:pb-0">
                  <div>
                    <span className={`font-semibold uppercase ${t.type === "buy" ? "text-buy" : "text-sell"}`}>{t.type}</span>
                    <span className="text-zinc-400 ml-2">{t.tokenSymbol || truncate(t.tokenAddress)}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-zinc-300 tabular-nums">{t.amountUsd == null ? "-" : formatUsd(t.amountUsd)}</div>
                    <div className="text-zinc-600 uppercase">{t.chain}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
