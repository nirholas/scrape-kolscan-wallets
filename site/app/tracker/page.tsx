import type { Metadata } from "next";
import { getAllSolanaWallets, getBscWallets } from "@/lib/data";
import TrackerClient from "./TrackerClient";

export const metadata: Metadata = {
  title: "Wallet Tracker",
  description:
    "Track your favorite crypto wallets. Monitor performance, win rates, and profit across Solana and BSC smart money.",
};

export default async function TrackerPage() {
  const [sol, bsc] = await Promise.all([getAllSolanaWallets(), getBscWallets()]);
  const allWallets = [...sol, ...bsc];

  return <TrackerClient allWallets={allWallets} />;
}
