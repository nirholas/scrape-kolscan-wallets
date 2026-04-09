import LeaderboardClient from "../leaderboard/LeaderboardClient";
import { getData } from "@/lib/data";

export const revalidate = 3600;

export const metadata = {
  title: "Most Profitable | KolQuest — Highest Profit KOLs",
  description:
    "Solana KOLs ranked by total profit in SOL — find the biggest earners.",
};

export default async function MostProfitablePage() {
  const data = await getData();
  return (
    <LeaderboardClient
      data={data}
      defaultSort="profit"
      defaultDir="desc"
      title="Most Profitable"
      subtitle="Ranked by profit in SOL — the biggest earners"
    />
  );
}
