import { NextRequest, NextResponse } from "next/server";
import { getAllSolanaWallets, getBscWallets } from "@/lib/data";

export async function GET(req: NextRequest) {
  const rawQ = (req.nextUrl.searchParams.get("q") || "").trim();
  const q = rawQ.toLowerCase();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const [sol, bsc] = await Promise.all([getAllSolanaWallets(), getBscWallets()]);

  interface SearchResult {
    type: "wallet" | "token";
    address: string;
    label: string;
    sublabel?: string;
    chain: string;
    avatar?: string | null;
  }

  const results: SearchResult[] = [];
  const limit = 12;

  const isSolAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(rawQ);
  const isEvmAddress = /^0x[a-fA-F0-9]{40}$/.test(rawQ);

  if (isSolAddress || isEvmAddress) {
    results.push({
      type: "wallet",
      address: isEvmAddress ? rawQ.toLowerCase() : rawQ,
      label: `${rawQ.slice(0, 6)}...${rawQ.slice(-4)}`,
      sublabel: isSolAddress ? "Open wallet details (Solana)" : "Open wallet details (EVM)",
      chain: isSolAddress ? "sol" : "evm",
    });
  }

  // Search wallets by name, address, twitter
  for (const w of [...sol, ...bsc]) {
    if (results.length >= limit) break;
    const matchAddr = w.wallet_address.toLowerCase().includes(q);
    const matchName = w.name.toLowerCase().includes(q);
    const matchTwitter = w.twitter?.toLowerCase().includes(q);
    if (matchAddr || matchName || matchTwitter) {
      results.push({
        type: "wallet",
        address: w.wallet_address,
        label: w.name,
        sublabel: `${w.wallet_address.slice(0, 6)}...${w.wallet_address.slice(-4)} · ${w.chain.toUpperCase()} · ${w.category}`,
        chain: w.chain,
        avatar: w.avatar,
      });
    }
  }

  const deduped: SearchResult[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    const key = `${r.type}:${r.address.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
    if (deduped.length >= limit) break;
  }

  return NextResponse.json({ results: deduped });
}
