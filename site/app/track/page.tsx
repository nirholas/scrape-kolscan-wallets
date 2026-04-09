import type { Metadata } from "next";
import TrackClient from "./TrackClient";

export const metadata: Metadata = {
  title: "Track",
  description:
    "Track new tokens spotted by smart wallets in real time — market cap, transactions, inflow, and age.",
  openGraph: {
    title: "Track | KolQuest",
    description:
      "Track new tokens spotted by smart wallets in real time.",
  },
};

export default function TrackPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <TrackClient />
    </div>
  );
}
