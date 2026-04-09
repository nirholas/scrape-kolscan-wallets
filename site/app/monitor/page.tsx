import type { Metadata } from "next";
import MonitorClient from "./MonitorClient";
import { getAllSolanaWallets, getBscWallets } from "@/lib/data";

export const metadata: Metadata = {
  title: "Monitor — Live Wallet Activity",
  description:
    "GMGN-style real-time wallet monitor. Track smart money trades, KOL activity, and wallet inflows across Solana & BSC.",
  openGraph: {
    title: "Monitor | KolQuest",
    description:
      "Real-time smart wallet monitor with live trades, categories, and wallet tracking.",
  },
};

export default async function MonitorPage() {
  const [solWallets, bscWallets] = await Promise.all([
    getAllSolanaWallets(),
    getBscWallets(),
  ]);

  // Build a lookup map: walletAddress -> wallet info for the client
  const walletMap: Record<
    string,
    {
      name: string;
      avatar: string | null;
      category: string;
      tags: string[];
      twitter: string | null;
      chain: string;
      profit_1d: number;
      profit_7d: number;
      winrate_7d: number;
    }
  > = {};

  for (const w of [...solWallets, ...bscWallets]) {
    walletMap[w.wallet_address] = {
      name: w.name,
      avatar: w.avatar,
      category: w.category,
      tags: w.tags,
      twitter: w.twitter,
      chain: w.chain,
      profit_1d: w.profit_1d,
      profit_7d: w.profit_7d,
      winrate_7d: w.winrate_7d,
    };
  }

  return (
    <div className="h-[calc(100vh-4rem)] overflow-hidden">
      <MonitorClient walletMap={walletMap} />
    </div>
  );
}
