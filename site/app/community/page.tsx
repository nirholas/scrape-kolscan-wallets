import { desc, eq, InferSelectModel } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { walletSubmission } from "@/drizzle/db/schema";
import { getAllSolanaWallets, getBscWallets } from "@/lib/data";
import CommunityClient from "./CommunityClient";

type WalletSubmission = InferSelectModel<typeof walletSubmission>;

export type CommunityWallet = {
  wallet_address: string;
  label: string;
  chain: string;
  twitter: string | null;
  telegram: string | null;
  source: "community" | "kolscan" | "gmgn";
};

export const metadata = {
  title: "Community Wallets",
  description: "Community-submitted wallets vetted by the KolQuest community — discover new alpha from crowd-sourced wallet intelligence.",
};

export default async function CommunityPage() {
  // Load community submissions from DB
  let submissions: WalletSubmission[] = [];
  try {
    submissions = await db
      .select()
      .from(walletSubmission)
      .where(eq(walletSubmission.status, "approved"))
      .orderBy(desc(walletSubmission.createdAt))
      .limit(500);
  } catch {
    // DB not available
  }

  // Load all scraped wallets
  const [solWallets, bscWallets] = await Promise.all([
    getAllSolanaWallets(),
    getBscWallets(),
  ]);

  // Build unified list — deduplicate by address
  const seen = new Set<string>();
  const wallets: CommunityWallet[] = [];

  // Community submissions first
  for (const s of submissions) {
    if (seen.has(s.walletAddress)) continue;
    seen.add(s.walletAddress);
    wallets.push({
      wallet_address: s.walletAddress,
      label: s.label,
      chain: s.chain,
      twitter: s.twitter,
      telegram: s.telegram,
      source: "community",
    });
  }

  // Solana wallets (kolscan + gmgn)
  for (const w of solWallets) {
    if (seen.has(w.wallet_address)) continue;
    seen.add(w.wallet_address);
    wallets.push({
      wallet_address: w.wallet_address,
      label: w.name || w.wallet_address.slice(0, 8),
      chain: "sol",
      twitter: w.twitter || null,
      telegram: null,
      source: w.source as "kolscan" | "gmgn",
    });
  }

  // BSC wallets
  for (const w of bscWallets) {
    if (seen.has(w.wallet_address)) continue;
    seen.add(w.wallet_address);
    wallets.push({
      wallet_address: w.wallet_address,
      label: w.name || w.wallet_address.slice(0, 8),
      chain: "bsc",
      twitter: w.twitter || null,
      telegram: null,
      source: w.source as "kolscan" | "gmgn",
    });
  }

  return <CommunityClient wallets={wallets} />;
}
