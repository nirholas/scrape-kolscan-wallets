import { getSolGmgnData } from "@/lib/data";
import type { UnifiedWallet } from "@/lib/types";
import UnifiedTable from "@/app/components/UnifiedTable";

export const metadata = {
  title: "GMGN Solana Wallets | KolQuest",
  description: "Smart money wallets scraped from GMGN — smart degens, KOLs, snipers, and more",
};

export default async function GmgnSolPage() {
  const gmgnData = await getSolGmgnData();

  const unified: UnifiedWallet[] = gmgnData.map((w) => ({
    wallet_address: w.wallet_address,
    name: w.name,
    sns_id: w.sns_id,
    ens_name: w.ens_name,
    twitter: w.twitter_username ? `https://x.com/${w.twitter_username}` : null,
    chain: "sol" as const,
    source: "gmgn" as const,
    category: w.category,
    tags: w.tags,
    profit_1d: w.realized_profit_1d,
    profit_7d: w.realized_profit_7d,
    profit_30d: w.realized_profit_30d,
    buys_1d: w.buy_1d,
    buys_7d: w.buy_7d,
    buys_30d: w.buy_30d,
    sells_1d: w.sell_1d,
    sells_7d: w.sell_7d,
    sells_30d: w.sell_30d,
    winrate_1d: 0,
    winrate_7d: w.winrate_7d,
    winrate_30d: w.winrate_30d,
    avatar: w.avatar,
  }));

  return (
    <UnifiedTable
      data={unified}
      title="GMGN Solana Wallets"
      subtitle={`${unified.length} smart money wallets from GMGN`}
      showCategory={true}
      chain="sol"
    />
  );
}
