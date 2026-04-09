import LeaderboardClient from "./LeaderboardClient";
import { getDataWithAvatars } from "@/lib/data";

export const metadata = {
  title: "Leaderboard | KolQuest",
  description:
    "472 Solana KOL wallets — sortable by profit, wins, losses, and win rate",
};

export default async function LeaderboardPage() {
  const data = await getDataWithAvatars();
  return <LeaderboardClient data={data} />;
}
