import LeaderboardClient from "../leaderboard/LeaderboardClient";
import { getDataWithAvatars } from "@/lib/data";

export const metadata = {
  title: "Top Performers | KolQuest — Highest Win Rate KOLs",
  description:
    "Solana KOLs ranked by win rate — find the most consistent traders.",
};

export default async function TopPerformersPage() {
  const data = await getDataWithAvatars();
  return (
    <LeaderboardClient
      data={data}
      defaultSort="winrate"
      defaultDir="desc"
      title="Top Performers"
      subtitle="Ranked by win rate — the most consistent traders"
    />
  );
}
