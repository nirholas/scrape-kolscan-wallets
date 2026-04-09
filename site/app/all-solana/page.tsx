import { getAllSolanaWallets } from "@/lib/data";
import UnifiedTable from "@/app/components/UnifiedTable";

export const revalidate = 3600;

export const metadata = {
  title: "All Solana Wallets | KolQuest",
  description: "Combined Solana wallet intelligence — KolScan + GMGN smart money wallets",
};

export default async function AllSolanaPage() {
  const data = await getAllSolanaWallets();

  return (
    <UnifiedTable
      data={data}
      title="All Solana Wallets"
      subtitle={`${data.length} wallets combined from KolScan + GMGN`}
      showSource={true}
      showCategory={true}
      chain="sol"
    />
  );
}
