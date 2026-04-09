import { Metadata } from "next";
import { notFound } from "next/navigation";
import TokenPageClient from "./TokenPageClient";

interface Props {
  params: { chain: string; address: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { chain, address } = params;
  return {
    title: `Token ${address.slice(0, 8)}… | KOL Quest`,
    description: `KOL activity and price data for ${address} on ${chain === "sol" ? "Solana" : "BSC"}`,
  };
}

export default function TokenPage({ params }: Props) {
  const { chain, address } = params;

  if (chain !== "sol" && chain !== "bsc") notFound();
  if (!address || address.length < 20) notFound();

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-4">
        <nav className="text-xs text-zinc-600 flex items-center gap-1.5">
          <a href="/" className="hover:text-white transition-colors">Home</a>
          <span>/</span>
          <a href="/feed" className="hover:text-white transition-colors">Feed</a>
          <span>/</span>
          <span className="text-zinc-400 font-mono">{address.slice(0, 8)}…</span>
        </nav>
      </div>
      <TokenPageClient chain={chain as "sol" | "bsc"} address={address} />
    </main>
  );
}
