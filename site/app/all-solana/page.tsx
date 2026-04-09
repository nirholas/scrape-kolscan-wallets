import { getEnrichedSolanaWallets } from "@/lib/data";
import EnrichedSolanaTable from "@/app/components/EnrichedSolanaTable";

export const revalidate = 3600;

export const metadata = {
  title: "All Solana Wallets | KolQuest",
  description: "Combined Solana wallet intelligence — KolScan + GMGN smart money wallets enriched with Helius, Birdeye & Dune",
};

export default async function AllSolanaPage() {
  const data = await getEnrichedSolanaWallets();

  const sourceCounts = {
    kolscan: data.filter((w) => w.sources?.kolscan).length,
    gmgn: data.filter((w) => w.sources?.gmgn).length,
    dune: data.filter((w) => w.sources?.dune).length,
  };

  const subtitle = [
    `${data.length} wallets`,
    sourceCounts.kolscan > 0 && `${sourceCounts.kolscan} KolScan`,
    sourceCounts.gmgn > 0 && `${sourceCounts.gmgn} GMGN`,
    sourceCounts.dune > 0 && `${sourceCounts.dune} Dune-labeled`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <EnrichedSolanaTable
      data={data}
      title="All Solana Wallets"
      subtitle={subtitle}
    />
  );
}
