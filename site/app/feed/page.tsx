import type { Metadata } from "next";
import FeedClient from "./FeedClient";

export const metadata: Metadata = {
  title: "Live Trade Feed",
  description: "Real-time buys and sells from the smartest tracked wallets on Solana & BSC.",
  openGraph: {
    title: "Live Trade Feed | KolQuest",
    description: "Real-time buys and sells from the smartest tracked wallets on Solana & BSC.",
  },
};

export default function FeedPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <FeedClient />
    </div>
  );
}
