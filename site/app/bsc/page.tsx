import { getBscWallets } from "@/lib/data";
import UnifiedTable from "@/app/components/UnifiedTable";

export const revalidate = 3600;

export const metadata = {
  title: "BSC Wallets | KolQuest",
  description: "Smart money BSC wallets scraped from GMGN — smart degens, KOLs, snipers, and more",
};

export default async function BscPage() {
  const data = await getBscWallets();

  return (
    <UnifiedTable
      data={data}
      title="BSC Wallets"
      subtitle={`${data.length} smart money wallets on BNB Chain`}
      showCategory={true}
      chain="bsc"
    />
  );
}
