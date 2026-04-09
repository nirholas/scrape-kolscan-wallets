import LeaderboardClient from "./LeaderboardClient";
import { getData } from "@/lib/data";

export const metadata = {
  title: "Leaderboard | KolQuest",
  description:
    "472 Solana KOL wallets — sortable by profit, wins, losses, and win rate",
};

export default async function LeaderboardPage() {
  const data = await getData();
  return <LeaderboardClient data={data} />;
}
